import { afterAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

/**
 * `blume preview` as a subprocess. Astro previews a server build through its
 * adapter's preview entrypoint, which the Vercel and Netlify adapters don't
 * declare: the command says so, with what to run instead, rather than letting
 * Astro throw and the CLI report it as an internal error.
 */

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

/** A project deploying with the `kind` adapter, as its plain descriptor. */
const project = async (
  kind: string,
  options: Record<string, string> = {}
): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-preview-cmd-"));
  dirs.push(root);
  const deployment = { kind, options, requiredSecrets: [], runtimeDeps: [] };
  await writeFile(
    join(root, "blume.config.ts"),
    `export default { deployment: ${JSON.stringify(deployment)} };\n`
  );
  return root;
};

const preview = async (
  cwd: string
): Promise<{ exitCode: number; output: string }> => {
  const env = { ...process.env, NO_COLOR: "1" };
  // `bun test` sets NODE_ENV=test, which lowers consola's log level.
  delete env.NODE_ENV;
  const proc = Bun.spawn(["bun", CLI, "preview"], {
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
  return { exitCode, output: `${stdout}${stderr}` };
};

describe("blume preview", () => {
  it.each([
    ["vercel", "@astrojs/vercel", "vercel deploy"],
    ["netlify", "@astrojs/netlify", "netlify deploy"],
  ])(
    "explains that a %s() server build can't be previewed locally",
    async (kind, adapter, deploy) => {
      const { exitCode, output } = await preview(await project(kind));
      expect(exitCode).toBe(1);
      expect(output).toContain(
        `can't serve a ${kind}() server build: ${adapter} has no local preview server.`
      );
      // consola's fancy reporter renders backticks as color, its CI reporter
      // prints them, so match the commands either way.
      expect(output).toMatch(/Run `?blume dev`? to try the site locally/u);
      expect(output).toMatch(
        new RegExp(`deploy a preview with \`?${deploy}\`?\\.`, "u")
      );
      expect(output).not.toContain("BLUME_INTERNAL");
    }
  );

  it("previews a static build on those hosts, and a node() server build", async () => {
    // Both reach the build check: no refusal, just nothing built yet.
    for (const root of [
      await project("vercel", { output: "static" }),
      await project("node"),
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- two short subprocesses
      const { exitCode, output } = await preview(root);
      expect(exitCode).toBe(1);
      expect(output).toContain("No build found.");
      expect(output).not.toContain("can't serve");
    }
  });
});
