import { describe, expect, it } from "bun:test";

import { buildContentGraph } from "../src/core/graph.ts";
import { validateNavTargets } from "../src/core/nav-diagnostics.ts";
import { blumeConfigSchema, pageMetaSchema } from "../src/core/schema.ts";
import type { BlumeConfigInput } from "../src/core/schema.ts";
import type { Diagnostic, Navigation, PageRecord } from "../src/core/types.ts";

const page = (
  id: string,
  route: string,
  over: Partial<PageRecord> = {}
): PageRecord => ({
  anchors: [],
  contentType: "doc",
  format: "mdx",
  groups: [],
  headings: [],
  id,
  links: [],
  locale: "",
  meta: pageMetaSchema.parse({ title: id }),
  navPath: id,
  route,
  segments: [],
  source: { name: "filesystem", ref: id },
  sourcePath: `/abs/${id}`,
  title: id,
  translationKey: route,
  version: "",
  versionKey: route,
  ...over,
});

const sidebarDiagnostics = (
  input: BlumeConfigInput,
  pages: PageRecord[],
  extraRoutes: string[] = []
): Diagnostic[] => {
  const config = blumeConfigSchema.parse(input);
  return buildContentGraph(pages, {
    basePath: config.basePath,
    extraRoutes: new Set(extraRoutes),
    folderMeta: new Map(),
    i18n: config.i18n,
    navigation: config.navigation,
  }).diagnostics.filter((diagnostic) =>
    ["BLUME_NAV_EMPTY_ITEM", "BLUME_NAV_MISSING_PAGE"].includes(diagnostic.code)
  );
};

describe("explicit sidebar diagnostics", () => {
  it("warns about entries that would be dropped or link nowhere", () => {
    const diagnostics = sidebarDiagnostics(
      {
        navigation: {
          sidebar: [
            "/intro",
            "/introo",
            { label: "Orphan" },
            { label: "Home", root: "/intro" },
            { label: "Broken", root: "/missing" },
            { items: ["/nested-typo"], label: "Group", root: "/also-missing" },
            { label: "Playground", root: "/playground" },
            { href: "/anywhere", label: "Link" },
            { items: [], label: "Empty group" },
          ],
        },
      },
      [page("intro.md", "/intro")],
      ["/playground"]
    );
    expect(diagnostics.map(({ code, message }) => [code, message])).toEqual([
      [
        "BLUME_NAV_MISSING_PAGE",
        'Sidebar entry "/introo" matches no page, so it\'s left out of the sidebar.',
      ],
      [
        "BLUME_NAV_EMPTY_ITEM",
        'Sidebar entry "Orphan" has no page, href, root, or items, so it\'s left out of the sidebar.',
      ],
      [
        "BLUME_NAV_MISSING_PAGE",
        'Sidebar entry "Broken" has root "/missing", but no page matches it, so its link leads nowhere.',
      ],
      [
        "BLUME_NAV_MISSING_PAGE",
        'Sidebar entry "Group" has root "/also-missing", but no page matches it, so its link leads nowhere.',
      ],
      [
        "BLUME_NAV_MISSING_PAGE",
        'Sidebar entry "/nested-typo" matches no page, so it\'s left out of the sidebar.',
      ],
    ]);
    expect(diagnostics.every((d) => d.severity === "warning")).toBe(true);
  });

  it("resolves refs written without the base under a basePath", () => {
    expect(
      sidebarDiagnostics(
        { basePath: "/docs", navigation: { sidebar: ["/intro", "intro/"] } },
        [page("intro.md", "/docs/intro")]
      )
    ).toStrictEqual([]);
  });

  it("accepts a ref any locale serves, once, under i18n", () => {
    const diagnostics = sidebarDiagnostics(
      {
        i18n: {
          defaultLocale: "en",
          fallbackLocale: null,
          locales: [
            { code: "en", label: "English" },
            { code: "fr", label: "Français" },
          ],
        },
        navigation: { sidebar: ["/intro", "/nowhere"] },
      },
      // English only: the French tree leaves `/intro` out, which is an
      // untranslated page rather than a typo.
      [page("intro.md", "/intro", { locale: "en" })]
    );
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toStrictEqual([
      'Sidebar entry "/nowhere" matches no page, so it\'s left out of the sidebar.',
    ]);
  });
});

const pinned = (href: string): Navigation => ({
  featured: [{ href, label: "Pinned" }],
  selectors: [],
  sidebar: [],
  tabs: [],
});

describe("navigation target checks", () => {
  it("checks only the path of a link that carries a query or fragment", () => {
    const routes = new Set(["/guides/setup"]);
    expect(validateNavTargets(pinned("/guides?tab=cli"), routes)).toStrictEqual(
      []
    );
    expect(
      validateNavTargets(pinned("/guides/setup?x=1#run"), routes)
    ).toStrictEqual([]);
    expect(
      validateNavTargets(pinned("/nope?tab=cli"), routes).map(
        (diagnostic) => diagnostic.code
      )
    ).toStrictEqual(["BLUME_NAV_MISSING_PAGE"]);
  });
});
