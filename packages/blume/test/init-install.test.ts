import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { installDependencies } from "../src/cli/init/install.ts";

/**
 * A fake `npm` on PATH: writes a marker in its cwd, echoes, and exits with
 * the code the test asks for through the FAKE_NPM_EXIT environment variable.
 */
let bin: string;
let project: string;
const originalPath = process.env.PATH;

beforeAll(async () => {
  bin = await mkdtemp(join(tmpdir(), "blume-init-install-bin-"));
  project = await mkdtemp(join(tmpdir(), "blume-init-install-project-"));
  const script = join(bin, "npm");
  await writeFile(
    script,
    '#!/bin/sh\n: > "$PWD/installed.marker"\necho "fake npm $*"\necho "fake warning" >&2\n[ -n "$FAKE_NPM_EXIT" ] && exit "$FAKE_NPM_EXIT"\nexit 0\n'
  );
  await chmod(script, 0o755);
});

afterEach(() => {
  process.env.PATH = originalPath;
  delete process.env.FAKE_NPM_EXIT;
});

afterAll(async () => {
  await Promise.all([
    rm(bin, { force: true, recursive: true }),
    rm(project, { force: true, recursive: true }),
  ]);
});

describe("installDependencies", () => {
  it("runs the package manager's install in the project root", async () => {
    process.env.PATH = bin;
    const outcome = await installDependencies(project, "npm", { quiet: true });
    expect(outcome).toEqual({ command: "npm install" });
    const marker = await stat(join(project, "installed.marker"));
    expect(marker.isFile()).toBe(true);
  });

  it("streams output when not quiet", async () => {
    process.env.PATH = bin;
    const outcome = await installDependencies(project, "npm", {
      quiet: false,
    });
    expect(outcome).toEqual({ command: "npm install" });
  });

  it("reports a non-zero exit with the captured output", async () => {
    process.env.PATH = bin;
    process.env.FAKE_NPM_EXIT = "7";
    const outcome = await installDependencies(project, "npm", { quiet: true });
    expect(outcome).toEqual({
      command: "npm install",
      failure: "npm install exited with code 7\nfake npm install\nfake warning",
    });
  });

  it("reports a missing package manager instead of throwing", async () => {
    process.env.PATH = project;
    const outcome = await installDependencies(project, "npm", { quiet: true });
    expect(outcome.command).toBe("npm install");
    // Node reports `spawn npm ENOENT`; Bun words it differently, but both name the binary.
    expect(outcome.failure).toContain("npm");
  });
});
