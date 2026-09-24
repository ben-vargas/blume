import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import {
  pathWithBin,
  pathWithoutAgents,
  writeExecutable,
} from "./process-fixture.ts";

/**
 * `blume migrate` end-to-end as a subprocess: source naming and detection,
 * and the handoff, with fake `claude`/`codex` executables recording the
 * prompt instead of a real agent.
 */

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const fixture = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-migrate-cmd-"));
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

const migrate = async (
  cwd: string,
  env: Record<string, string>,
  ...args: string[]
): Promise<{ exitCode: number; stderr: string }> => {
  // `process.execPath`, not `"bun"`: the agent tests replace PATH, and the
  // CLI still has to be launchable without one.
  const proc = Bun.spawn([process.execPath, CLI, "migrate", ...args], {
    cwd,
    env: { ...process.env, ...env },
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, stderr };
};

/** A fake agent that records the prompt it was launched with. */
const fakeAgent = async (
  root: string,
  name: string,
  exitCode = 0
): Promise<string> => {
  const dir = join(root, "fake-bin");
  await mkdir(dir, { recursive: true });
  await writeExecutable(
    dir,
    name,
    `const fs = require("node:fs");
const path = require("node:path");
const handoff = process.argv[2] ?? "";
const pointer = /^Read (.+) and follow its instructions exactly\\.$/u.exec(handoff)?.[1];
const prompt = pointer ? fs.readFileSync(pointer, "utf8") : handoff;
fs.writeFileSync(path.join(__dirname, "prompt.txt"), prompt);
process.exit(${exitCode});`
  );
  return dir;
};

const FUMADOCS = {
  "content/docs/index.mdx": "# Home\n",
  "package.json": JSON.stringify({ dependencies: { "fumadocs-core": "^16" } }),
};

describe("blume migrate", () => {
  it("detects the source and hands the skill to Claude Code", async () => {
    const root = await fixture(FUMADOCS);
    const bin = await fakeAgent(root, "claude");
    const { exitCode, stderr } = await migrate(
      root,
      { PATH: pathWithBin(bin) },
      "--claude"
    );
    expect(exitCode).toBe(0);
    expect(stderr).toContain(
      "Migrating from Fumadocs (detected from fumadocs-core in package.json)."
    );
    expect(stderr).toContain("Handing the migration to Claude Code");
    const prompt = await readFile(join(bin, "prompt.txt"), "utf-8");
    expect(prompt).toContain(join("skills", "blume-migrate", "SKILL.md"));
    expect(prompt).toContain(join("references", "fumadocs.md"));
  });

  it("uses a named source with Codex", async () => {
    const root = await fixture({ "docs.json": "{}" });
    const bin = await fakeAgent(root, "codex");
    const { exitCode, stderr } = await migrate(
      root,
      { PATH: pathWithBin(bin) },
      "docusaurus",
      "--codex"
    );
    expect(exitCode).toBe(0);
    expect(stderr).toContain("Migrating from Docusaurus.");
    const prompt = await readFile(join(bin, "prompt.txt"), "utf-8");
    expect(prompt).toContain(join("references", "docusaurus.md"));
  });

  it("asks the agent to inventory a repo it can't place", async () => {
    const root = await fixture({ "README.md": "# Docs\n" });
    const bin = await fakeAgent(root, "claude");
    const { exitCode, stderr } = await migrate(
      root,
      { PATH: pathWithBin(bin) },
      "--claude"
    );
    expect(exitCode).toBe(0);
    expect(stderr).toContain("Couldn't detect the docs framework");
    const prompt = await readFile(join(bin, "prompt.txt"), "utf-8");
    expect(prompt).toContain("wasn't detected");
  });

  it("passes the agent's failing exit code through", async () => {
    const root = await fixture(FUMADOCS);
    const bin = await fakeAgent(root, "claude", 2);
    const { exitCode } = await migrate(
      root,
      { PATH: pathWithBin(bin) },
      "--claude"
    );
    expect(exitCode).toBe(2);
  });

  it("points any other agent at the skill without an agent flag", async () => {
    const root = await fixture(FUMADOCS);
    const { exitCode, stderr } = await migrate(root, {});
    expect(exitCode).toBe(0);
    expect(stderr).toContain("rerun with --codex or --claude");
    expect(stderr).toContain("Point it at");
    expect(stderr).toContain(join("skills", "blume-migrate", "SKILL.md"));
    expect(stderr).toContain(
      "npx skills add haydenbleasel/blume --skill blume-migrate"
    );
  });

  it("warns when the named source disagrees with the repo", async () => {
    const root = await fixture(FUMADOCS);
    const { exitCode, stderr } = await migrate(root, {}, "docusaurus");
    expect(exitCode).toBe(0);
    expect(stderr).toContain("Migrating from Docusaurus.");
    expect(stderr).toContain(
      "Warning: this looks like a Fumadocs project (fumadocs-core in package.json); migrating from Docusaurus as named."
    );
  });

  it("stays quiet when the named source matches the repo", async () => {
    const root = await fixture(FUMADOCS);
    const { stderr } = await migrate(root, {}, "fumadocs");
    expect(stderr).toContain("Migrating from Fumadocs.");
    expect(stderr).not.toContain("Warning:");
  });

  it("rejects an unknown source", async () => {
    const root = await fixture({});
    const { exitCode, stderr } = await migrate(root, {}, "hugo", "--claude");
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Unknown source "hugo"');
  });

  it("refuses both agents at once", async () => {
    const root = await fixture(FUMADOCS);
    const { exitCode, stderr } = await migrate(root, {}, "--claude", "--codex");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Pass at most one of --codex or --claude.");
  });

  it("explains how to install a missing agent CLI", async () => {
    const root = await fixture(FUMADOCS);
    const { exitCode, stderr } = await migrate(
      root,
      { PATH: await pathWithoutAgents() },
      "--codex"
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("was not found on PATH");
  });
});
