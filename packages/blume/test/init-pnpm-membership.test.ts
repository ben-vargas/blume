import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import {
  outsidePnpmWorkspace,
  workspaceNote,
} from "../src/cli/init/scaffold.ts";
import type { InitAnswers } from "../src/cli/init/scaffold.ts";
import { pathWithBin, writeExecutable } from "./process-fixture.ts";

/**
 * pnpm installs only the packages a workspace's `packages` globs list (and the
 * workspace root). `init` in a folder the enclosing workspace doesn't list must
 * say to add it, not claim the project joined, and not run an install that
 * would exit 0 without installing blume.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const tempDir = async (prefix = "blume-pnpm-membership-"): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};

/** A pnpm workspace whose `pnpm-workspace.yaml` holds `yaml`. */
const workspace = async (yaml: string): Promise<string> => {
  const root = await tempDir();
  await writeFile(join(root, "pnpm-workspace.yaml"), yaml);
  return root;
};

const answers = (overrides: Partial<InitAnswers> = {}): InitAnswers => ({
  contentDir: "docs",
  directory: "docs",
  packageManager: "pnpm",
  sources: ["filesystem"],
  template: "docs",
  title: "My Docs",
  ...overrides,
});

describe("outsidePnpmWorkspace", () => {
  it("is false for a folder the packages globs list", async () => {
    const root = await workspace(
      "packages:\n  - ./apps/*/\n  - 'packages/**'\n  - docs\n"
    );
    expect(outsidePnpmWorkspace(join(root, "apps", "web"), answers())).toBe(
      false
    );
    expect(
      outsidePnpmWorkspace(join(root, "packages", "a", "b"), answers())
    ).toBe(false);
    expect(outsidePnpmWorkspace(join(root, "docs"), answers())).toBe(false);
  });

  it("is true for a folder no glob lists, or one a `!` glob excludes", async () => {
    const root = await workspace("packages:\n  - apps/*\n  - '!apps/legacy'\n");
    expect(outsidePnpmWorkspace(join(root, "docs"), answers())).toBe(true);
    expect(outsidePnpmWorkspace(join(root, "apps", "legacy"), answers())).toBe(
      true
    );
  });

  it("lists only the root when packages is omitted", async () => {
    const root = await workspace("allowBuilds:\n  esbuild: true\n");
    expect(outsidePnpmWorkspace(root, answers())).toBe(false);
    expect(outsidePnpmWorkspace(join(root, "docs"), answers())).toBe(true);
    // An empty file is a workspace with no packages either.
    const empty = await workspace("");
    expect(outsidePnpmWorkspace(join(empty, "docs"), answers())).toBe(true);
  });

  it("claims nothing about a workspace file it can't read", async () => {
    const unparseable = await workspace("packages: [apps/*\n");
    expect(outsidePnpmWorkspace(join(unparseable, "docs"), answers())).toBe(
      false
    );
    const notAList = await workspace("packages: apps/*\n");
    expect(outsidePnpmWorkspace(join(notAList, "docs"), answers())).toBe(false);
  });

  it("is false outside a workspace, and for other package managers", async () => {
    expect(outsidePnpmWorkspace(await tempDir(), answers())).toBe(false);
    const root = await workspace("packages:\n  - apps/*\n");
    expect(
      outsidePnpmWorkspace(
        join(root, "docs"),
        answers({ packageManager: "npm" })
      )
    ).toBe(false);
  });
});

describe("workspaceNote in a workspace that doesn't list the folder", () => {
  it("says to add the folder, and to approve esbuild when it isn't", async () => {
    const root = await workspace("packages:\n  - apps/*\n");
    const file = join(root, "pnpm-workspace.yaml");
    const note = workspaceNote(join(root, "sites", "docs"), answers());
    expect(note).toContain(
      `sits inside the pnpm workspace at ${file}, which doesn't list it under packages`
    );
    expect(note).toContain("  packages:\n    - sites/docs\n  allowBuilds:");
    expect(note).toContain("esbuild: true");
    expect(note).not.toContain("joins");
  });

  it("asks only for the packages entry once esbuild is approved", async () => {
    const root = await workspace(
      "packages:\n  - apps/*\nallowBuilds:\n  esbuild: true\n"
    );
    const note = workspaceNote(join(root, "docs"), answers());
    expect(note).toEndWith("  packages:\n    - docs");
    expect(note).not.toContain("allowBuilds");
  });
});

describe("blume init in a pnpm workspace that doesn't list the folder", () => {
  let bin: string;

  beforeAll(async () => {
    // A fake `pnpm` that records the install, so the test can tell whether
    // `init` ran one.
    bin = await tempDir("blume-pnpm-membership-bin-");
    await writeExecutable(
      bin,
      "pnpm",
      `require("node:fs").writeFileSync(require("node:path").join(process.cwd(), "installed.marker"), "");`
    );
  });

  it("skips the install and says to add the folder first", async () => {
    const root = await workspace("packages:\n  - apps/*\n");
    const env = { ...process.env, PATH: pathWithBin(bin) };
    // `bun test` sets NODE_ENV=test, which lowers consola's log level.
    delete env.NODE_ENV;
    const proc = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "cli", "index.ts"),
        "init",
        "docs",
        "--yes",
        "--package-manager",
        "pnpm",
      ],
      { cwd: root, env, stderr: "pipe", stdout: "pipe" }
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const output = stdout + stderr;

    expect(exitCode).toBe(0);
    expect(output).toContain("doesn't list it under packages");
    expect(output).not.toContain("joins the pnpm workspace");
    expect(output).not.toContain("Installed dependencies");
    const installed = await stat(join(root, "docs", "installed.marker")).then(
      () => true,
      () => false
    );
    expect(installed).toBe(false);
    // The next steps install once the folder is listed.
    expect(output).toContain("pnpm install");
    // The workspace's own file is left for the user to edit.
    expect(await readFile(join(root, "pnpm-workspace.yaml"), "utf-8")).toBe(
      "packages:\n  - apps/*\n"
    );
  });
});
