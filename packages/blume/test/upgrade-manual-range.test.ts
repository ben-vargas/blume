import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import {
  bumpBlumeDependency,
  collectUpgradeFindings,
  manualBumpAdvice,
} from "../src/upgrade/upgrade.ts";

/**
 * Two gaps a Blume 1 project hit on its first `blume upgrade`: a `blume` range
 * whose version lives elsewhere (a pnpm catalog, an `npm:` alias) was reported
 * as current, and `content.root` beside `content.sources` only surfaced once
 * the 1.x `{ type }` source entries were fixed.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const project = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-upgrade-manual-"));
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

const packageJson = (blume: string): string =>
  `${JSON.stringify({ dependencies: { blume }, name: "docs" }, null, 2)}\n`;

describe("bumpBlumeDependency with a range it can't rewrite", () => {
  it.each([
    "catalog:",
    "catalog:docs",
    "npm:blume@^1.7.3",
    "npm:@acme/blume@1",
  ])("reports %s as manual and leaves package.json alone", async (range) => {
    const root = await project({ "package.json": packageJson(range) });
    expect(await bumpBlumeDependency(root, "2.0.1")).toEqual({
      range,
      status: "manual",
    });
    expect(await readFile(join(root, "package.json"), "utf-8")).toBe(
      packageJson(range)
    );
  });

  it("treats an alias already on the major, or with no version, as current", async () => {
    for (const range of ["npm:blume@^2.0.0", "npm:blume"]) {
      // oxlint-disable-next-line no-await-in-loop -- two tiny fixtures
      const root = await project({ "package.json": packageJson(range) });
      // oxlint-disable-next-line no-await-in-loop -- two tiny fixtures
      expect(await bumpBlumeDependency(root, "2.0.1")).toEqual({
        range,
        status: "current",
      });
    }
  });
});

describe("manualBumpAdvice", () => {
  it("points a catalog range at its pnpm-workspace.yaml entry", () => {
    expect(manualBumpAdvice("catalog:", "2.0.1")).toBe(
      "package.json takes blume from the pnpm catalog (`catalog:`), which `blume upgrade` can't bump: set blume to ^2.0.1 under `catalog` in pnpm-workspace.yaml if it isn't already, then reinstall."
    );
    expect(manualBumpAdvice("catalog:default", "2.0.1")).toContain(
      "under `catalog` in pnpm-workspace.yaml"
    );
    expect(manualBumpAdvice("catalog:docs", "2.0.1")).toContain(
      "under `catalogs.docs` in pnpm-workspace.yaml"
    );
  });

  it("points an alias at its own version", () => {
    expect(manualBumpAdvice("npm:blume@^1.7.3", "2.0.1")).toBe(
      "package.json installs blume through the alias `npm:blume@^1.7.3`, which `blume upgrade` doesn't rewrite: set the alias's version to ^2.0.1, then reinstall."
    );
  });
});

describe("collectUpgradeFindings on a Blume 1 content block", () => {
  it("lists content.root beside the 1.x sources on the first run", async () => {
    const root = await project({
      "blume.config.ts": `export default {
  content: {
    root: "content",
    sources: [
      { root: "content", type: "filesystem" },
      { owner: "acme", repo: "docs", type: "github-releases" },
    ],
  },
};
`,
      "content/index.md": "# Home\n",
    });
    const findings = await collectUpgradeFindings(root);
    expect(
      findings.map((finding) => [finding.code, finding.line])
    ).toStrictEqual([
      ["BLUME_CONFIG_INVALID", 3],
      // Each 1.x source entry is reported at its own line in the array.
      ["BLUME_CONFIG_INVALID", 5],
      ["BLUME_CONFIG_INVALID", 6],
    ]);
    expect(findings[0]?.message).toContain(
      "content.root is shorthand for a single filesystem() source and can't be combined with content.sources"
    );
  });
});

describe("blume upgrade with a catalog range", () => {
  it("says what to change and doesn't report the project ready", async () => {
    const root = await project({
      "blume.config.ts": 'export default { title: "Docs" };\n',
      "docs/index.md": "# Home\n",
      "package.json": packageJson("catalog:"),
    });
    const env = { ...process.env };
    // `bun test` sets NODE_ENV=test, which lowers consola's log level.
    delete env.NODE_ENV;
    const proc = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "cli", "index.ts"),
        "upgrade",
      ],
      { cwd: root, env, stderr: "pipe", stdout: "pipe" }
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const output = stdout + stderr;
    expect(exitCode).toBe(1);
    expect(output).toContain("takes blume from the pnpm catalog");
    expect(output).toContain("check out for Blume");
    expect(output).not.toContain("Ready for Blume");
    expect(output).not.toContain("Bumped");
  });
});
