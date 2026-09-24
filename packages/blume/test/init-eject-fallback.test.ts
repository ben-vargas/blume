import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { pathWithBin, writeExecutable } from "./process-fixture.ts";

/**
 * `blume init --eject` when the eject step fails: after a skipped install the
 * likely cause is the missing dependencies, but after an install that ran the
 * warning reports the eject's own error instead of blaming them.
 */

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

const dirs: string[] = [];
/** A fake `npm` whose install "succeeds" without installing anything. */
let bin: string;

const tempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};

beforeAll(async () => {
  bin = await tempDir("blume-init-eject-bin-");
  await writeExecutable(bin, "npm", "process.exit(0);");
});

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

/**
 * `init site --eject` over a `site/blume.config.ts` that fails validation:
 * `init` keeps the existing file, so the eject that loads it fails for a
 * reason that has nothing to do with dependencies.
 */
const initEject = async (
  ...args: string[]
): Promise<{ exitCode: number; output: string }> => {
  const cwd = await tempDir("blume-init-eject-");
  await mkdir(join(cwd, "site"));
  await writeFile(
    join(cwd, "site", "blume.config.ts"),
    "export default { lastModified: true };\n"
  );
  const env = { ...process.env, PATH: pathWithBin(bin) };
  // `bun test` sets NODE_ENV=test, which lowers consola's log level.
  delete env.NODE_ENV;
  const proc = Bun.spawn(
    [
      process.execPath,
      CLI,
      "init",
      "site",
      "--yes",
      "--eject",
      "--package-manager",
      "npm",
      ...args,
    ],
    { cwd, env, stderr: "pipe", stdout: "pipe" }
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, output: stdout + stderr };
};

describe("blume init --eject when the eject fails", () => {
  it("reports the eject's own error after an install that ran", async () => {
    const { exitCode, output } = await initEject();
    expect(exitCode).toBe(0);
    expect(output).toContain("Scaffolded, but eject failed:");
    expect(output).toContain("lastModified");
    expect(output).not.toContain("needs the project's dependencies installed");
    expect(output).toContain("npx blume eject --yes");
  });

  it("names the skipped install as the reason with --no-install", async () => {
    const { exitCode, output } = await initEject("--no-install");
    expect(exitCode).toBe(0);
    expect(output).toContain(
      "Scaffolded, but eject needs the project's dependencies installed to load blume.config.ts:"
    );
    expect(output).toContain("npm install");
  });
});
