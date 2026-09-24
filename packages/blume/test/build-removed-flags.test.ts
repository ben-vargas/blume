import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

/**
 * `blume build`'s fail-fast checks, before any Astro work: the Blume 1
 * `--adapter`/`--output`/`--base` flags (which citty would otherwise accept
 * and ignore, shipping a static site) and the server-feature gate's advice
 * for a static build. Exercised in subprocesses so the command module stays
 * out of the coverage run, like the other command suites.
 */

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const fixture = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-build-flags-"));
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

const build = async (
  cwd: string,
  ...args: string[]
): Promise<{ exitCode: number; output: string }> => {
  // `bun test` sets NODE_ENV=test, which lowers consola's log level.
  const env = { ...process.env };
  delete env.NODE_ENV;
  const proc = Bun.spawn([process.execPath, CLI, "build", ...args], {
    cwd,
    env,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, output: stdout + stderr };
};

const MCP_CONFIG = (deployment: string) =>
  `export default { agents: { mcp: { enabled: true } }${deployment} };\n`;

describe("blume build", () => {
  it("refuses the Blume 1 deployment flags instead of ignoring them", async () => {
    const root = await fixture({ "docs/index.md": "# Home\n" });
    const { exitCode, output } = await build(
      root,
      "--adapter",
      "vercel",
      "--output=server",
      "--base",
      "/docs"
    );
    expect(exitCode).toBe(1);
    expect(output).toContain(
      "blume build no longer takes --adapter, --output, --base."
    );
    // consola renders the message's code spans without their backticks.
    expect(output).toContain("deployment: vercel()");
    expect(output).toContain('deployment: { base: "/docs" }');
  });

  it("names a host adapter when a server feature meets a static build", async () => {
    const root = await fixture({
      "blume.config.ts": MCP_CONFIG(""),
      "docs/index.md": "# Home\n",
    });
    const { exitCode, output } = await build(root);
    expect(exitCode).toBe(1);
    expect(output).toContain(
      "MCP server requires server output, but this is a static build."
    );
    expect(output).toContain(
      'Set deployment to a host adapter from "blume/deploy"'
    );
  });

  it('points at a host adapter\'s own `output: "static"`', async () => {
    // The `vercel()` descriptor, inlined: a tmp-dir config can't resolve
    // the package.
    const root = await fixture({
      "blume.config.ts": MCP_CONFIG(
        ', deployment: { kind: "vercel", options: { output: "static" }, requiredSecrets: [], runtimeDeps: [] }'
      ),
      "docs/index.md": "# Home\n",
    });
    const { exitCode, output } = await build(root);
    expect(exitCode).toBe(1);
    expect(output).toContain(
      'Drop `output: "static"` from `deployment: vercel()`'
    );
  });
});
