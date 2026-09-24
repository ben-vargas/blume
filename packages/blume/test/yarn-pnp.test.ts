import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { yarnPnpDiagnostic } from "../src/cli/yarn-pnp.ts";

let root: string;

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "blume-pnp-")));
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

describe("yarnPnpDiagnostic", () => {
  it("flags a command running under the Plug'n'Play runtime", () => {
    const diagnostic = yarnPnpDiagnostic(root, "3");
    expect(diagnostic?.code).toBe("BLUME_YARN_PNP");
    expect(diagnostic?.severity).toBe("error");
    expect(diagnostic?.suggestion).toContain("nodeLinker: node-modules");
  });

  it("flags a PnP manifest in an ancestor with no node_modules copy of Blume", async () => {
    await writeFile(join(root, ".pnp.cjs"), "", "utf-8");
    const project = join(root, "apps", "docs");
    await mkdir(project, { recursive: true });
    expect(yarnPnpDiagnostic(project)?.code).toBe("BLUME_YARN_PNP");
  });

  it("accepts a stale manifest once Blume is installed in node_modules", async () => {
    await writeFile(join(root, ".pnp.js"), "", "utf-8");
    await mkdir(join(root, "node_modules", "blume"), { recursive: true });
    await writeFile(
      join(root, "node_modules", "blume", "package.json"),
      "{}",
      "utf-8"
    );
    expect(yarnPnpDiagnostic(root)).toBeNull();
  });

  it("stays quiet for an ordinary install", () => {
    // The runtime's PnP version is read by default; `bun test` has none.
    expect(yarnPnpDiagnostic(root)).toBeNull();
  });
});
