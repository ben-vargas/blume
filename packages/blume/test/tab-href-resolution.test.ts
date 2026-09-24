import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { discoverContent } from "../src/core/content.ts";
import { buildContentGraph } from "../src/core/graph.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { BlumeConfigInput } from "../src/core/schema.ts";
import { resolveDocsCollection } from "../src/core/sources/collection.ts";
import type { NavTab } from "../src/core/types.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const tempContent = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-tab-href-"));
  dirs.push(root);
  const contentRoot = join(root, "docs");
  await Promise.all(
    Object.entries(files).map(async ([rel, content]) => {
      const abs = join(contentRoot, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content);
    })
  );
  return contentRoot;
};

const graphFor = async (
  input: BlumeConfigInput,
  files: Record<string, string>,
  extraRoutes: string[] = []
) => {
  const config = blumeConfigSchema.parse(input);
  const contentRoot = await tempContent(files);
  const collection = resolveDocsCollection(config, contentRoot);
  const { pages } = await discoverContent({
    contentRoot,
    defaultType: config.content.defaultType,
    exclude: collection.exclude,
    i18n: config.i18n,
    include: collection.include,
    versions: config.versions,
  });
  return buildContentGraph(pages, {
    extraRoutes: new Set(extraRoutes),
    folderMeta: new Map(),
    i18n: config.i18n,
    navigation: config.navigation,
    versions: config.versions,
  });
};

const doc = (title: string, extra = ""): string =>
  `---\ntitle: ${title}${extra}\n---\n# ${title}\n`;

const hrefOf = (tabs: NavTab[] | undefined, label: string) => {
  const tab = tabs?.find((candidate) => candidate.label === label);
  return tab?.href ?? tab?.path;
};

const I18N = {
  defaultLocale: "en",
  locales: [
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
  ],
};

const TABS = [
  { label: "Docs", path: "/" },
  { label: "Guides", path: "/guides" },
];

const VERSIONS = { archived: [{ id: "v1.0" }], current: { label: "v2.0" } };

describe("tab links in archived version trees", () => {
  it("links a section tab to the archived section's first page", async () => {
    const graph = await graphFor(
      { navigation: { tabs: TABS }, versions: VERSIONS },
      {
        "guides/start.mdx": doc("Start"),
        "index.mdx": doc("Home"),
        "v1.0/guides/old-start.mdx": doc("Old start"),
        "v1.0/index.mdx": doc("Home v1"),
      }
    );
    expect(hrefOf(graph.navigation.tabs, "Guides")).toBe("/guides/start");
    const archived = graph.navigationByVersion["v1.0"]?.[""];
    expect(hrefOf(archived?.tabs, "Guides")).toBe("/v1.0/guides/old-start");
    // The root tab still links back to the current docs.
    expect(hrefOf(archived?.tabs, "Docs")).toBe("/");
  });

  it("links to the archived section's own index page when it has one", async () => {
    const graph = await graphFor(
      { navigation: { tabs: TABS }, versions: VERSIONS },
      {
        "guides/start.mdx": doc("Start"),
        "v1.0/guides/index.mdx": doc("Guides v1"),
        "v1.0/guides/old-start.mdx": doc("Old start"),
      }
    );
    const archived = graph.navigationByVersion["v1.0"]?.[""];
    expect(hrefOf(archived?.tabs, "Guides")).toBe("/v1.0/guides");
  });

  it("finds the archived section inside each locale's tree", async () => {
    const graph = await graphFor(
      { i18n: I18N, navigation: { tabs: TABS }, versions: VERSIONS },
      {
        "guides/start.mdx": doc("Start"),
        "v1.0/guides/old-start.mdx": doc("Old start"),
      }
    );
    const french = graph.navigationByVersion["v1.0"]?.fr;
    expect(french?.tabs.find((tab) => tab.label === "Guides")?.path).toBe(
      "/fr/guides"
    );
    expect(hrefOf(french?.tabs, "Guides")).toBe("/fr/v1.0/guides/old-start");
  });
});

describe("tab links to routes outside the content tree", () => {
  it("opens the changelog timeline from a localized changelog tab", async () => {
    const graph = await graphFor(
      {
        i18n: I18N,
        navigation: { tabs: [{ label: "Changelog", path: "/changelog" }] },
      },
      {
        "changelog/v1-0.md": doc("v1.0", "\ntype: changelog\ndate: 2026-01-01"),
        "changelog/v1-1.md": doc("v1.1", "\ntype: changelog\ndate: 2026-02-01"),
        "index.mdx": doc("Home"),
      },
      ["/changelog"]
    );
    const french = graph.navigationByLocale.fr;
    // The tab keeps its localized path, so it still scopes the French
    // entries, but it opens the one timeline index instead of the newest
    // entry's fallback copy.
    expect(french?.tabs[0]?.path).toBe("/fr/changelog");
    expect(french?.tabs[0]?.href).toBe("/changelog");
    expect(hrefOf(graph.navigationByLocale.en?.tabs, "Changelog")).toBe(
      "/changelog"
    );
  });
});
