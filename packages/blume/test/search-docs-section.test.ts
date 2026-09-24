import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { EN_UI, UI_PACKS } from "../src/core/i18n-ui.ts";
import { scanProject } from "../src/core/project-graph.ts";
import { buildSearchDocuments } from "../src/search/documents.ts";

/**
 * A page in no sidebar group falls under a catch-all section in the search
 * dialog. Its label is the `search.docs` UI string, so it reads in the
 * page's own language like the rest of the dialog.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const scan = async (files: Record<string, string>) => {
  const root = await mkdtemp(join(tmpdir(), "blume-docs-section-"));
  dirs.push(root);
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, "utf-8");
    })
  );
  return await scanProject(root);
};

const sectionOf = async (
  files: Record<string, string>
): Promise<Record<string, string | undefined>> => {
  const documents = await buildSearchDocuments(await scan(files));
  return Object.fromEntries(
    documents.map((document) => [document.route, document.section])
  );
};

describe("the catch-all search section", () => {
  it("reads Docs on a single-language site", async () => {
    expect(EN_UI.search.docs).toBe("Docs");
    const sections = await sectionOf({ "docs/intro.md": "# Intro\n" });
    expect(sections["/intro"]).toBe("Docs");
  });

  it("reads in each page's locale, overrides included", async () => {
    const i18n = {
      defaultLocale: "en",
      locales: [
        { code: "en", label: "English" },
        { code: "ja", label: "日本語" },
        { code: "fr", label: "Français" },
      ],
      ui: { fr: { search: { docs: "Guides" } } },
    };
    const sections = await sectionOf({
      "blume.config.ts": `export default { i18n: ${JSON.stringify(i18n)} };\n`,
      "docs/fr/intro.md": "# Intro\n",
      "docs/intro.md": "# Intro\n",
      "docs/ja/intro.md": "# はじめに\n",
    });
    expect(sections["/intro"]).toBe("Docs");
    expect(sections["/ja/intro"]).toBe(UI_PACKS.ja?.search?.docs);
    expect(sections["/fr/intro"]).toBe("Guides");
  });

  it("is translated in every shipped pack", () => {
    for (const [code, pack] of Object.entries(UI_PACKS)) {
      expect(
        pack.search?.docs,
        `pack "${code}" misses search.docs`
      ).toBeTruthy();
    }
  });
});
