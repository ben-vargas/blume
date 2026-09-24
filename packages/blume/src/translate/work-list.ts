import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { dirname, extname, join, relative } from "pathe";

import { localeCodes, localeTargetPath } from "../core/i18n.ts";
import type { BlumeProject } from "../core/project-graph.ts";
import type { Diagnostic, PageRecord } from "../core/types.ts";
import { hashSource } from "./ledger.ts";
import type { TranslationLedger } from "./ledger.ts";
import { discoverTranslatableMeta, metaTargetPath } from "./meta.ts";
import type { TranslatableMeta } from "./meta.ts";

/**
 * Classification of every (source, target locale) pair:
 * - `missing` — no non-fallback page record for (translationKey, locale).
 *   Existence is the graph record, never a disk probe, so a hand-authored
 *   translation at a non-canonical name still counts as existing.
 * - `stale` — a record exists, but the ledger hash differs from the current
 *   source hash (the source changed since its last translation).
 * - up-to-date — hashes match (counted, not itemized).
 * - untracked — a record exists with no ledger entry: a pre-existing human
 *   translation. Adopted (stamped at the current hash), never overwritten;
 *   only `--force` retranslates it.
 */
export type WorkStatus = "missing" | "stale";

export interface PageWorkItem {
  kind: "page";
  /** Target locale code (configured casing). */
  locale: string;
  /** Absolute path of the default-locale source file. */
  sourcePath: string;
  /** POSIX root-relative source path — the ledger key. */
  sourceRel: string;
  status: WorkStatus;
  /** Absolute canonical target path (`localeTargetPath`). */
  targetPath: string;
  /** POSIX root-relative target path, for display. */
  targetRel: string;
  /** Copy the file unchanged instead of translating it — a non-markdown
   * include partial (code embed) has no prose, but must still exist in each
   * locale tree so the translated pages' relative includes resolve. */
  verbatim?: boolean;
}

/** One meta file needing its title in one locale, inside a `MetaWorkItem`. */
export interface MetaWorkEntry {
  meta: TranslatableMeta;
  status: WorkStatus;
  /** Absolute path of the generated per-locale `meta.ts`. */
  targetPath: string;
}

/** All of one locale's needed meta titles — a single agent call. */
export interface MetaWorkItem {
  kind: "meta";
  entries: MetaWorkEntry[];
  locale: string;
}

export type WorkItem = MetaWorkItem | PageWorkItem;

/** A pre-existing translation with no ledger entry, to adopt (stamp) as-is. */
export interface UntrackedEntry {
  /** The current source hash to stamp. */
  hash: string;
  kind: "meta" | "page";
  locale: string;
  sourceRel: string;
}

export interface TranslateWorkList {
  diagnostics: Diagnostic[];
  items: WorkItem[];
  /** Every ledger key in the current universe (for pruning). */
  knownSources: Set<string>;
  /** The locales this run targets (configured casing, default excluded). */
  targetLocales: string[];
  untracked: UntrackedEntry[];
  /** Count of (source, locale) pairs already translated and current. */
  upToDate: number;
}

const PAGE_EXTENSIONS = new Set([".md", ".mdx"]);

/**
 * The names in each content root, read once per root: a locale folder authored
 * in another casing (`pt-br/` for `pt-BR`) is where `localeTargetPath` puts
 * that locale's translations.
 */
const rootFolders = (): ((contentRoot: string) => string[]) => {
  const read = new Map<string, string[]>();
  return (contentRoot) => {
    const cached = read.get(contentRoot);
    if (cached) {
      return cached;
    }
    const names = readdirSync(contentRoot);
    read.set(contentRoot, names);
    return names;
  };
};

/**
 * The translatable page universe: filesystem-backed default-locale pages.
 * Remote/staged sources have no writable path; fallback records are padding;
 * a `.$.` shared file already materializes into every locale.
 */
const translatablePages = (
  project: BlumeProject,
  i18n: NonNullable<BlumeProject["config"]["i18n"]>
): {
  page: PageRecord;
  contentRoot: string;
  ext: string;
  sourcePath: string;
}[] => {
  const rootsByName = new Map(
    project.sources.flatMap((source) =>
      source.staged || !source.contentRoot
        ? []
        : [[source.name, source.contentRoot] as const]
    )
  );
  const seen = new Set<string>();
  const universe: {
    page: PageRecord;
    contentRoot: string;
    ext: string;
    sourcePath: string;
  }[] = [];
  for (const page of project.graph.pages) {
    if (
      page.locale !== i18n.defaultLocale ||
      page.fallback ||
      !page.sourcePath ||
      seen.has(page.sourcePath) ||
      // Archived snapshots are frozen and carry their own translations —
      // they are never (re)translated. (`localeTargetPath` would also compute
      // `fr/v1.0/…` where the snapshot's translation lives at `v1.0/fr/…`.)
      page.version !== ""
    ) {
      continue;
    }
    const ext = extname(page.sourcePath);
    const base = page.sourcePath.slice(0, page.sourcePath.length - ext.length);
    const contentRoot = rootsByName.get(page.source.name);
    if (!PAGE_EXTENSIONS.has(ext) || base.endsWith(".$") || !contentRoot) {
      continue;
    }
    seen.add(page.sourcePath);
    universe.push({ contentRoot, ext, page, sourcePath: page.sourcePath });
  }
  return universe;
};

/** Outcome of classifying one (source, locale) pair against the ledger:
 * a work status, an existing translation to adopt, or already current. */
type PairOutcome = WorkStatus | "current" | "untracked";

/** The shared pair classifier — see the WorkStatus doc for the taxonomy. */
const classifyPair = (
  exists: boolean,
  stamp: string | undefined,
  hash: string,
  force: boolean
): PairOutcome => {
  if (!exists) {
    return "missing";
  }
  if (stamp === undefined) {
    return force ? "stale" : "untracked";
  }
  return stamp !== hash || force ? "stale" : "current";
};

/** The classified work for the include partials the pages reference. */
interface PartialWork {
  items: PageWorkItem[];
  /** Ledger keys to add to the run's known-source universe. */
  sources: string[];
  untracked: UntrackedEntry[];
  upToDate: number;
}

/**
 * Work for the include partials referenced by the translatable pages. Under
 * the `dir` parser each locale is its own tree, so a translated page's
 * relative `<include>` resolves *inside the locale tree* — the partial must
 * exist there too, or the next build fails with BLUME_INCLUDE_NOT_FOUND on
 * every locale. (Under `dot` the translated file sits beside its source and
 * the shared partial already resolves; nothing to do.) Markdown partials are
 * translated like pages; anything else (code embeds) is copied verbatim. A
 * partial that is itself a page is skipped — its own translation already
 * lands at the mirrored path. Existence is a disk probe: partials have no
 * page records to consult.
 */
const partialWorkItems = async (
  universe: ReturnType<typeof translatablePages>,
  project: BlumeProject,
  i18n: NonNullable<BlumeProject["config"]["i18n"]>,
  ledger: TranslationLedger,
  targetLocales: string[],
  force: boolean
): Promise<PartialWork> => {
  const work: PartialWork = {
    items: [],
    sources: [],
    untracked: [],
    upToDate: 0,
  };
  if (i18n.parser !== "dir") {
    return work;
  }
  const { root } = project.context;
  const pagePaths = new Set(
    project.graph.pages.flatMap((page) =>
      page.sourcePath ? [page.sourcePath] : []
    )
  );
  const folders = rootFolders();
  const partials = new Map<string, string>();
  for (const { page, contentRoot } of universe) {
    for (const partial of page.includes ?? []) {
      if (!(pagePaths.has(partial) || partials.has(partial))) {
        partials.set(partial, contentRoot);
      }
    }
  }
  for (const [partialPath, contentRoot] of partials) {
    const sourceRel = relative(root, partialPath);
    work.sources.push(sourceRel);
    // oxlint-disable-next-line no-await-in-loop -- one read per partial
    const hash = hashSource(await readFile(partialPath, "utf-8"));
    const ext = extname(partialPath);
    const verbatim = !PAGE_EXTENSIONS.has(ext.toLowerCase());
    const contentRel = relative(contentRoot, partialPath);
    for (const locale of targetLocales) {
      const targetPath = join(
        contentRoot,
        localeTargetPath(contentRel, ext, locale, i18n, folders(contentRoot))
      );
      const item = (status: WorkStatus): PageWorkItem => {
        const partialItem: PageWorkItem = {
          kind: "page",
          locale,
          sourcePath: partialPath,
          sourceRel,
          status,
          targetPath,
          targetRel: relative(root, targetPath),
        };
        if (verbatim) {
          partialItem.verbatim = true;
        }
        return partialItem;
      };
      const stamp = ledger.files[sourceRel]?.[locale];
      const outcome = classifyPair(existsSync(targetPath), stamp, hash, force);
      if (outcome === "untracked") {
        work.untracked.push({ hash, kind: "page", locale, sourceRel });
      } else if (outcome === "current") {
        work.upToDate += 1;
      } else {
        work.items.push(item(outcome));
      }
    }
  }
  return work;
};

/**
 * Compute the run's work: which (source, locale) pairs are missing or stale,
 * which existing translations to adopt, and what's already up to date.
 * `force` promotes every pair to work; `locales` narrows the targets.
 */
export const computeWorkList = async (
  project: BlumeProject,
  ledger: TranslationLedger,
  options: { force?: boolean; locales?: string[] } = {}
): Promise<TranslateWorkList> => {
  const { i18n } = project.config;
  if (!i18n) {
    return {
      diagnostics: [],
      items: [],
      knownSources: new Set(),
      targetLocales: [],
      untracked: [],
      upToDate: 0,
    };
  }
  const targetLocales = localeCodes(i18n).filter(
    (code) =>
      code !== i18n.defaultLocale &&
      (options.locales === undefined || options.locales.includes(code))
  );

  const translated = new Set(
    project.graph.pages.flatMap((page) =>
      page.fallback ? [] : [`${page.translationKey} ${page.locale}`]
    )
  );

  const { root } = project.context;
  const knownSources = new Set<string>();
  const untracked: UntrackedEntry[] = [];
  const pageItems: PageWorkItem[] = [];
  let upToDate = 0;

  const universe = translatablePages(project, i18n);
  const folders = rootFolders();

  for (const { page, contentRoot, ext, sourcePath } of universe) {
    const sourceRel = relative(root, sourcePath);
    knownSources.add(sourceRel);
    // oxlint-disable-next-line no-await-in-loop -- one read per source file
    const hash = hashSource(await readFile(sourcePath, "utf-8"));
    const contentRel = relative(contentRoot, sourcePath);

    for (const locale of targetLocales) {
      const targetPath = join(
        contentRoot,
        localeTargetPath(contentRel, ext, locale, i18n, folders(contentRoot))
      );
      const item = (status: WorkStatus): PageWorkItem => ({
        kind: "page",
        locale,
        sourcePath,
        sourceRel,
        status,
        targetPath,
        targetRel: relative(root, targetPath),
      });
      const exists = translated.has(`${page.translationKey} ${locale}`);
      const stamp = ledger.files[sourceRel]?.[locale];
      const outcome = classifyPair(exists, stamp, hash, options.force === true);
      if (outcome === "untracked") {
        untracked.push({ hash, kind: "page", locale, sourceRel });
      } else if (outcome === "current") {
        upToDate += 1;
      } else {
        pageItems.push(item(outcome));
      }
    }
  }

  const partialWork = await partialWorkItems(
    universe,
    project,
    i18n,
    ledger,
    targetLocales,
    options.force ?? false
  );
  for (const rel of partialWork.sources) {
    knownSources.add(rel);
  }
  pageItems.push(...partialWork.items);
  untracked.push(...partialWork.untracked);
  upToDate += partialWork.upToDate;

  const meta = await discoverTranslatableMeta(project);
  const metaItems: MetaWorkItem[] = [];
  for (const locale of targetLocales) {
    const entries: MetaWorkEntry[] = [];
    for (const source of meta.metas) {
      knownSources.add(source.sourceRel);
      const targetDir = dirname(metaTargetPath(source, locale));
      const exists = ["meta.ts", "meta.js", "meta.mjs"].some((name) =>
        existsSync(join(targetDir, name))
      );
      const hash = hashSource(source.raw);
      const stamp = ledger.files[source.sourceRel]?.[locale];
      const entry = (status: WorkStatus): MetaWorkEntry => ({
        meta: source,
        status,
        targetPath: metaTargetPath(source, locale),
      });
      const outcome = classifyPair(exists, stamp, hash, options.force === true);
      if (outcome === "untracked") {
        untracked.push({
          hash,
          kind: "meta",
          locale,
          sourceRel: source.sourceRel,
        });
      } else if (outcome === "current") {
        upToDate += 1;
      } else {
        entries.push(entry(outcome));
      }
    }
    if (entries.length > 0) {
      metaItems.push({ entries, kind: "meta", locale });
    }
  }

  pageItems.sort((a, b) =>
    a.sourceRel === b.sourceRel
      ? a.locale.localeCompare(b.locale)
      : a.sourceRel.localeCompare(b.sourceRel)
  );
  metaItems.sort((a, b) => a.locale.localeCompare(b.locale));

  return {
    diagnostics: meta.diagnostics,
    items: [...pageItems, ...metaItems],
    knownSources,
    targetLocales,
    untracked,
    upToDate,
  };
};
