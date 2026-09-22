import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

const dirs: string[] = [];
/** Directory holding a fake `npm` that records its cwd and exits as told. */
let bin: string;

const tempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};

/**
 * Run `blume init` through the public CLI entrypoint with the fake `npm`
 * first on PATH, so the install step never touches the network.
 */
const runInit = async (
  cwd: string,
  args: string[],
  env: Record<string, string> = {}
) => {
  const childEnv = {
    ...process.env,
    ...env,
    PATH: `${bin}:${process.env.PATH}`,
  };
  // `bun test` sets NODE_ENV=test, which lowers consola's default log level
  // and silences the install progress and next-steps box asserted on below.
  delete childEnv.NODE_ENV;
  const proc = Bun.spawn([process.execPath, CLI, "init", ...args], {
    cwd,
    env: childEnv,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, stderr, stdout };
};

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false
  );

beforeAll(async () => {
  bin = await tempDir("blume-init-command-bin-");
  const script = join(bin, "npm");
  await writeFile(
    script,
    '#!/bin/sh\n: > "$PWD/installed.marker"\necho "fake npm $*"\n[ -n "$FAKE_NPM_EXIT" ] && exit "$FAKE_NPM_EXIT"\nexit 0\n'
  );
  await chmod(script, 0o755);
});

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

describe("blume init", () => {
  it("ignores installed dependencies in a new project", async () => {
    const root = await tempDir("blume-init-command-");
    const project = join(root, "site");

    const { exitCode, stderr } = await runInit(root, [
      project,
      "--yes",
      "--no-install",
    ]);

    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
    expect(await readFile(join(project, ".gitignore"), "utf-8")).toBe(
      "node_modules/\n.blume/\ndist/\n"
    );
    expect(await exists(join(project, "installed.marker"))).toBe(false);
  });

  it("installs dependencies with the chosen package manager by default", async () => {
    const root = await tempDir("blume-init-command-");

    const { exitCode, stderr, stdout } = await runInit(root, [
      "site",
      "--yes",
      "--package-manager",
      "npm",
    ]);

    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
    expect(await exists(join(root, "site", "installed.marker"))).toBe(true);
    // The install output streams through, and the next steps no longer tell
    // the user to install what has just been installed.
    expect(stdout).toContain("fake npm install");
    expect(stdout).toContain("Installed dependencies");
    expect(stdout).toContain("cd site");
    expect(stdout).toContain("npm run dev");
    // The box frames each line, so match the bare command, not the line.
    expect(stdout).not.toMatch(/│\s+npm install\s+│/u);
  });

  it("keeps the scaffold and prints the retry command when the install fails", async () => {
    const root = await tempDir("blume-init-command-");

    const { exitCode, stderr, stdout } = await runInit(
      root,
      ["site", "--yes", "--package-manager", "npm"],
      { FAKE_NPM_EXIT: "3" }
    );

    expect(exitCode).toBe(1);
    expect(stderr).toContain("npm install exited with code 3");
    expect(stdout).toContain(
      "Project created successfully, but dependency installation failed."
    );
    expect(stdout).toMatch(/│\s+cd site\s+│\n\s*│\s+npm install\s+│/u);
    expect(await exists(join(root, "site", "package.json"))).toBe(true);
    expect(await exists(join(root, "site", "blume.config.ts"))).toBe(true);
  });

  it("skips the install when package.json already exists", async () => {
    const root = await tempDir("blume-init-command-");
    await writeFile(join(root, "package.json"), '{ "name": "existing" }\n');

    const { exitCode, stderr, stdout } = await runInit(root, [
      "--yes",
      "--package-manager",
      "npm",
    ]);

    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
    expect(await exists(join(root, "installed.marker"))).toBe(false);
    expect(stdout).not.toContain("Installing dependencies");
  });
});
