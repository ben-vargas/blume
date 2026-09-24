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
 * `blume upgrade` end-to-end as a subprocess: the bump, the report, and the
 * agent handoff, with fake `claude` and `npm` executables standing in for the
 * real CLIs so nothing installs or talks to a model.
 */

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

// SAFETY: blume's own package.json always declares a string `version`.
const { version: CLI_VERSION } = JSON.parse(
  await readFile(join(import.meta.dir, "..", "package.json"), "utf-8")
) as { version: string };

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const fixture = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-upgrade-cmd-"));
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

const upgrade = async (
  cwd: string,
  env: Record<string, string>,
  ...args: string[]
): Promise<{ exitCode: number; stderr: string }> => {
  // `process.execPath`, not `"bun"`: the agent tests replace PATH, and the
  // CLI still has to be launchable without one.
  const proc = Bun.spawn([process.execPath, CLI, "upgrade", ...args], {
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

/** A fake executable that records its argv's prompt and exits with `code`. */
const fakeBin = async (
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
fs.writeFileSync(path.join(__dirname, "${name}.txt"), prompt);
process.exit(${exitCode});`
  );
  return dir;
};

const V1_CONFIG = `export default {
  title: "Docs",
  ai: { mcp: { enabled: true } },
  lastModified: true,
};
`;

const packageJson = (blume: string): string =>
  `${JSON.stringify({ dependencies: { blume }, name: "docs" }, null, 2)}\n`;

describe("blume upgrade", () => {
  it("bumps blume and lists what the config still needs", async () => {
    const root = await fixture({
      "blume.config.ts": V1_CONFIG,
      "docs/index.md": "# Home\n",
      "package.json": packageJson("^0.9.0"),
    });
    const { exitCode, stderr } = await upgrade(root, {}, "--no-install");
    expect(exitCode).toBe(1);
    expect(stderr).toContain(`Bumped blume ^0.9.0 → ^${CLI_VERSION}`);
    expect(stderr).toContain("BLUME_CONFIG_INVALID");
    expect(stderr).toContain("ai.mcp moved to agents.mcp");
    expect(stderr).toContain("https://useblume.dev/docs/upgrading");
    expect(stderr).toContain("--codex or --claude");
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf-8"));
    expect(pkg.dependencies.blume).toBe(`^${CLI_VERSION}`);
  });

  it("reports a project that already fits as ready", async () => {
    const root = await fixture({
      "blume.config.ts": 'export default { title: "Docs" };\n',
      "docs/index.md": "# Home\n",
      "package.json": packageJson(`^${CLI_VERSION}`),
    });
    const { exitCode, stderr } = await upgrade(root, {});
    expect(exitCode).toBe(0);
    expect(stderr).toContain(`Ready for Blume ${CLI_VERSION}`);
    expect(stderr).not.toContain("Bumped");
  });

  it("warns when package.json doesn't list blume", async () => {
    const root = await fixture({
      "blume.config.ts": "export default {};\n",
      "docs/index.md": "# Home\n",
    });
    const { exitCode, stderr } = await upgrade(root, {});
    expect(exitCode).toBe(0);
    expect(stderr).toContain("No `blume` dependency");
  });

  it("refuses a folder with neither a config nor a blume dependency", async () => {
    // A monorepo root, say: the defaults would always pass and report ready.
    const root = await fixture({ "README.md": "# Monorepo\n" });
    const { exitCode, stderr } = await upgrade(root, {});
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No blume.config.ts or `blume` dependency here.");
    expect(stderr).not.toContain("Ready for Blume");
  });

  it("installs after the bump, and keeps going when the install fails", async () => {
    const root = await fixture({
      "blume.config.ts": 'export default { title: "Docs" };\n',
      "docs/index.md": "# Home\n",
      "package.json": packageJson("^0.9.0"),
    });
    const bin = await fakeBin(root, "npm", 1);
    const { exitCode, stderr } = await upgrade(root, {
      PATH: pathWithBin(bin),
      npm_config_user_agent: "npm/10.9.0 node/v22.12.0",
    });
    expect(stderr).toContain("Installing failed; run `npm install` yourself.");
    // The config already fits, so the run still succeeds.
    expect(exitCode).toBe(0);
    expect(stderr).toContain(`Ready for Blume ${CLI_VERSION}`);
  });

  it("hands the findings and the guide to Claude Code", async () => {
    const root = await fixture({
      "blume.config.ts": V1_CONFIG,
      "docs/index.md": "# Home\n",
      "package.json": packageJson(`^${CLI_VERSION}`),
    });
    const bin = await fakeBin(root, "claude");
    const { exitCode, stderr } = await upgrade(
      root,
      { PATH: pathWithBin(bin) },
      "--claude"
    );
    expect(exitCode).toBe(0);
    expect(stderr).toContain("Handing the upgrade to Claude Code");
    const prompt = await readFile(join(bin, "claude.txt"), "utf-8");
    expect(prompt).toContain(
      `Upgrade this Blume project to Blume ${CLI_VERSION}`
    );
    expect(prompt).toContain("03-upgrading.mdx");
    expect(prompt).toContain("- blume.config.ts:");
    expect(prompt).toContain("ai.mcp moved to agents.mcp");
  });

  it("passes the agent's failing exit code through", async () => {
    const root = await fixture({
      "blume.config.ts": V1_CONFIG,
      "docs/index.md": "# Home\n",
      "package.json": packageJson(`^${CLI_VERSION}`),
    });
    const bin = await fakeBin(root, "codex", 3);
    const { exitCode } = await upgrade(
      root,
      { PATH: pathWithBin(bin) },
      "--codex"
    );
    expect(exitCode).toBe(3);
  });

  it("explains how to install a missing agent CLI", async () => {
    const root = await fixture({
      "blume.config.ts": V1_CONFIG,
      "docs/index.md": "# Home\n",
      "package.json": packageJson(`^${CLI_VERSION}`),
    });
    const { exitCode, stderr } = await upgrade(
      root,
      { PATH: await pathWithoutAgents() },
      "--claude"
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("was not found on PATH");
  });

  it("refuses both agents at once", async () => {
    const root = await fixture({ "blume.config.ts": V1_CONFIG });
    const { exitCode, stderr } = await upgrade(root, {}, "--claude", "--codex");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Pass at most one of --codex or --claude.");
  });
});
