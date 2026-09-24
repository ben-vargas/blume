import { NODE_ADAPTER_PACKAGE } from "../adapters/node.ts";
import { wrapNodeEntry } from "../node-headers.ts";
import { clientDir, distDir } from "./paths.ts";
import type { DeployPlatform } from "./types.ts";

/**
 * A self-hosted Node server. The standalone server in `dist/server` serves
 * `dist/client` through its own static handler, which has no `_headers` or
 * `_redirects` support — redirects are answered at request time from the
 * Astro config, and a header file written there would be inert. The headers
 * the discovery files need come from a wrapper around the server entry
 * instead (`deploy/node-headers.ts`). No platform env to detect: the site URL
 * has to be configured.
 */
export const nodePlatform: DeployPlatform = {
  astro: {
    config: {},
    options: () => ({ mode: "standalone" }),
    package: NODE_ADAPTER_PACKAGE,
  },
  env: null,
  finalizeBuild: async ({ isolated, log, project }) => {
    // The wrapped entry is a deploy artifact; an isolated verify skips it.
    if (!isolated) {
      await wrapNodeEntry(project, log);
    }
    return true;
  },
  hiddenRuntime: {
    ignoreDir: null,
    showProjectRoot: false,
    surfacePath: null,
  },
  kind: "node",
  negotiatesMarkdown: false,
  readsHeaderFiles: { server: false, static: false },
  redirectFiles: [],
  serverOutputDir: distDir,
  serverStaticDir: clientDir,
};
