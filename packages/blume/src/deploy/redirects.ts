import {
  normalizeBasePath,
  withBasePath,
  withComposedBasePath,
} from "../core/base-path.ts";
import type { ResolvedConfig } from "../core/schema.ts";
import type { VercelHeader } from "./headers.ts";

/**
 * Platform redirect files for a static build. Astro already emits redirect HTML
 * (meta-refresh) pages for static output, but that's a soft client redirect.
 * These give the host a real HTTP 3xx: Netlify/Cloudflare read `_redirects`,
 * Vercel reads `vercel.json`, and `blume-redirects.json` is a structured
 * manifest for anything else (Apache/nginx rules, an edge worker).
 */

type Redirect = ResolvedConfig["redirects"][number];

/**
 * Base a redirect for Astro's `redirects` config, where the two sides are not
 * symmetric:
 *
 * - `from` gains only `basePath`. Astro builds the match pattern with
 *   `deployment.base` already applied (`getPattern(segments, config.base)`), so
 *   adding it here would serve the redirect at `{base}{base}/from`.
 * - `to` gains the full `{deployment.base}{basePath}` stack. Astro resolves a
 *   destination that matches a known route by regenerating it from that route's
 *   segments, which carry no base — and passes an unmatched destination through
 *   verbatim. Neither path prepends `base`, so a root-relative `to` escapes the
 *   base entirely (withastro/astro#7774, still the behavior in Astro 7).
 *
 * Both sides are authored as if mounted at root; external `to` URLs pass
 * through. Idempotent, so a hand-written base isn't doubled.
 */
export const applyBaseToAstroRedirects = (
  redirects: Redirect[],
  basePath: string,
  deployBase: string
): Redirect[] => {
  // `deployment.base` arrives as the user wrote it (Astro accepts `/base/`,
  // even `base`); normalizing here keeps the composed paths well-formed.
  const base = normalizeBasePath(deployBase);
  return basePath || base
    ? redirects.map((redirect) => ({
        ...redirect,
        from: withBasePath(basePath, redirect.from),
        to: withComposedBasePath(base, basePath, redirect.to),
      }))
    : redirects;
};

/**
 * Base a redirect for the host platform files below. Unlike Astro's config,
 * these are matched against the real served URL, so both sides carry the full
 * `{deployment.base}{basePath}` stack.
 */
export const applyBaseToPlatformRedirects = (
  redirects: Redirect[],
  basePath: string,
  deployBase: string
): Redirect[] => {
  const base = normalizeBasePath(deployBase);
  return basePath || base
    ? redirects.map((redirect) => ({
        ...redirect,
        from: withComposedBasePath(base, basePath, redirect.from),
        to: withComposedBasePath(base, basePath, redirect.to),
      }))
    : redirects;
};

/**
 * The configured redirects as the host platform matches them, via
 * {@link applyBaseToPlatformRedirects}. The one basing every consumer must
 * share: the emitted redirect files and the Cloudflare worker-first redirect
 * exemptions both compare these paths against real served URLs.
 */
export const platformRedirects = (config: ResolvedConfig): Redirect[] =>
  applyBaseToPlatformRedirects(
    config.redirects,
    config.basePath,
    config.deployment.options.base ?? ""
  );

/** `_redirects` text (Netlify + Cloudflare Pages): `from to status` per line. */
export const buildNetlifyRedirects = (redirects: Redirect[]): string =>
  `${redirects
    .map((redirect) => `${redirect.from} ${redirect.to} ${redirect.status}`)
    .join("\n")}\n`;

/** The `vercel.json` Blume writes for a static deploy of `dist/`. */
interface VercelConfig {
  headers?: readonly VercelHeader[];
  redirects: { destination: string; source: string; statusCode: number }[];
}

/**
 * `vercel.json` contents with a `redirects` array, and a `headers` array when
 * header rules are given (see `buildVercelHeaders`). Uses `statusCode` (Vercel's
 * alternative to the boolean `permanent`) so the configured code ships exactly:
 * `permanent` would silently coerce a 301 to 308 and a 302 to 307, diverging
 * from the `_redirects` file, which preserves exact codes.
 */
export const buildVercelConfig = (
  redirects: Redirect[],
  headers: readonly VercelHeader[] = []
): string => {
  const config: VercelConfig = {
    redirects: redirects.map((redirect) => ({
      destination: redirect.to,
      source: redirect.from,
      statusCode: redirect.status,
    })),
  };
  if (headers.length > 0) {
    config.headers = headers;
  }
  return `${JSON.stringify(config, null, 2)}\n`;
};

/** Structured manifest for hosts that need manual wiring. */
export const buildRedirectManifest = (redirects: Redirect[]): string =>
  `${JSON.stringify(
    redirects.map((redirect) => ({
      from: redirect.from,
      status: redirect.status,
      to: redirect.to,
    })),
    null,
    2
  )}\n`;
