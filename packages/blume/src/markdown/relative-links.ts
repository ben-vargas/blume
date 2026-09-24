import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { dirname, normalize, relative, resolve } from "pathe";

import { readRuntimeModule } from "../astro/runtime-modules.ts";
import { isIndexFileName, resolveRelativeHref } from "../core/links.ts";
import type { RelativeLinkBase } from "../core/links.ts";
import type { MdastNode } from "./mdast.ts";

interface UrlNode extends MdastNode {
  url?: string | null;
}

/** The visitor-context slice this plugin uses (see `mdast.ts` for the model). */
interface RelativeLinksContext {
  fileURL: URL | undefined;
  setProperty: (node: MdastNode, key: "url", value: string) => void;
}

/** The slice of the `blume:data` snapshot the plugin reads. */
interface RouteData {
  config: {
    i18n?: { defaultLocale: string; locales: { code: string }[] } | null;
  };
  routes: {
    collection: string;
    entryId: string;
    fallback: boolean;
    locale: string;
    path: string;
  }[];
}

/** What the plugin knows about where content files publish. */
interface RouteIndex {
  /** `collection` + NUL + `entryId` → the route that entry publishes at. */
  routes: Map<string, string>;
  /** Tokens an index file name may carry before its extension. */
  localeTokens: string[];
}

/** A content file, located: its page, and how to find the files beside it. */
interface LocatedPage extends RelativeLinkBase {
  /** The route a sibling file publishes at, from its path relative to `file`. */
  routeOf: (path: string) => string | undefined;
}

const entryKey = (collection: string, entryId: string): string =>
  `${collection}\0${entryId}`;

/**
 * Index the snapshot's routes by collection entry. A file shared by every
 * locale publishes once per locale; the default locale's route stands for it,
 * and the rendered link moves into the reader's locale afterwards (see
 * `LocaleLinks.astro`). Fallback copies render another locale's file, so they
 * never stand for it.
 */
const indexRoutes = (data: RouteData): RouteIndex => {
  const defaultLocale = data.config.i18n?.defaultLocale;
  const routes = new Map<string, string>();
  for (const route of data.routes) {
    if (route.fallback) {
      continue;
    }
    const key = entryKey(route.collection, route.entryId);
    if (!routes.has(key) || route.locale === defaultLocale) {
      routes.set(key, route.path);
    }
  }
  const locales = data.config.i18n?.locales.map((locale) => locale.code) ?? [];
  return {
    localeTokens: data.config.i18n ? ["$", ...locales] : [],
    routes,
  };
};

export interface RelativeLinksPluginOptions {
  /** The `docs` collection's base directory, which entry ids are relative to. */
  contentRoot?: string;
  /**
   * The `blume:data` JSON file, for an ejected app: with no CLI in the process
   * to publish the snapshot, the plugin reads the file eject writes instead.
   */
  dataFile?: string;
}

/**
 * Satteri MDAST plugin that rewrites relative page links (`[Install](./install)`,
 * `[Setup](../guides/setup.md)`) to the root-relative route they mean, using
 * the same file-style reading `blume validate` checks them against
 * (`resolveRelativeHref`). Left as written, the browser resolves them against
 * the page's slashless URL — so `./install` on an index page (`/guides`) lands
 * on `/install`, and a `.md` link opens the raw Markdown source instead of the
 * page. The page's own route, and a linked file's, come from the `blume:data`
 * snapshot the CLI publishes (or, ejected, the file eject writes), keyed by
 * collection entry: `docs` entries by their path under `contentRoot`, staged
 * entries (remote sources) by the longest trailing path that names one. A file
 * the snapshot doesn't know keeps its links as written.
 *
 * Runs before the base-links plugin, whose `basePath` layering is idempotent,
 * so a rewritten route (which already carries `basePath`) only gains the
 * `deployment.base` prefix.
 */
export const relativeLinksPlugin = (
  options: RelativeLinksPluginOptions = {}
) => {
  const contentRoot = options.contentRoot
    ? resolve(options.contentRoot)
    : undefined;
  const dataFile = options.dataFile ? resolve(options.dataFile) : undefined;

  // Parsed once per published snapshot: the CLI republishes on regeneration,
  // and an unchanged snapshot is the same string, so every page compiled
  // between regenerations reuses one index.
  let cached: { index: RouteIndex; text: string } | undefined;
  let fileStamp: number | undefined;
  let fileText: string | undefined;

  /** The ejected snapshot file's text, re-read only when it changes. */
  const readDataFile = (path: string): string | undefined => {
    let stamp: number;
    try {
      stamp = statSync(path).mtimeMs;
    } catch {
      return undefined;
    }
    if (stamp !== fileStamp) {
      fileStamp = stamp;
      fileText = readFileSync(path, "utf-8");
    }
    return fileText;
  };

  const routeIndex = (): RouteIndex | undefined => {
    const text =
      readRuntimeModule("blume:data") ??
      (dataFile ? readDataFile(dataFile) : undefined);
    if (text === undefined) {
      return undefined;
    }
    if (cached?.text !== text) {
      const data: RouteData = JSON.parse(text);
      cached = { index: indexRoutes(data), text };
    }
    return cached.index;
  };

  /** The page `file` renders, with a resolver for the files beside it. */
  const locate = (file: string, index: RouteIndex): LocatedPage | undefined => {
    const locateIn = (
      collection: string,
      base: string
    ): LocatedPage | undefined => {
      const entryId = relative(base, file);
      const route = index.routes.get(entryKey(collection, entryId));
      if (route === undefined) {
        return undefined;
      }
      return {
        isIndex: isIndexFileName(entryId, index.localeTokens),
        route,
        routeOf: (path) =>
          index.routes.get(
            entryKey(collection, relative(base, resolve(dirname(file), path)))
          ),
      };
    };
    if (contentRoot && !relative(contentRoot, file).startsWith("../")) {
      return locateIn("docs", contentRoot);
    }
    // A staged entry's id is its path under the staging dir, which the plugin
    // isn't told: the longest trailing path naming a staged entry wins.
    const segments = file.split("/");
    for (let start = 1; start < segments.length; start += 1) {
      const staged = locateIn(
        "staged",
        segments.slice(0, start).join("/") || "/"
      );
      if (staged) {
        return staged;
      }
    }
    return undefined;
  };

  const rewrite = (node: UrlNode, ctx: RelativeLinksContext): void => {
    const { url } = node;
    if (url === undefined || url === null || !ctx.fileURL) {
      return;
    }
    // Cheap first: most links aren't relative, and those never need the index.
    if (
      resolveRelativeHref(url, { isIndex: false, route: "/" }) === undefined
    ) {
      return;
    }
    const index = routeIndex();
    const page = index && locate(normalize(fileURLToPath(ctx.fileURL)), index);
    if (!page) {
      return;
    }
    const next = resolveRelativeHref(url, page, page.routeOf);
    if (next !== undefined && next !== url) {
      ctx.setProperty(node, "url", next);
    }
  };

  // `link` covers inline links; `definition` covers reference-style
  // definitions (`[x]: ./install`). Images stay with the image pipeline, which
  // resolves relative embeds from beside the page source.
  return {
    definition: rewrite,
    link: rewrite,
    name: "blume-relative-links",
  };
};
