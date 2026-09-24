import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

/**
 * A Yarn Plug'n'Play project stops before any scan or Astro work with a
 * diagnostic naming the `.yarnrc.yml` fix, rather than failing inside Astro's
 * config load. Run in a subprocess so the command modules stay out of the
 * coverage run, like the other command suites.
 */

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

describe("a Yarn Plug'n'Play project", () => {
  it("stops `blume build` with the nodeLinker fix", async () => {
    const root = await mkdtemp(join(tmpdir(), "blume-pnp-cli-"));
    dirs.push(root);
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "index.md"), "# Home\n");
    await writeFile(join(root, ".pnp.cjs"), "");
    const env = { ...process.env };
    delete env.NODE_ENV;
    const proc = Bun.spawn([process.execPath, CLI, "build"], {
      cwd: root,
      env,
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const output = stdout + stderr;
    expect(exitCode).toBe(1);
    expect(output).toContain("BLUME_YARN_PNP");
    expect(output).toContain("nodeLinker: node-modules");
  });
});
