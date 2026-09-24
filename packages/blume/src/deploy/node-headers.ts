import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";

import { join } from "pathe";

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
import type { BlumeProject } from "../core/project-graph.ts";
import type { ResolvedConfig } from "../core/schema.ts";
import { SVG_ASSET_POLICY } from "./headers.ts";
import { distDir } from "./platforms/paths.ts";
import type { BuildLog } from "./platforms/types.ts";

/**
 * The response headers the Node standalone server can't set itself. Its static
 * handler (`send`) types a file by its extension alone and sends no CORS
 * header, so the extensionless well-known files go out as
 * `application/octet-stream` and a registry reading the discovery documents
 * from another origin is blocked — the half of the `_headers` rules
 * (`deploy/headers.ts`) that a Node server has no file to read from. The Markdown
 * and text charsets need no rule here: `send` already adds `charset=UTF-8` to
 * `text/*` types.
 */

/** The headers one exact served path (deployment base included) gets. */
export interface NodeHeaderRule {
  headers: Record<string, string>;
  path: string;
}

/** The server entry `@astrojs/node` writes, which the wrapper takes over. */
export const NODE_ENTRY_FILE = "entry.mjs";
/** Where Astro's own entry moves, beside the wrapper that imports it. */
export const NODE_ASTRO_ENTRY_FILE = "astro-entry.mjs";
/** First line of the wrapper, so a second pass over the same build is a no-op. */
const WRAPPER_MARKER = "// blume:node-headers";

/** The header rules for this config, merged per path. */
export const nodeHeaderRules = (config: ResolvedConfig): NodeHeaderRule[] => {
  const deployBase = normalizeBasePath(config.deployment.options.base);
  const byPath = new Map<string, Record<string, string>>();
  const add = (path: string, name: string, value: string): void => {
    byPath.set(path, { ...byPath.get(path), [name]: value });
  };
  if (hasApiCatalog(config)) {
    add(API_CATALOG_PATH, "Content-Type", API_CATALOG_TYPE);
  }
  if (config.agents.webBotAuth.keys.length > 0) {
    add(SIGNATURES_DIRECTORY_PATH, "Content-Type", SIGNATURES_DIRECTORY_TYPE);
  }
  for (const path of crossOriginDiscoveryPaths(config)) {
    add(path, "Access-Control-Allow-Origin", "*");
  }
  return [...byPath].map(([path, headers]) => ({
    headers,
    path: `${deployBase}${path}`,
  }));
};

/** Exact-path rules, as `[path, headers]` pairs for the wrapper's lookup. */
const exactRules = (
  rules: readonly NodeHeaderRule[]
): [string, Record<string, string>][] =>
  rules
    .filter((rule) => !rule.path.includes("*"))
    .map((rule) => [rule.path, rule.headers]);

/**
 * Glob rules (`/blume-assets/*.svg`), as `[prefix, suffix, headers]` — the
 * text before and after the one `*`, which spans path segments.
 */
const patternRules = (
  rules: readonly NodeHeaderRule[]
): [string, string, Record<string, string>][] =>
  rules
    .filter((rule) => rule.path.includes("*"))
    .map((rule) => {
      const star = rule.path.indexOf("*");
      return [
        rule.path.slice(0, star),
        rule.path.slice(star + 1),
        rule.headers,
      ];
    });

/**
 * The entry that replaces Astro's: it stamps the rules' headers on the
 * response, then hands the request to Astro's handler. `send` leaves a
 * Content-Type that is already set alone, so the registered media type wins.
 *
 * It keeps Astro's contract — the `handler`, `options`, and `startServer`
 * exports `astro preview` and a middleware-mode host import — and its
 * autostart: Astro's entry is imported with autostart off (the env var is read
 * when that module evaluates, so the import has to be dynamic), and the
 * wrapper starts the server itself with its listener in front of Astro's.
 */
export const nodeEntryWrapper = (rules: readonly NodeHeaderRule[]): string =>
  `${WRAPPER_MARKER}
// Written by \`blume build\`: Astro's server entry is ./${NODE_ASTRO_ENTRY_FILE}.
// This wrapper sets the media types and CORS headers of the .well-known
// discovery files, which the standalone server's static handler can't, then
// hands every request to Astro.
const RULES = new Map(${JSON.stringify(exactRules(rules))});
const PATTERNS = ${JSON.stringify(patternRules(rules))};
const applyHeaders = (req, res) => {
  const path = (req.url ?? "").split("?")[0];
  const headers =
    RULES.get(path) ??
    PATTERNS.find(([prefix, suffix]) => path.startsWith(prefix) && path.endsWith(suffix))?.[2];
  if (headers) {
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
  }
};
const previous = process.env.ASTRO_NODE_AUTOSTART;
process.env.ASTRO_NODE_AUTOSTART = "disabled";
const astro = await import("./${NODE_ASTRO_ENTRY_FILE}");
if (previous === undefined) {
  delete process.env.ASTRO_NODE_AUTOSTART;
} else {
  process.env.ASTRO_NODE_AUTOSTART = previous;
}
export const { options } = astro;
export const handler = (req, res, ...rest) => {
  applyHeaders(req, res);
  return astro.handler(req, res, ...rest);
};
export const startServer = () => {
  const started = astro.startServer();
  // Stamp the headers only where the adapter exposes its HTTP server as
  // expected; a different shape serves the files without them rather than
  // failing to start.
  const httpServer = started?.server?.server;
  if (typeof httpServer?.prependListener === "function") {
    httpServer.prependListener("request", applyHeaders);
  }
  return started;
};
if (options.mode === "standalone" && previous !== "disabled") {
  startServer();
}
`;

/**
 * Put the header wrapper in front of a Node server build's entry. A build
 * with no rule (no API catalog, AI catalog, MCP server, signatures directory,
 * or downloaded content assets) leaves Astro's entry alone.
 */
export const wrapNodeEntry = async (
  project: BlumeProject,
  log: BuildLog
): Promise<void> => {
  // Content assets a CMS source downloaded ship as static files, which the
  // standalone server serves without the SVG sandbox static hosts get from
  // `_headers`; only a build that has them needs the rule.
  const assetsDir = join(distDir(project.context), "client", "blume-assets");
  const rules = [
    ...nodeHeaderRules(project.config),
    ...(existsSync(assetsDir)
      ? [
          {
            headers: { "Content-Security-Policy": SVG_ASSET_POLICY },
            path: `${normalizeBasePath(project.config.deployment.options.base)}/blume-assets/*.svg`,
          },
        ]
      : []),
  ];
  if (rules.length === 0) {
    return;
  }
  const serverDir = join(distDir(project.context), "server");
  const entry = join(serverDir, NODE_ENTRY_FILE);
  if (!existsSync(entry)) {
    log.warn(
      `Could not find the Node server entry at ${entry}, so the .well-known discovery files are served without their media types and CORS headers.`
    );
    return;
  }
  const source = await readFile(entry, "utf-8");
  if (source.startsWith(WRAPPER_MARKER)) {
    return;
  }
  await rename(entry, join(serverDir, NODE_ASTRO_ENTRY_FILE));
  await writeFile(entry, nodeEntryWrapper(rules), "utf-8");
  log.success(
    "Wired the .well-known discovery headers into the Node server entry"
  );
};
