import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { eject } from "../src/registry/eject.ts";

// The playground's Send button targets `{basePath}/_api-proxy` when a
// reference sets `playground: { proxy: true }`. The generated runtime injects
// that endpoint, so the ejected app has to as well, or every send 404s.

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

/** A fresh project dir holding `files` (paths relative to it). */
const project = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-eject-proxy-"));
  dirs.push(root);
  await Promise.all(
    Object.entries(files).map(async ([rel, content]) => {
      const abs = join(root, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content);
    })
  );
  return root;
};

const read = (root: string, rel: string): string =>
  readFileSync(join(root, rel), "utf-8");

const spec = (servers: { url: string }[]): string =>
  JSON.stringify({
    info: { title: "API", version: "1" },
    openapi: "3.0.0",
    paths: { "/ping": { get: { responses: { "200": {} } } } },
    servers,
  });

const config = (proxy: boolean): string => `export default {
  basePath: "/docs",
  deployment: { kind: "node", options: { output: "server" }, requiredSecrets: [], runtimeDeps: [] },
  reference: [{ kind: "openapi", options: { playground: { proxy: ${proxy} }, spec: "./openapi.json" }, requiredSecrets: [], runtimeDeps: [] }],
};
`;

describe("eject with the built-in playground proxy", () => {
  it("writes and injects the proxy endpoint with its allowlist", async () => {
    const root = await project({
      "blume.config.ts": config(true),
      "docs/index.md": "# Home\n",
      "openapi.json": spec([{ url: "https://api.example.com/v1" }]),
    });

    const { files, warnings } = await eject(root);

    const entry = "src/blume-openapi/api-proxy.ts";
    expect(files).toContain(join(root, entry));
    const endpoint = read(root, entry);
    expect(endpoint).toContain("export const prerender = false;");
    expect(endpoint).toContain(
      'createPlaygroundProxyHandler(["https://api.example.com"])'
    );
    // Injected by pattern under basePath, where the playground sends.
    expect(read(root, "astro.config.mjs")).toContain(
      `"entrypoint":"${entry}","pattern":"/docs/_api-proxy"`
    );
    expect(warnings).toStrictEqual([]);
  }, 30_000);

  it("warns when a proxied spec has no origin to allow", async () => {
    const root = await project({
      "blume.config.ts": config(true),
      "docs/index.md": "# Home\n",
      "openapi.json": spec([{ url: "/v1" }]),
    });

    const { warnings } = await eject(root);

    expect(read(root, "src/blume-openapi/api-proxy.ts")).toContain(
      "createPlaygroundProxyHandler([])"
    );
    expect(warnings.join("\n")).toContain("playground.proxy: true");
  }, 30_000);

  it("leaves the endpoint out when no playground uses it", async () => {
    const root = await project({
      "blume.config.ts": config(false),
      "docs/index.md": "# Home\n",
      "openapi.json": spec([{ url: "https://api.example.com" }]),
    });

    await eject(root);

    expect(existsSync(join(root, "src/blume-openapi/api-proxy.ts"))).toBe(
      false
    );
    expect(read(root, "astro.config.mjs")).not.toContain("_api-proxy");
  }, 30_000);
});
