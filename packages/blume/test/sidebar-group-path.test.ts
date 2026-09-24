import { describe, expect, it } from "bun:test";

import { sidebarForRoute } from "../src/components/layout/nav-utils.ts";
import { buildNavigation } from "../src/core/navigation.ts";
import { pageMetaSchema } from "../src/core/schema.ts";
import type { FolderMeta, PageMetaInput } from "../src/core/schema.ts";
import type { NavNode, PageRecord } from "../src/core/types.ts";

/** A page record; `versionKey` is the route before any base/locale prefix. */
const page = (
  id: string,
  route: string,
  meta: PageMetaInput = {},
  versionKey = route
): PageRecord => ({
  anchors: [],
  contentType: "doc",
  format: "mdx",
  groups: [],
  headings: [],
  id,
  links: [],
  locale: "",
  meta: pageMetaSchema.parse({ title: id, ...meta }),
  navPath: id,
  route,
  segments: [],
  source: { name: "filesystem", ref: id },
  sourcePath: `/abs/${id}`,
  title: id,
  translationKey: versionKey,
  version: "",
  versionKey,
});

const groupPaths = (nodes: NavNode[]): [string, string | undefined][] =>
  nodes.flatMap((node) =>
    node.kind === "group"
      ? [[node.label, node.path], ...groupPaths(node.children)]
      : []
  );

const labels = (nodes: NavNode[]): string[] => nodes.map((node) => node.label);

const empty = new Map<string, FolderMeta>();

describe("sidebar group paths", () => {
  it("takes a folder's path from its unslugged pages, whatever order they come in", () => {
    const nav = buildNavigation(
      [
        page("guides/a.md", "/install", { slug: "install" }),
        page("guides/b.md", "/guides/b"),
        page("intro.md", "/intro"),
      ],
      {
        folderMeta: empty,
        tabs: [
          { label: "Docs", path: "/" },
          { label: "Guides", path: "/guides" },
        ],
      }
    );
    expect(groupPaths(nav.sidebar)).toStrictEqual([["Guides", "/guides"]]);

    // The /guides tab scopes to the Guides folder — slugged page included —
    // and the root sidebar leaves it out.
    expect(
      labels(sidebarForRoute(nav.sidebar, nav.tabs, "/guides/b", nav.root))
    ).toStrictEqual(["guides/a.md", "guides/b.md"]);
    expect(
      labels(sidebarForRoute(nav.sidebar, nav.tabs, "/intro", nav.root))
    ).toStrictEqual(["intro.md"]);
  });

  it("reads the path off the folder names when every page in it is slugged", () => {
    const nav = buildNavigation(
      [
        page(
          "01-guides/(beta)/a.md",
          "/docs/fr/install",
          { slug: "install" },
          "/install"
        ),
      ],
      { folderMeta: empty }
    );
    // The base and locale segments ahead of the slug stay in front; the
    // ordering prefix is dropped and the `(beta)` group adds no segment.
    expect(groupPaths(nav.sidebar)).toStrictEqual([
      ["Guides", "/docs/fr/guides"],
      ["Beta", "/docs/fr/guides"],
    ]);
  });

  it("prefers an unslugged page's route over a slugged sibling's folder path", () => {
    const nav = buildNavigation(
      [
        page("guides/a.md", "/elsewhere/a", { slug: "elsewhere/a" }),
        page("guides/b.md", "/manuals/b"),
      ],
      { folderMeta: empty }
    );
    // The unslugged page's route is the source of truth (a source may route
    // a folder differently from its name), and it wins in either order.
    expect(groupPaths(nav.sidebar)).toStrictEqual([["Guides", "/manuals"]]);
  });
});
