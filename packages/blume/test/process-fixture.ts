import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import { join } from "pathe";

/** Add a temporary executable directory to PATH without assuming POSIX syntax. */
export const pathWithBin = (binDir: string): string =>
  `${binDir}${nodePath.delimiter}${process.env.PATH ?? ""}`;

/** An environment variable name as the platform compares it. */
const fold = (name: string): string =>
  process.platform === "win32" ? name.toUpperCase() : name;

/**
 * The test's environment with `overrides` applied, for a subprocess. Windows
 * names are case-insensitive and PATH is inherited as `Path`, so spreading
 * `{ ...process.env, PATH }` hands the child both; libuv sorts that block
 * case-insensitively, and which of the two the child reads then shifts with
 * whatever else the environment holds — a fake `npm` drops off PATH once an
 * earlier suite leaves a variable behind. Each overridden name is dropped in
 * every spelling first.
 */
export const envWith = (overrides: Record<string, string>) => {
  const replaced = new Set(Object.keys(overrides).map(fold));
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !replaced.has(fold(name)))
    ),
    ...overrides,
  };
};

/**
 * A PATH on which no agent CLI can be found: a fresh, empty directory and
 * nothing else. The directory holding the test runtime is exactly where a
 * global `claude`/`codex` install lands (`~/.bun/bin`, Homebrew's bin), so it
 * must never stand in for "empty".
 */
export const pathWithoutAgents = (): Promise<string> =>
  mkdtemp(join(tmpdir(), "blume-empty-path-"));

/**
 * Write a tiny executable that works in both shells used by the test runner.
 *
 * POSIX executes the extensionless file through its Node shebang. Windows uses
 * a `.cmd` shim because PATH lookup does not consider extensionless files.
 * The source is CommonJS so the same file can be launched by Node or Bun on
 * either platform.
 */
export const writeExecutable = async (
  dir: string,
  name: string,
  source: string
): Promise<string> => {
  const script = join(dir, name);
  await writeFile(script, `#!/usr/bin/env node\n${source}\n`, "utf-8");
  if (process.platform === "win32") {
    const shim = `${script}.cmd`;
    await writeFile(
      shim,
      `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`,
      "utf-8"
    );
    return shim;
  }
  await chmod(script, 0o755);
  return script;
};
