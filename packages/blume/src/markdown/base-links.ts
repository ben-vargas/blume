import {
  isInternalPath,
  withBasePath,
  withComposedBasePath,
} from "../core/base-path.ts";
import { servesRoute } from "../core/locale-links.ts";
import type { MdastNode } from "./mdast.ts";
import { routeSnapshotReader } from "./route-snapshot.ts";

interface UrlNode extends MdastNode {
  url?: string | null;
}

/**
 * The slice of Satteri's MDAST visitor context this plugin needs. Nodes are
 * read-only (the tree compiles to an op-stream), so a URL edit is recorded via
 * `setProperty`, not by mutating the node object.
 */
interface MdastUrlContext {
  setProperty: (node: MdastNode, key: "url", value: string) => void;
}

/**
 * A path whose final segment carries a file extension (`/spec.pdf`, `/logo.svg`)
 * — a public asset, which Blume serves from `public/` at the site root and
 * does *not* move under `basePath`, unless a page is served there: a dotted
 * route (`/releases/v1.2`) is based like any other page link, the same
 * served-route test the link checker and the locale rewrite apply.
 */
const DOTTED_PATH = /\.[a-z0-9]+$/iu;

/** Strip any `#fragment`/`?query` so only the path is extension-tested. */
const pathOf = (url: string): string => url.replace(/[#?].*$/u, "");

/** Only a string URL can be rebased; MDAST allows null or absent urls. */
const isUrl = (url: string | null | undefined): url is string =>
  typeof url === "string";

export interface BaseLinksPluginOptions {
  /**
   * The `blume:data` JSON file, for an ejected app: with no CLI in the process
   * to publish the snapshot, the plugin reads the file eject writes instead.
   */
  dataFile?: string;
}

/**
 * Satteri MDAST plugin that prepends the served-URL base — `deployment.base`
 * layered over the site-wide `basePath` — to root-relative internal page links
 * (`[x](/guide)` -> `/base/docs/guide`), so authors write links as if mounted
 * at root. Idempotent per layer (via `withComposedBasePath`, so a hand-written
 * `/docs/x` isn't double-prefixed) and inert for external URLs, fragments,
 * relative paths, images, and asset links. Only constructed when a base is set
 * (see `markdown/index.ts`).
 */
export const baseLinksPlugin = (
  deployBase: string,
  basePath: string,
  options: BaseLinksPluginOptions = {}
) => {
  const readSnapshot = routeSnapshotReader(options.dataFile);
  // Parsed once per published snapshot, like the relative-links index.
  let cached: { routes: Set<string>; text: string } | undefined;

  /** Every route the site serves (base-prefixed), from the route snapshot. */
  const servedRoutes = (): ReadonlySet<string> => {
    const text = readSnapshot();
    if (text === undefined) {
      return new Set();
    }
    if (cached?.text !== text) {
      const data: { routes: { path: string }[] } = JSON.parse(text);
      cached = {
        routes: new Set(data.routes.map((route) => route.path)),
        text,
      };
    }
    return cached.routes;
  };

  /** Whether an internal `url` links a page rather than a public asset. */
  const isPageLink = (url: string): boolean => {
    const path = pathOf(url);
    return (
      !DOTTED_PATH.test(path) ||
      servesRoute(servedRoutes(), withBasePath(basePath, path))
    );
  };

  const rebase = (node: UrlNode, ctx: MdastUrlContext): void => {
    const { url } = node;
    if (isUrl(url) && isInternalPath(url) && isPageLink(url)) {
      const next = withComposedBasePath(deployBase, basePath, url);
      if (next !== url) {
        ctx.setProperty(node, "url", next);
      }
    }
  };
  // `link` covers inline links; `definition` covers reference-style link
  // definitions (`[x]: /guide`). `image` is intentionally excluded — images are
  // public assets served at the site root, unaffected by `basePath`.
  return {
    definition: rebase,
    link: rebase,
    name: "blume-base-links",
  };
};
