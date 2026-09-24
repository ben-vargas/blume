import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { discoverContent } from "../src/core/content.ts";
import { buildContentGraph } from "../src/core/graph.ts";
import { discoverFolderMeta } from "../src/core/meta.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { BlumeConfigInput } from "../src/core/schema.ts";
import { resolveDocsCollection } from "../src/core/sources/collection.ts";
import type { NavNode } from "../src/core/types.ts";

/**
 * A locale's sidebar is padded with the fallback locale's untranslated pages,
 * so a group made of them mirrors the fallback locale's group too: its folder
 * meta (title, order, `collapsed`, `display`) and the `sidebar.display` its
 * index page sets — until the locale authors a `meta.ts` of its own. They
 * used to render as flat, English-titled-by-folder groups on every fallback
 * page.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

type I18nInput = Partial<NonNullable<BlumeConfigInput["i18n"]>>;

/** The sidebars per locale for a content tree under the given i18n config. */
const sidebars = async (
  files: Record<string, string>,
  i18n: I18nInput = {}
): Promise<Record<string, NavNode[]>> => {
  const resolved = blumeConfigSchema.parse({
    i18n: {
      defaultLocale: "en",
      locales: [
        { code: "en", label: "English" },
        { code: "fr", label: "Français" },
      ],
      ...i18n,
    },
  });
  const root = await mkdtemp(join(tmpdir(), "blume-i18n-groups-"));
  dirs.push(root);
  const contentRoot = join(root, "docs");
  await Promise.all(
    Object.entries(files).map(async ([rel, content]) => {
      const abs = join(contentRoot, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content);
    })
  );
  const collection = resolveDocsCollection(resolved, contentRoot);
  const { pages } = await discoverContent({
    contentRoot,
    defaultType: resolved.content.defaultType,
    exclude: collection.exclude,
    i18n: resolved.i18n,
    include: collection.include,
  });
  const folderMeta = await discoverFolderMeta(contentRoot);
  const graph = buildContentGraph(pages, {
    folderMeta: folderMeta.meta,
    i18n: resolved.i18n,
    navigation: resolved.navigation,
    sharedFolderMeta: folderMeta.shared,
  });
  return Object.fromEntries(
    Object.entries(graph.navigationByLocale).map(([code, nav]) => [
      code,
      nav.sidebar,
    ])
  );
};

/** The group labeled `label`, stripped to what the sidebar renders. */
const group = (nodes: NavNode[] | undefined, label: string) => {
  const node = (nodes ?? []).find(
    (candidate) => candidate.kind === "group" && candidate.label === label
  );
  return node?.kind === "group"
    ? {
        collapsed: node.collapsed,
        display: node.display,
        items: node.children.map((item) => item.label),
      }
    : undefined;
};

const page = (title: string): string =>
  `---\ntitle: ${title}\n---\n# ${title}\n`;

describe("fallback-filled sidebar groups", () => {
  it("mirror the fallback locale's folder meta", async () => {
    const trees = await sidebars({
      "fr/index.mdx": page("Accueil"),
      "index.mdx": page("Home"),
      "tools/a.mdx": page("A"),
      "tools/b.mdx": page("B"),
      "tools/meta.ts":
        'export default { title: "Tooling", display: "group", collapsed: false, pages: ["b", "a"] };\n',
    });
    const expected = {
      collapsed: false,
      display: "group" as const,
      items: ["B", "A"],
    };
    expect(group(trees.en, "Tooling")).toStrictEqual(expected);
    expect(group(trees.fr, "Tooling")).toStrictEqual(expected);
  });

  it("mirror a fallback-filled index page's display, ahead of its meta", async () => {
    const trees = await sidebars({
      "guides/index.mdx":
        "---\ntitle: Guides\nsidebar:\n  display: page\n---\n# Guides\n",
      "guides/intro.mdx": page("Intro"),
      "guides/meta.ts": 'export default { display: "group" };\n',
      "index.mdx": page("Home"),
      "reference/api.mdx": page("API"),
      "reference/index.mdx":
        "---\ntitle: Reference\nsidebar:\n  display: group\n---\n# Reference\n",
    });
    for (const code of ["en", "fr"]) {
      expect(group(trees[code], "Guides")?.display).toBe("page");
      expect(group(trees[code], "Reference")?.display).toBe("group");
    }
  });

  it("follow the locale's own meta once it has one", async () => {
    const trees = await sidebars({
      "fr/guides/intro.mdx": page("Intro fr"),
      "fr/guides/meta.ts": 'export default { title: "Guides FR" };\n',
      "guides/index.mdx":
        "---\ntitle: Guides\nsidebar:\n  display: group\n---\n# Guides\n",
      "guides/intro.mdx": page("Intro"),
      "guides/meta.ts": 'export default { display: "page" };\n',
    });
    expect(group(trees.en, "Guides")?.display).toBe("group");
    // fr's meta owns its group: no display of its own means the global mode,
    // not the fallback index's frontmatter or the fallback meta.
    expect(group(trees.fr, "Guides FR")?.display).toBe("flat");
  });

  it("mirror a non-default fallback locale's meta from its folder", async () => {
    const trees = await sidebars(
      {
        "fr/tools/a.mdx": page("A fr"),
        "fr/tools/meta.ts":
          'export default { title: "Outils", display: "page" };\n',
        "index.mdx": page("Home"),
        "tools/a.mdx": page("A"),
        "tools/meta.ts": 'export default { title: "Tools" };\n',
      },
      {
        fallbackLocale: "fr",
        locales: [
          { code: "en", label: "English" },
          { code: "fr", label: "Français" },
          { code: "de", label: "Deutsch" },
        ],
      }
    );
    expect(group(trees.de, "Outils")?.display).toBe("page");
    expect(group(trees.en, "Tools")?.display).toBe("flat");
  });

  it("stay flat when fallbacks are off", async () => {
    const trees = await sidebars(
      {
        "fr/tools/a.mdx": page("A fr"),
        "index.mdx": page("Home"),
        "tools/a.mdx": page("A"),
        "tools/meta.ts":
          'export default { title: "Tooling", display: "group" };\n',
      },
      { fallbackLocale: null }
    );
    expect(group(trees.en, "Tooling")?.display).toBe("group");
    expect(group(trees.fr, "Tools")?.display).toBe("flat");
  });
});
