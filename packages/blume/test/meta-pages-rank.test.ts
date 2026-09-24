import { describe, expect, it } from "bun:test";

import { buildNavigation } from "../src/core/navigation.ts";
import { pageMetaSchema } from "../src/core/schema.ts";
import type { FolderMeta, PageMetaInput } from "../src/core/schema.ts";
import type { Diagnostic, NavNode, PageRecord } from "../src/core/types.ts";

const page = (
  id: string,
  route: string,
  title: string,
  sidebar: PageMetaInput["sidebar"] = {}
): PageRecord => ({
  anchors: [],
  contentType: "doc",
  format: "mdx",
  groups: [],
  headings: [],
  id,
  links: [],
  locale: "",
  meta: pageMetaSchema.parse({ sidebar, title }),
  navPath: id,
  route,
  segments: [],
  source: { name: "filesystem", ref: id },
  sourcePath: `/abs/${id}`,
  title,
  translationKey: route,
  version: "",
  versionKey: route,
});

const labels = (nodes: NavNode[] | undefined): string[] =>
  (nodes ?? []).map((node) => node.label);

const childrenOf = (node: NavNode | undefined): NavNode[] =>
  node?.kind === "group" ? node.children : [];

describe("folder meta pages ranks", () => {
  it("keeps unlisted children's own order beside the listed ranks, without a duplicate warning", () => {
    const diagnostics: Diagnostic[] = [];
    const nav = buildNavigation(
      [
        page("guides/index.md", "/guides", "Overview"),
        page("guides/intro.md", "/guides/intro", "Intro"),
        page("guides/01-setup.md", "/guides/setup", "Setup"),
        page("guides/02-deploy.md", "/guides/deploy", "Deploy"),
        page("guides/z.md", "/guides/z", "Zed"),
        page("guides/unlisted.md", "/guides/unlisted", "Unlisted"),
      ],
      {
        diagnostics,
        folderMeta: new Map<string, FolderMeta>([
          ["guides", { pages: ["z", "intro"] }],
        ]),
      }
    );
    // Listed children take ranks 0 and 1; the index stays first, prefixed
    // pages sort by their number among the ranks (Setup's 1 ties Intro's rank
    // and falls back to the label), and a child with no order goes last.
    expect(labels(childrenOf(nav.sidebar[0]))).toStrictEqual([
      "Overview",
      "Zed",
      "Intro",
      "Setup",
      "Deploy",
      "Unlisted",
    ]);
    expect(diagnostics).toStrictEqual([]);
  });

  it("still warns about two unlisted siblings that share an order", () => {
    const diagnostics: Diagnostic[] = [];
    buildNavigation(
      [
        page("guides/intro.md", "/guides/intro", "Intro"),
        page("guides/01-a.md", "/guides/a", "A"),
        page("guides/01-b.md", "/guides/b", "B"),
      ],
      {
        diagnostics,
        folderMeta: new Map<string, FolderMeta>([
          ["guides", { pages: ["x", "intro"] }],
        ]),
      }
    );
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toStrictEqual([
      '"A" and "B" both have sidebar order 1; falling back to alphabetical order.',
    ]);
  });

  it("lets a parent's pages list outrank a listed subfolder's own order", () => {
    const nav = buildNavigation(
      [
        page("alpha/x.md", "/alpha/x", "X"),
        page("beta/y.md", "/beta/y", "Y"),
        page("gamma/z.md", "/gamma/z", "Z"),
      ],
      {
        folderMeta: new Map<string, FolderMeta>([
          ["", { pages: ["beta", "alpha"] }],
          ["alpha", { order: 0 }],
          ["beta", { order: 9 }],
          ["gamma", { order: 1 }],
        ]),
      }
    );
    // Beta and Alpha take their listed positions (0, 1) over their own
    // `order`; unlisted Gamma keeps its own order of 1.
    expect(labels(nav.sidebar)).toStrictEqual(["Beta", "Alpha", "Gamma"]);
  });
});
