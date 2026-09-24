import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import { join } from "pathe";

import type { BlumeProject } from "../../core/project-graph.ts";
import { NETLIFY_ADAPTER_PACKAGE } from "../adapters/netlify.ts";
import { SVG_ASSET_HEADERS, svgAssetPath } from "../headers.ts";
import { buildNetlifyRedirects } from "../redirects.ts";
import { distDir, toSiteUrl } from "./paths.ts";
import type { BuildLog, DeployPlatform, RedirectFile } from "./types.ts";

/**
 * `_redirects`, the format Netlify and Cloudflare Pages/Workers read, in the
 * form both accept: a static build for Cloudflare, or for no named host.
 */
export const REDIRECTS_FILE: RedirectFile = {
  build: buildNetlifyRedirects,
  name: "_redirects",
};

/**
 * `_redirects` for a `netlify()` static build, every rule forced (`301!`).
 * Astro writes a redirect page at each `from` (`dist/old/index.html`), and
 * Netlify serves a file that exists ahead of an unforced rule, so without the
 * flag that page would answer with a 200 instead of the redirect.
 */
export const NETLIFY_REDIRECTS_FILE: RedirectFile = {
  build: (redirects) => buildNetlifyRedirects(redirects, true),
  name: "_redirects",
};

/** The Frameworks API config, once the build surfaced it to the project root. */
export const NETLIFY_CONFIG_FILE = join(".netlify", "v1", "config.json");

/** One entry of the Frameworks API config's `headers` array. */
interface NetlifyHeaders {
  for: string;
  values: Record<string, string>;
}

/**
 * Sandbox the SVGs a content source downloaded on a server build. Netlify
 * serves them from the publish directory as static files, so the prerendered
 * endpoint's own headers never ship; a server build's header rules go in the
 * Frameworks API config the adapter writes (`.netlify/v1/config.json`, beside
 * its own `Cache-Control` rule for `/_astro/*`), which follows the same rules
 * as `netlify.toml`'s `[[headers]]`. Only a build that has the assets needs
 * the rule.
 */
export const emitNetlifyAssetHeaders = async (
  project: BlumeProject,
  log: BuildLog
): Promise<void> => {
  const { config, context } = project;
  if (!existsSync(join(distDir(context), "blume-assets"))) {
    return;
  }
  const configPath = join(context.root, NETLIFY_CONFIG_FILE);
  if (!existsSync(configPath)) {
    log.warn(
      `Could not find Netlify's deploy config at ${configPath}, so downloaded SVGs are served without their sandbox headers.`
    );
    return;
  }
  // Only `headers` is read; every other key rides through as parsed.
  const frameworks: { headers?: NetlifyHeaders[] } = JSON.parse(
    await readFile(configPath, "utf-8")
  );
  const path = svgAssetPath(config);
  frameworks.headers = [
    ...(frameworks.headers ?? []).filter((entry) => entry.for !== path),
    { for: path, values: { ...SVG_ASSET_HEADERS } },
  ];
  await writeFile(configPath, JSON.stringify(frameworks), "utf-8");
};

/**
 * Netlify. A server build runs on Netlify Functions from the Frameworks API
 * tree the adapter writes to `.netlify/v1`, relative to the Astro root —
 * which for Blume is the hidden `.blume` runtime, so the tree is moved up to
 * the project root after the build (the `.netlify/build` sibling is only the
 * intermediate SSR bundle, already traced into `v1/functions`, and moving
 * `v1` alone keeps the `.netlify/state.json` from `netlify link` intact).
 * Static assets are served from `dist/` either way.
 */
export const netlifyPlatform: DeployPlatform = {
  astro: {
    config: {},
    options: () => ({}),
    package: NETLIFY_ADAPTER_PACKAGE,
  },
  env: {
    detect: (env) => Boolean(env.NETLIFY),
    // Fall through per *resolved* value, not per variable — a platform can
    // set a var to the empty string, which `??` on the raw values treats as
    // present, dead-ending the chain and silently losing the site URL.
    site: (env) =>
      toSiteUrl(env.URL) ??
      toSiteUrl(env.DEPLOY_PRIME_URL) ??
      toSiteUrl(env.DEPLOY_URL),
  },
  finalizeBuild: async ({ isolated, log, project }) => {
    // The Frameworks API config is a deploy artifact; an isolated verify
    // never surfaces it.
    if (!isolated) {
      await emitNetlifyAssetHeaders(project, log);
    }
    return true;
  },
  hiddenRuntime: {
    ignoreDir: ".netlify/",
    showProjectRoot: false,
    surfacePath: ".netlify/v1",
  },
  kind: "netlify",
  negotiatesMarkdown: false,
  // Netlify reads `_headers` from the publish directory of a static deploy.
  // A server build's static assets ride the Frameworks API tree instead,
  // where the file has never been applied.
  readsHeaderFiles: { server: false, static: true },
  redirectFiles: [NETLIFY_REDIRECTS_FILE],
  serverOutputDir: distDir,
  serverStaticDir: distDir,
};
