import { describe, expect, it } from "bun:test";

import { isIndexFileName, validateLinks } from "../src/core/links.ts";
import { pageMetaSchema } from "../src/core/schema.ts";
import type { ContentGraph, PageRecord } from "../src/core/types.ts";

const makePage = (id: string, route: string, target?: string): PageRecord => ({
  anchors: [],
  contentType: "doc",
  format: "md",
  groups: [],
  headings: [],
  id,
  links: target === undefined ? [] : [{ column: 1, line: 1, target }],
  locale: "",
  meta: pageMetaSchema.parse({}),
  navPath: id,
  route,
  segments: [],
  source: { name: "filesystem", ref: id },
  sourcePath: `/abs/${id}`,
  title: id,
  translationKey: route,
  version: "",
  versionKey: route,
});

const validate = (pages: PageRecord[]) =>
  validateLinks(
    // SAFETY: link validation reads only pages and routes; the empty nav
    // shells stand in for the graph fields it never touches.
    {
      diagnostics: [],
      navigation: { featured: [], selectors: [], sidebar: [], tabs: [] },
      navigationByLocale: {},
      navigationByVersion: {},
      pages,
      routes: new Map(pages.map((page) => [page.route, page.id])),
    } as ContentGraph,
    { publicDir: null }
  );

describe("folder index detection matches route mapping", () => {
  it("counts only a lowercase index, with any extension casing", () => {
    expect(isIndexFileName("guides/index.md")).toBe(true);
    expect(isIndexFileName("guides/index.MDX")).toBe(true);
    expect(isIndexFileName("guides/Index.md")).toBe(false);
    expect(isIndexFileName("guides/INDEX.mdx")).toBe(false);
  });

  it("resolves a relative link on Index.md against its folder, where the page publishes", async () => {
    // `guides/Index.md` routes to `/guides/Index`, a page of its own, so
    // `./setup` resolves beside it at `/guides/setup`.
    const diagnostics = await validate([
      makePage("guides/Index.md", "/guides/Index", "./setup"),
      makePage("guides/setup.md", "/guides/setup"),
    ]);
    expect(diagnostics).toStrictEqual([]);
  });

  it("still resolves a lowercase index page's links inside its own route", async () => {
    const diagnostics = await validate([
      makePage("guides/index.md", "/guides", "./setup"),
      makePage("guides/setup.md", "/guides/setup"),
    ]);
    expect(diagnostics).toStrictEqual([]);
  });
});
