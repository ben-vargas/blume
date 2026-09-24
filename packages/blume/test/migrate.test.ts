import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import {
  MIGRATE_SOURCES,
  detectMigrateSource,
  isMigrateSource,
  migratePrompt,
} from "../src/migrate/migrate.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const project = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-migrate-"));
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

const deps = (field: string, names: string[]): string =>
  JSON.stringify({
    [field]: Object.fromEntries(names.map((name) => [name, "^1.0.0"])),
  });

describe("isMigrateSource", () => {
  it("accepts each supported framework and nothing else", () => {
    for (const source of MIGRATE_SOURCES) {
      expect(isMigrateSource(source)).toBe(true);
    }
    expect(isMigrateSource("hugo")).toBe(false);
  });
});

describe("detectMigrateSource", () => {
  it("returns null when nothing gives the framework away", async () => {
    expect(await detectMigrateSource(await project({}))).toBeNull();
  });

  it("detects Mintlify from docs.json or mint.json", async () => {
    expect(
      await detectMigrateSource(await project({ "docs.json": "{}" }))
    ).toEqual({ evidence: "docs.json", source: "mintlify" });
    expect(
      await detectMigrateSource(await project({ "mint.json": "{}" }))
    ).toEqual({ evidence: "mint.json", source: "mintlify" });
  });

  it("detects Docusaurus from its config file", async () => {
    expect(
      await detectMigrateSource(
        await project({ "docusaurus.config.ts": "export default {};" })
      )
    ).toEqual({ evidence: "docusaurus.config.ts", source: "docusaurus" });
  });

  it("detects Fumadocs from source.config.ts or its packages", async () => {
    expect(
      await detectMigrateSource(await project({ "source.config.ts": "" }))
    ).toEqual({ evidence: "source.config.ts", source: "fumadocs" });
    expect(
      await detectMigrateSource(
        await project({ "package.json": deps("dependencies", ["fumadocs-ui"]) })
      )
    ).toEqual({ evidence: "fumadocs-ui in package.json", source: "fumadocs" });
  });

  it("detects Nextra and Starlight from their packages", async () => {
    expect(
      await detectMigrateSource(
        await project({ "package.json": deps("dependencies", ["nextra"]) })
      )
    ).toEqual({ evidence: "nextra in package.json", source: "nextra" });
    expect(
      await detectMigrateSource(
        await project({
          "package.json": deps("devDependencies", ["@astrojs/starlight"]),
        })
      )
    ).toEqual({
      evidence: "@astrojs/starlight in package.json",
      source: "starlight",
    });
  });

  it("falls back to file signals when package.json can't be parsed", async () => {
    const root = await project({
      "docs.json": "{}",
      "package.json": "{ not json",
    });
    expect(await detectMigrateSource(root)).toEqual({
      evidence: "docs.json",
      source: "mintlify",
    });
    expect(
      await detectMigrateSource(await project({ "package.json": "{ not json" }))
    ).toBeNull();
  });
});

describe("migratePrompt", () => {
  const skillDir = "/pkg/skills/blume-migrate";

  it("points at the skill and the detected source's mappings", () => {
    const prompt = migratePrompt({
      detected: { evidence: "docs.json", source: "mintlify" },
      skillDir,
      source: "mintlify",
      version: "2.0.0",
    });
    expect(prompt).toContain(
      "Migrate this documentation project to Blume 2.0.0"
    );
    expect(prompt).toContain("/pkg/skills/blume-migrate/SKILL.md");
    expect(prompt).toContain(
      "The source is Mintlify (detected from docs.json). Its exact mappings are in /pkg/skills/blume-migrate/references/mintlify.md."
    );
    expect(prompt).toContain("`blume@^2.0.0`");
  });

  it("names a source the user chose without claiming detection", () => {
    const prompt = migratePrompt({
      detected: { evidence: "docs.json", source: "mintlify" },
      skillDir,
      source: "docusaurus",
      version: "2.0.0",
    });
    expect(prompt).toContain(
      "The source is Docusaurus. Its exact mappings are in /pkg/skills/blume-migrate/references/docusaurus.md."
    );
    expect(prompt).not.toContain("detected from");
  });

  it("asks for an inventory when no source is known", () => {
    const prompt = migratePrompt({
      detected: null,
      skillDir,
      source: null,
      version: "2.0.0",
    });
    expect(prompt).toContain("wasn't detected");
    expect(prompt).toContain(
      "Mintlify, Docusaurus, Fumadocs, Nextra, Starlight"
    );
    expect(prompt).toContain("/pkg/skills/blume-migrate/references");
  });
});
