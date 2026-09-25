import {
  isPatternPath,
  patternDestination,
} from "../core/redirect-patterns.ts";
import type { RedirectResolution } from "./types.ts";
import { normalizePath } from "./url.ts";

interface ConfiguredRedirect {
  from: string;
  to: string;
  status: number;
}

/**
 * A destination's page path: the part before any query string or fragment. A
 * redirect to `/guide#setup` or `/search?q=x` lands on the `/guide` / `/search`
 * page — the suffix belongs to the browser, not the file tree, so keeping it
 * would report a working redirect as broken.
 */
const pathOnly = (value: string): string => {
  const cut = value.search(/[?#]/u);
  return cut === -1 ? value : value.slice(0, cut);
};

/**
 * Follow every configured redirect through to its destination, classifying what
 * it lands on.
 *
 * - `loop`    — the chain revisits a hop it has already been to. Never resolves.
 * - `broken`  — the chain ends somewhere the build does not serve.
 * - `chain`   — it resolves, but through at least one intermediate redirect.
 * - `ok`      — one hop, straight to a real page.
 * - `pattern` — a pattern (`/beta/:slug*`), which covers paths rather than
 *   naming one, so there is no single chain to walk; {@link redirectAt}
 *   resolves a path it covers.
 *
 * An external destination (`https://…`) is always `ok`: it's outside the site,
 * so there's no local page to check it against. A hop onto a path a pattern
 * covers continues through that pattern.
 */
export const resolveRedirects = (
  redirects: readonly ConfiguredRedirect[],
  /** Whether the build serves a normalized path — see `isServed`. */
  served: (path: string) => boolean
): RedirectResolution[] => {
  const byFrom = new Map<string, ConfiguredRedirect>();
  for (const redirect of redirects) {
    byFrom.set(normalizePath(redirect.from), redirect);
  }
  const hopFrom = (path: string): string | undefined =>
    byFrom.get(path)?.to ?? patternDestination(redirects, path);

  return redirects.map((redirect) => {
    const from = normalizePath(redirect.from);
    if (isPatternPath(redirect.from)) {
      return { ...redirect, chain: [from], outcome: "pattern" as const };
    }
    const chain: string[] = [from];
    const seen = new Set<string>([from]);
    let current = redirect.to;

    for (;;) {
      // An external hop ends the walk — we can't follow it locally.
      if (/^https?:\/\//iu.test(current)) {
        chain.push(current);
        break;
      }
      const next = normalizePath(pathOnly(current));
      if (seen.has(next)) {
        chain.push(next);
        return {
          ...redirect,
          chain,
          outcome: "loop" as const,
        };
      }
      chain.push(next);
      seen.add(next);
      const hop = hopFrom(next);
      if (hop === undefined) {
        break;
      }
      current = hop;
    }

    const destination = chain.at(-1) ?? from;
    const external = /^https?:\/\//iu.test(destination);
    if (!(external || served(destination))) {
      return { ...redirect, chain, outcome: "broken" as const };
    }
    // `chain` is [from, …hops, destination]; more than two entries means at
    // least one intermediate redirect.
    return {
      ...redirect,
      chain,
      outcome: chain.length > 2 ? ("chain" as const) : ("ok" as const),
    };
  });
};

/**
 * The configured redirect a path takes, for the checks that report a link,
 * canonical, sitemap entry, or `hreflang` pointing through one: the exact
 * redirect from that path, else the pattern covering it, its `to` filled in
 * for this path.
 */
export const redirectAt = (
  redirects: readonly RedirectResolution[],
  path: string
): { to: string } | undefined => {
  const exact = redirects.find((entry) => normalizePath(entry.from) === path);
  if (exact) {
    return exact;
  }
  const to = patternDestination(redirects, path);
  return to === undefined ? undefined : { to };
};
