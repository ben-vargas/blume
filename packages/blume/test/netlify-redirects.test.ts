import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { scanProject } from "../src/core/project-graph.ts";
import { cloudflare, netlify } from "../src/deploy/adapters/index.ts";
import type { AnyDeployAdapter } from "../src/deploy/adapters/index.ts";
import { publishBuildArtifacts } from "../src/deploy/artifacts.ts";
import {
  NETLIFY_REDIRECTS_FILE,
  REDIRECTS_FILE,
} from "../src/deploy/platforms/netlify.ts";
import { buildNetlifyRedirects } from "../src/deploy/redirects.ts";

/**
 * A static build writes a redirect page at each redirect's `from`, and
 * Netlify serves a file that exists ahead of an unforced `_redirects` rule —
 * so a `netlify()` static build forces its rules (`301!`). Cloudflare applies
 * its rules first and rejects a forced status, so its file, and the one a
 * build for no named host shares between both, stays unforced.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const REDIRECTS = [
  { from: "/old", status: 301 as const, to: "/new" },
  { from: "/moved", status: 302 as const, to: "/elsewhere" },
];

describe("_redirects", () => {
  it("forces every rule only when asked", () => {
    expect(buildNetlifyRedirects(REDIRECTS, true)).toBe(
      "/old /new 301!\n/moved /elsewhere 302!\n"
    );
    expect(buildNetlifyRedirects(REDIRECTS)).toBe(
      "/old /new 301\n/moved /elsewhere 302\n"
    );
    expect(NETLIFY_REDIRECTS_FILE.build(REDIRECTS)).toBe(
      buildNetlifyRedirects(REDIRECTS, true)
    );
    expect(REDIRECTS_FILE.build(REDIRECTS)).toBe(
      buildNetlifyRedirects(REDIRECTS)
    );
  });
});

/** Scan a static project on `deployment` and publish its artifacts. */
const publishStatic = async (
  deployment: AnyDeployAdapter | null
): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-netlify-redirects-"));
  dirs.push(root);
  const files = {
    "blume.config.ts": `export default { ${
      deployment ? `deployment: ${JSON.stringify(deployment)}, ` : ""
    }redirects: [{ from: "/old", to: "/new", status: 302 }] };\n`,
    "docs/index.md": "# Home\n\nWelcome.\n",
  };
  await Promise.all(
    Object.entries(files).map(async ([rel, content]) => {
      const abs = join(root, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content, "utf-8");
    })
  );
  const dist = join(root, "dist");
  await mkdir(dist, { recursive: true });
  await publishBuildArtifacts(
    await scanProject(root, { mode: "build" }),
    dist,
    { info: () => {}, warn: () => {} },
    async (outDir) => {
      await mkdir(join(outDir, "pagefind"), { recursive: true });
      return 1;
    }
  );
  return readFile(join(dist, "_redirects"), "utf-8");
};

describe("a static build's _redirects", () => {
  it("is forced for netlify(), where the redirect page would shadow it", async () => {
    expect(await publishStatic(netlify({ output: "static" }))).toBe(
      "/old /new 302!\n"
    );
  });

  it("stays unforced for cloudflare() and for no named host", async () => {
    expect(await publishStatic(cloudflare({ output: "static" }))).toBe(
      "/old /new 302\n"
    );
    expect(await publishStatic(null)).toBe("/old /new 302\n");
  });
});
