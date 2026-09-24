import { afterAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

/** `blume audit --url` as a subprocess: a bad origin is a usage error. */

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

describe("blume audit --url", () => {
  it("rejects a URL with no scheme instead of crashing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "blume-audit-url-"));
    dirs.push(cwd);
    const proc = Bun.spawn(
      [process.execPath, CLI, "audit", "--url", "docs.example.com"],
      { cwd, stderr: "pipe", stdout: "pipe" }
    );
    const [exitCode, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stderr).text(),
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid --url "docs.example.com"');
    expect(stderr).toContain("https://docs.example.com");
    expect(stderr).not.toContain("BLUME_INTERNAL");
  });
});
