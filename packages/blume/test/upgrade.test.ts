import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import {
  UPGRADE_GUIDE_URL,
  bumpBlumeDependency,
  collectUpgradeFindings,
  rangeMajor,
  upgradePrompt,
} from "../src/upgrade/upgrade.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const project = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-upgrade-"));
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

const packageJson = (deps: Record<string, Record<string, string>>): string =>
  `${JSON.stringify({ name: "docs", private: true, ...deps }, null, 2)}\n`;

describe("rangeMajor", () => {
  it("reads the major a range pins", () => {
    expect(rangeMajor("^1.7.3")).toBe(1);
    expect(rangeMajor("~1.2.0")).toBe(1);
    expect(rangeMajor(">=1 <2")).toBe(1);
    expect(rangeMajor("v2.0.0")).toBe(2);
    expect(rangeMajor("2")).toBe(2);
  });

  it("returns null for a range that names no version", () => {
    expect(rangeMajor("workspace:*")).toBeNull();
    expect(rangeMajor("workspace:^1.0.0")).toBeNull();
    expect(rangeMajor("latest")).toBeNull();
    expect(rangeMajor("*")).toBeNull();
  });
});

describe("bumpBlumeDependency", () => {
  it("reports a project with no package.json as missing", async () => {
    const root = await project({});
    expect(await bumpBlumeDependency(root, "2.0.0")).toEqual({
      status: "missing",
    });
  });

  it("reports a package.json that doesn't list blume as missing", async () => {
    const root = await project({
      "package.json": packageJson({ dependencies: { astro: "^7.0.0" } }),
    });
    expect(await bumpBlumeDependency(root, "2.0.0")).toEqual({
      status: "missing",
    });
  });

  it("bumps an older major in dependencies and keeps the rest", async () => {
    const root = await project({
      "package.json": packageJson({
        dependencies: { blume: "^1.7.3", react: "^19.2.0" },
      }),
    });
    expect(await bumpBlumeDependency(root, "2.0.0")).toEqual({
      field: "dependencies",
      from: "^1.7.3",
      status: "bumped",
      to: "^2.0.0",
    });
    const written = JSON.parse(
      await readFile(join(root, "package.json"), "utf-8")
    );
    expect(written.dependencies).toEqual({ blume: "^2.0.0", react: "^19.2.0" });
    expect(written.name).toBe("docs");
  });

  it("bumps a devDependency and keeps the file's indentation", async () => {
    const root = await project({
      "package.json": `${JSON.stringify({ devDependencies: { blume: "~1.2.0" } }, null, 4)}\n`,
    });
    const bump = await bumpBlumeDependency(root, "2.1.0");
    expect(bump).toMatchObject({ field: "devDependencies", status: "bumped" });
    const text = await readFile(join(root, "package.json"), "utf-8");
    expect(text).toBe(
      `${JSON.stringify({ devDependencies: { blume: "^2.1.0" } }, null, 4)}\n`
    );
  });

  it("leaves a range already on the major alone", async () => {
    const root = await project({
      "package.json": packageJson({ dependencies: { blume: "^2.1.0" } }),
    });
    expect(await bumpBlumeDependency(root, "2.0.0")).toEqual({
      range: "^2.1.0",
      status: "current",
    });
  });

  it("leaves a workspace or tag range to the user", async () => {
    const root = await project({
      "package.json": packageJson({ dependencies: { blume: "workspace:*" } }),
    });
    expect(await bumpBlumeDependency(root, "2.0.0")).toEqual({
      range: "workspace:*",
      status: "current",
    });
  });
});

describe("collectUpgradeFindings", () => {
  it("returns nothing for a project that already fits", async () => {
    const root = await project({
      "blume.config.ts": 'export default { title: "Docs" };\n',
      "docs/index.md": "# Home\n",
    });
    expect(await collectUpgradeFindings(root)).toEqual([]);
  });

  it("reports a Blume 1 config with each replacement", async () => {
    const root = await project({
      "blume.config.ts": `export default {
  search: { provider: "pagefind" },
  lastModified: true,
};
`,
    });
    const findings = await collectUpgradeFindings(root);
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.code).toBe("BLUME_CONFIG_INVALID");
    expect(finding?.message).toContain('adapter from "blume/search"');
    expect(finding?.message).toContain('`true` became "git"');
  });

  it("reports a components.ts entry Blume can't plan", async () => {
    const root = await project({
      "blume.config.ts": "export default {};\n",
      "components.ts":
        'import Counter from "./islands/Counter.tsx";\nexport default { islands: { Counter } };\n',
    });
    const findings = await collectUpgradeFindings(root);
    expect(findings.map((finding) => finding.code)).toEqual([
      "BLUME_COMPONENTS_INVALID",
    ]);
  });

  it("rethrows a failure that isn't a Blume diagnostic", async () => {
    // A directory named like the components file passes the lookup but can't
    // be read — an I/O error, not something the upgrade should report.
    const root = await project({ "blume.config.ts": "export default {};\n" });
    await mkdir(join(root, "components.ts"));
    await expect(collectUpgradeFindings(root)).rejects.toThrow();
  });
});

describe("upgradePrompt", () => {
  it("lists each finding with its location and fix beside the guide", () => {
    const root = "/project";
    const prompt = upgradePrompt({
      findings: [
        {
          code: "BLUME_CONFIG_INVALID",
          file: "/project/blume.config.ts",
          line: 3,
          message: "ai.mcp moved to agents.mcp.\n1 more config issue(s):",
          severity: "error",
        },
        {
          code: "BLUME_COMPONENTS_INVALID",
          file: "/project/components.ts",
          message: "components.ts has 1 override(s) Blume can't plan.",
          severity: "error",
          suggestion: "Import each component.",
        },
        {
          code: "BLUME_CONFIG_LOAD_FAILED",
          message: "Failed to load config.",
          severity: "error",
        },
      ],
      guidePath: "/pkg/docs/03-upgrading.mdx",
      root,
      version: "2.0.0",
    });
    expect(prompt).toContain("Blume 2.0.0");
    expect(prompt).toContain("/pkg/docs/03-upgrading.mdx");
    expect(prompt).toContain(UPGRADE_GUIDE_URL);
    // Location, code, and the message's continuation lines indented under it.
    expect(prompt).toContain(
      "- blume.config.ts:3 (BLUME_CONFIG_INVALID)\n  ai.mcp moved to agents.mcp.\n  1 more config issue(s):"
    );
    expect(prompt).toContain(
      "- components.ts (BLUME_COMPONENTS_INVALID)\n  components.ts has 1 override(s) Blume can't plan.\n  Fix: Import each component."
    );
    // A finding with no file names the config, where every load error lives.
    expect(prompt).toContain("- blume.config.ts (BLUME_CONFIG_LOAD_FAILED)");
    expect(prompt).toContain("blume doctor");
    expect(prompt).toContain("blume build");
  });
});
