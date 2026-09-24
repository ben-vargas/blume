import data from "blume:data";

import {
  isInternalPath,
  normalizeBasePath,
  withBasePath,
  withComposedBasePath,
} from "../../core/base-path.ts";
import { routeSetFor, servesRoute } from "../../core/locale-links.ts";

// Mirrors `markdown/base-links.ts`: a path whose final segment carries a file
// extension is a `public/` asset, served at the site root and never moved
// under `basePath` — unless a page is served there (a dotted route like
// `/releases/v1.2`).
const DOTTED_PATH = /\.[a-z0-9]+$/iu;

/** Strip any `#fragment`/`?query` so only the path is extension-tested. */
const pathOf = (url: string): string => url.replace(/[#?].*$/u, "");

/** Whether an internal `href` links a page rather than a public asset. */
const isPageHref = (href: string): boolean => {
  const path = pathOf(href);
  return (
    !DOTTED_PATH.test(path) ||
    servesRoute(
      routeSetFor(data.routes),
      withBasePath(data.config.basePath, path)
    )
  );
};

/**
 * Rebase a component-emitted `href` the way `markdown/base-links.ts` rebases
 * `[x](/guide)`: a root-relative internal page link gains the composed
 * `deployment.base` + `basePath` prefix, so authors write component links
 * (`<Card href="/guide">`) under the same "as if mounted at root" contract as
 * markdown links. Idempotent per layer (a hand-written `/docs/x` isn't
 * double-prefixed) and inert for external URLs, fragments, relative paths, and
 * asset links.
 */
export const contentHref = (href: string): string =>
  isInternalPath(href) && isPageHref(href)
    ? withComposedBasePath(
        normalizeBasePath(import.meta.env.BASE_URL),
        data.config.basePath,
        href
      )
    : href;
