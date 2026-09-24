import { afterAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { loadConfig } from "../src/core/config.ts";
import { BlumeError } from "../src/core/diagnostics.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

/** Load a project whose only file is `name` holding `source`. */
const load = async (source: string, name = "blume.config.ts") => {
  const dir = await mkdtemp(join(tmpdir(), "blume-default-export-"));
  dirs.push(dir);
  const file = join(dir, name);
  await writeFile(file, source);
  const result = await loadConfig(dir).catch((error: Error) => error);
  return { file, result };
};

describe("a config file without a default export", () => {
  it.each([
    ["a bare defineConfig call", 'defineConfig({ title: "Acme" });\n'],
    ["a named export", 'export const config = { title: "Acme" };\n'],
    ["a null default", "export default null;\n"],
    ["an empty file", ""],
  ])("fails on %s, naming the file", async (_case, source) => {
    const { file, result } = await load(
      `const defineConfig = (config: object) => config;\n${source}`
    );
    expect(result).toBeInstanceOf(BlumeError);
    // SAFETY: narrowed by the instanceof assertion above.
    const { diagnostic } = result as BlumeError;
    expect(diagnostic).toMatchObject({
      code: "BLUME_CONFIG_INVALID",
      file,
      message:
        "blume.config.ts has no default export, so Blume can't read its config.",
    });
    expect(diagnostic.suggestion).toContain("export default defineConfig(");
  });

  it("still reads a default export, in ESM or CommonJS", async () => {
    const esm = await load('export default { title: "Esm" };\n');
    const cjs = await load(
      'module.exports = { title: "Cjs" };\n',
      "blume.config.js"
    );
    expect(esm.result).toMatchObject({ config: { title: "Esm" } });
    expect(cjs.result).toMatchObject({ config: { title: "Cjs" } });
  });
});
