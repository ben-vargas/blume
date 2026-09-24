import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { discoverContent } from "../src/core/content.ts";
import { buildContentGraph } from "../src/core/graph.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { BlumeConfigInput } from "../src/core/schema.ts";
import { resolveDocsCollection } from "../src/core/sources/collection.ts";
import type { NavNode } from "../src/core/types.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const graphFor = async (
  input: BlumeConfigInput,
  files: Record<string, string>,
  brandHref = "/"
) => {
  const config = blumeConfigSchema.parse(input);
  const root = await mkdtemp(join(tmpdir(), "blume-header-links-"));
  dirs.push(root);
  const contentRoot = join(root, "docs");
  await Promise.all(
    Object.entries(files).map(async ([rel, content]) => {
      const abs = join(contentRoot, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content);
    })
  );
  const collection = resolveDocsCollection(config, contentRoot);
  const { pages } = await discoverContent({
    basePath: config.basePath,
    contentRoot,
    defaultType: config.content.defaultType,
    exclude: collection.exclude,
    i18n: config.i18n,
    include: collection.include,
  });
  return buildContentGraph(pages, {
    basePath: config.basePath,
    brandHref,
    folderMeta: new Map(),
    i18n: config.i18n,
    navigation: config.navigation,
  });
};

const doc = (title: string): string =>
  `---\ntitle: ${title}\n---\n# ${title}\n`;

const locales = (hideDefaultLocalePrefix = true) => ({
  defaultLocale: "en",
  hideDefaultLocalePrefix,
  locales: [
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
  ],
});

const FILES = {
  "fr/guides/x.mdx": doc("X fr"),
  "fr/index.mdx": doc("Accueil"),
  "guides/x.mdx": doc("X"),
  "index.mdx": doc("Home"),
};

describe("the localized brand link under a basePath", () => {
  it("keeps the base on a localized logo link", async () => {
    const graph = await graphFor({ basePath: "/docs", i18n: locales() }, FILES);
    expect(graph.navigationByLocale.fr?.brandHref).toBe("/docs/fr");
    // The hidden default locale's link is the configured one, untouched.
    expect(graph.navigationByLocale.en?.brandHref).toBe("/");
  });

  it("bases the default locale's link when its prefix shows", async () => {
    const graph = await graphFor(
      { basePath: "/docs", i18n: locales(false) },
      FILES
    );
    expect(graph.pages.map((page) => page.route)).toContain("/docs/en");
    expect(graph.navigationByLocale.en?.brandHref).toBe("/docs/en");
    expect(graph.navigationByLocale.fr?.brandHref).toBe("/docs/fr");
  });
});

const routes = (nodes: NavNode[] | undefined): (string | undefined)[] =>
  (nodes ?? []).map((node) => node.route);

describe("explicit sidebar links under i18n", () => {
  it("moves internal href links into the reader's locale like featured links", async () => {
    const graph = await graphFor(
      {
        i18n: locales(),
        navigation: {
          sidebar: [
            "guides/x",
            {
              items: [
                { href: "/guides/x", label: "Guide" },
                { href: "https://example.com", label: "External" },
              ],
              label: "Links",
            },
          ],
        },
      },
      FILES
    );
    const french = graph.navigationByLocale.fr?.sidebar;
    expect(routes(french)).toStrictEqual(["/fr/guides/x", undefined]);
    const group = french?.[1];
    expect(routes(group?.kind === "group" ? group.children : [])).toStrictEqual(
      ["/fr/guides/x", "https://example.com"]
    );
    const english = graph.navigationByLocale.en?.sidebar[1];
    expect(
      routes(english?.kind === "group" ? english.children : [])
    ).toStrictEqual(["/guides/x", "https://example.com"]);
  });
});
