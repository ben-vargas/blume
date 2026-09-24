import { basename } from "pathe";

import { normalizeBasePath, withBasePath } from "../core/base-path.ts";
import { nextFenceState } from "../core/code-fences.ts";
import type { FenceState } from "../core/code-fences.ts";
import {
  buildFileRouteIndex,
  isIndexFileName,
  resolveRelativeHref,
  routeOfLinkedFile,
} from "../core/links.ts";
import type { RelativeLinkBase } from "../core/links.ts";
import type { BlumeProject } from "../core/project-graph.ts";
import { extractLinks } from "../core/sources/normalize.ts";

/**
 * Relative page links on the agent surfaces — the `.md`/`.mdx` mirrors,
 * llms-full.txt, MCP `get_page` and `resources/read`. An agent resolves
 * `[Install](./install)` against the URL it fetched (`/guides.md`), so the
 * link lands on `/install`; the rendered page rewrites it to the route it
 * means (`markdown/relative-links.ts`), and the Markdown an agent reads gets
 * the same rewrite from the same resolver (`resolveRelativeHref`), so both
 * point at one page. Inline links and reference definitions are rewritten;
 * fenced and inline code, images, and anything not a relative page link are
 * left as written.
 */

/** The page a Markdown text was written for. */
export interface LinkedPage {
  route: string;
  sourcePath?: string;
}

/** Rewrite a page's relative page links to the routes they mean. */
export type RelativeLinkRewriter = (text: string, page: LinkedPage) => string;

/** A reference definition's target: `[label]: ./install` or `<./install>`. */
const DEFINITION =
  /^(?<lead> {0,3}\[(?:[^\]\\]|\\.)+\]:[\t ]*)(?:<(?<angled>[^>]*)>|(?<bare>\S+))/u;

/**
 * Whether a text could hold a relative page link at all: an inline link, a
 * reference definition, or a component `href` whose target isn't a URL with
 * a scheme, a root path, or a fragment. Most pages hold none, and those skip
 * the link parse and the line-by-line fence scan entirely.
 */
const MAYBE_RELATIVE =
  /\]\([\t ]*<?(?![a-z][\d+.a-z-]*:|\/|#)|^ {0,3}\[[^\]\n]+\]:[\t ]*<?(?![a-z][\d+.a-z-]*:|\/|#)|\shref=["'](?![a-z][\d+.a-z-]*:|\/|#)/imu;

interface Splice {
  column: number;
  length: number;
  text: string;
}

/** Apply same-line splices, right to left so earlier columns stay valid. */
const spliceLine = (line: string, splices: readonly Splice[]): string => {
  let out = line;
  for (const splice of splices.toSorted((a, b) => b.column - a.column)) {
    out =
      out.slice(0, splice.column) +
      splice.text +
      out.slice(splice.column + splice.length);
  }
  return out;
};

/** One line's reference-definition splice, when it defines a routed target. */
const definitionSplice = (
  line: string,
  routed: (target: string) => string | undefined
): Splice | undefined => {
  const groups = DEFINITION.exec(line)?.groups;
  const lead = groups?.lead;
  const target = groups?.angled ?? groups?.bare;
  const route = target === undefined ? undefined : routed(target);
  if (lead === undefined || target === undefined || route === undefined) {
    return undefined;
  }
  // An angle-bracketed target starts one past its `<`.
  const angled = groups?.angled === undefined ? 0 : 1;
  return { column: lead.length + angled, length: target.length, text: route };
};

/** Every routed splice in `text`, by 0-based line: links, then definitions. */
const collectSplices = (
  text: string,
  lines: readonly string[],
  routed: (target: string) => string | undefined
): Map<number, Splice[]> => {
  const splices = new Map<number, Splice[]>();
  const add = (index: number, splice: Splice): void => {
    splices.set(index, [...(splices.get(index) ?? []), splice]);
  };
  for (const link of extractLinks(text)) {
    const route = link.image ? undefined : routed(link.target);
    if (route !== undefined) {
      add(link.line - 1, {
        column: link.column - 1,
        length: link.target.length,
        text: route,
      });
    }
  }
  let fence: FenceState = null;
  for (const [index, line] of lines.entries()) {
    const next = nextFenceState(line, fence);
    const inFence = fence !== null || next !== null;
    fence = next;
    const splice = inFence ? undefined : definitionSplice(line, routed);
    if (splice !== undefined) {
      add(index, splice);
    }
  }
  return splices;
};

/**
 * Build the rewriter for a project: the file → route lookup a `.md`/`.mdx`
 * link resolves through is built once. A file shared by every locale
 * publishes once per locale, and the default locale's route stands for it;
 * fallback copies render another locale's file, so they never stand for one.
 */
export const relativeLinkRewriter = (
  project: BlumeProject
): RelativeLinkRewriter => {
  const { deployment, i18n } = project.config;
  const deployBase = normalizeBasePath(deployment.options.base);
  const localeTokens = i18n
    ? ["$", ...i18n.locales.map((locale) => locale.code)]
    : [];
  const fileRoutes = buildFileRouteIndex(project.graph.pages, i18n ?? null);
  const navPathBySource = new Map(
    project.graph.pages.map((graphPage) => [
      graphPage.sourcePath,
      graphPage.navPath,
    ])
  );
  const routes = new Set(project.manifest.routes.map((route) => route.path));

  return (text, page) => {
    const { sourcePath } = page;
    if (!sourcePath || !MAYBE_RELATIVE.test(text)) {
      return text;
    }
    const from: RelativeLinkBase = {
      isIndex: isIndexFileName(basename(sourcePath), localeTokens),
      route: page.route,
    };
    const navPath = navPathBySource.get(sourcePath) ?? basename(sourcePath);
    const resolveFile = (path: string): string | undefined =>
      routeOfLinkedFile(fileRoutes, { navPath, sourcePath }, path);
    const routed = (target: string): string | undefined => {
      const route = resolveRelativeHref(target, from, resolveFile, (path) =>
        routes.has(path)
      );
      return route === undefined ? undefined : withBasePath(deployBase, route);
    };

    const lines = text.split("\n");
    const splices = collectSplices(text, lines, routed);

    return lines
      .map((line, index) => {
        const lineSplices = splices.get(index);
        return lineSplices ? spliceLine(line, lineSplices) : line;
      })
      .join("\n");
  };
};
