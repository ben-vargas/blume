import { crossOriginDiscoveryPaths } from "../ai/ai-catalog.ts";
import {
  API_CATALOG_PATH,
  API_CATALOG_TYPE,
  hasApiCatalog,
} from "../ai/api-catalog.ts";
import {
  SIGNATURES_DIRECTORY_PATH,
  SIGNATURES_DIRECTORY_TYPE,
} from "../ai/web-bot-auth.ts";
import { normalizeBasePath } from "../core/base-path.ts";
import type { ResolvedConfig } from "../core/schema.ts";

/**
 * The `_headers` file for a static build (Netlify + Cloudflare Pages/Workers
 * static assets). Blume's raw AI-ready endpoints — `/<route>.md`, `/<route>.mdx`,
 * and the `.txt` files (`llms.txt`, `llms-full.txt`) — are valid UTF-8, but a
 * static host serves them from the file extension alone, and common hosts send
 * `text/markdown` / `text/plain` with **no** `charset`. Browsers then fall back
 * to Windows-1252 for non-HTML text, so any non-ASCII docs (Japanese, accented
 * Latin, …) render as mojibake when the raw URL is opened directly. HTML pages
 * escape this because they carry `<meta charset>`; the raw endpoints have only
 * the HTTP header. Pinning `charset=utf-8` here matches the Content-Type these
 * same routes already send from the dev/server runtime (see
 * `astro/templates.ts`). Hosts that don't read `_headers` ignore the file
 * harmlessly; Vercel gets the same rules in `vercel.json` (see
 * {@link buildVercelHeaders}).
 */

/**
 * One rule per served extension. `.mdx` uses `text/markdown` to match the
 * runtime endpoint, which serves both variants as `text/markdown`. The raw
 * Markdown mirrors live under the page routes (which carry `basePath`), while
 * the `.txt` files (`llms.txt`, `llms-full.txt`) are written to the dist root
 * and served at the deployment base — so only the `.md`/`.mdx` rules take the
 * `basePath` layer.
 */
const HEADER_RULES: readonly {
  contentType: string;
  ext: string;
  underBasePath: boolean;
}[] = [
  {
    contentType: "text/markdown; charset=utf-8",
    ext: "md",
    underBasePath: true,
  },
  {
    contentType: "text/markdown; charset=utf-8",
    ext: "mdx",
    underBasePath: true,
  },
  {
    contentType: "text/plain; charset=utf-8",
    ext: "txt",
    underBasePath: false,
  },
];

/** Where the generated endpoint serves content-source images from. */
const CONTENT_ASSETS_ROOT = "/blume-assets";

/**
 * The policy a content-source SVG is served with: an opaque origin with
 * scripts off, so an uploaded SVG that carries a `<script>` stays inert when
 * opened directly. The endpoint sends it from the server and dev runtimes;
 * {@link headerRules} carries it to static hosts.
 */
export const SVG_ASSET_POLICY = "sandbox";

/**
 * One static-host header rule: a served path (a `*` glob spanning path
 * segments, or an exact path) and the header it sets there.
 */
export interface HeaderRule {
  name: string;
  path: string;
  value: string;
}

/**
 * The header rules every static host should apply, in `_headers` glob syntax.
 * The glob carries the served prefix (`{deployment.base}{basePath}` for the
 * Markdown mirrors, `{deployment.base}` for the root `.txt` files) so the rules
 * still match once the site is mounted under a subpath (`/docs/*.md`); the
 * wildcard spans path segments, so a nested route like `/docs/ja/intro.md`
 * matches too.
 *
 * When a homepage `Link` header is provided (see `ai/link-headers.ts`), an
 * exact-path rule for the root page advertises the agent-discovery resources —
 * the static-host counterpart of the Vercel routing-config injection.
 */
export const headerRules = (
  config: ResolvedConfig,
  homeLinkHeader?: string | null
): HeaderRule[] => {
  const deployBase = normalizeBasePath(config.deployment.options.base);
  const rules: HeaderRule[] = HEADER_RULES.map((rule) => {
    const prefix = rule.underBasePath
      ? `${deployBase}${config.basePath}`
      : deployBase;
    return {
      name: "Content-Type",
      path: `${prefix}/*.${rule.ext}`,
      value: rule.contentType,
    };
  });
  if (homeLinkHeader) {
    rules.push({ name: "Link", path: `${deployBase}/`, value: homeLinkHeader });
  }
  // The well-known discovery files are extensionless, so without an explicit
  // rule a static host serves their registered media types as octet-stream or
  // text/plain.
  if (hasApiCatalog(config)) {
    rules.push({
      name: "Content-Type",
      path: `${deployBase}${API_CATALOG_PATH}`,
      value: API_CATALOG_TYPE,
    });
  }
  if (config.agents.webBotAuth.keys.length > 0) {
    rules.push({
      name: "Content-Type",
      path: `${deployBase}${SIGNATURES_DIRECTORY_PATH}`,
      value: SIGNATURES_DIRECTORY_TYPE,
    });
  }
  // Agent registries fetch the discovery documents cross-origin; a static
  // host sends no CORS header unless told to.
  for (const path of crossOriginDiscoveryPaths(config)) {
    rules.push({
      name: "Access-Control-Allow-Origin",
      path: `${deployBase}${path}`,
      value: "*",
    });
  }
  // Published skills live at the deployment base, outside `basePath` — the
  // `.md` charset rule above misses them whenever a basePath is set, and the
  // RFC wants archives served as application/gzip explicitly.
  if (config.agents.skills) {
    rules.push(
      {
        name: "Content-Type",
        path: `${deployBase}/.well-known/agent-skills/*.md`,
        value: "text/markdown; charset=utf-8",
      },
      {
        name: "Content-Type",
        path: `${deployBase}/.well-known/agent-skills/*.tar.gz`,
        value: "application/gzip",
      }
    );
  }
  // Images a content source downloads (a CMS upload, a remote page's figure)
  // are served from the docs origin, and an SVG opened directly is a document
  // that can run script. A sandbox policy keeps it inert; an `<img>` that
  // embeds it is unaffected.
  rules.push({
    name: "Content-Security-Policy",
    path: `${deployBase}${CONTENT_ASSETS_ROOT}/*.svg`,
    value: SVG_ASSET_POLICY,
  });
  return rules;
};

/**
 * `_headers` contents: each {@link headerRules} entry as its path with an
 * indented header line, in the two-space format Netlify and Cloudflare read.
 */
export const buildNetlifyHeaders = (
  config: ResolvedConfig,
  homeLinkHeader?: string | null
): string =>
  `${headerRules(config, homeLinkHeader)
    .map((rule) => `${rule.path}\n  ${rule.name}: ${rule.value}`)
    .join("\n")}\n`;

/** One entry of `vercel.json`'s `headers` array. */
export interface VercelHeader {
  headers: { key: string; value: string }[];
  source: string;
}

/** The characters `path-to-regexp` would read as syntax in a literal path. */
const SOURCE_SYNTAX = /[\\(){}?+:]/gu;

/**
 * A `_headers` path as a `vercel.json` `source`, which `path-to-regexp` reads:
 * the literal parts are escaped, and a `*` glob becomes the `(.*)` group that
 * spans path segments as the glob does. An exact directory path (the homepage
 * rule's `/docs/`) drops its trailing slash, the URL Vercel serves it at.
 */
const vercelSource = (path: string): string => {
  const trimmed =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return trimmed
    .split("*")
    .map((part) => part.replaceAll(SOURCE_SYNTAX, String.raw`\$&`))
    .join("(.*)");
};

/**
 * The {@link headerRules} as `vercel.json` `headers` entries. Vercel reads no
 * `_headers` file, so a static deploy of `dist/` carries the same rules here —
 * the charset on the raw Markdown and text files, the homepage `Link` header,
 * and the media types and CORS header of the discovery files.
 */
export const buildVercelHeaders = (
  config: ResolvedConfig,
  homeLinkHeader?: string | null
): VercelHeader[] =>
  headerRules(config, homeLinkHeader).map((rule) => ({
    headers: [{ key: rule.name, value: rule.value }],
    source: vercelSource(rule.path),
  }));
