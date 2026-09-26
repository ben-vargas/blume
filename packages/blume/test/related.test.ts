import { describe, expect, it } from "bun:test";

import { relatedLinks, relatedPageLinks } from "../src/core/related.ts";
import type { RelatedRoute } from "../src/core/related.ts";
import { pageMetaSchema } from "../src/core/schema.ts";

const ROUTES: RelatedRoute[] = [
  { description: "Ship it.", path: "/docs/deploy", title: "Deploy" },
  { description: null, path: "/docs/fr/deploy", title: "Déployer" },
  { description: null, path: "/docs/search", title: "Search" },
];

const site = { basePath: "/docs", locale: "en", routes: ROUTES };

/** A `related` value as a YAML page could write it, valid or not. */
type RelatedInput = boolean | (string | { [title: string]: string })[];

/** Whether the page frontmatter schema accepts `related`. */
const parse = (related: RelatedInput): boolean =>
  pageMetaSchema.safeParse({ related }).success;

describe(relatedLinks, () => {
  it("resolves pages to their title and description, in the order written", () => {
    expect(relatedLinks(["/search", "/deploy#vercel"], site)).toStrictEqual([
      {
        description: undefined,
        external: false,
        href: "/docs/search",
        title: "Search",
      },
      {
        description: "Ship it.",
        external: false,
        href: "/docs/deploy#vercel",
        title: "Deploy",
      },
    ]);
  });

  it("takes a titled entry's title, and a URL's host when it has none", () => {
    expect(
      relatedLinks(
        [
          { "Shipping guide": "/deploy/" },
          "https://vercel.com/docs",
          { Astro: "https://astro.build" },
        ],
        site
      )
    ).toStrictEqual([
      {
        description: "Ship it.",
        external: false,
        href: "/docs/deploy",
        title: "Shipping guide",
      },
      { external: true, href: "https://vercel.com/docs", title: "vercel.com" },
      { external: true, href: "https://astro.build", title: "Astro" },
    ]);
  });

  it("links a translated page in the reader's locale", () => {
    const i18n = {
      defaultLocale: "en",
      hideDefaultLocalePrefix: true,
      locales: [{ code: "en" }, { code: "fr" }],
    };
    const [french] = relatedLinks(["/deploy"], { ...site, i18n, locale: "fr" });
    expect(french).toMatchObject({
      href: "/docs/fr/deploy",
      title: "Déployer",
    });
    // Untranslated: the default locale's page.
    const [search] = relatedLinks(["/search"], { ...site, i18n, locale: "fr" });
    expect(search?.href).toBe("/docs/search");
  });

  it("leaves out pages it can't find and empty entries", () => {
    expect(relatedLinks(["/missing", {}], site)).toStrictEqual([]);
  });

  it("validates as frontmatter: paths or URLs, up to ten, one title each", () => {
    expect(parse(["/a", { Guide: "/b" }, "https://x.dev"])).toBe(true);
    expect(parse(false)).toBe(true);
    expect(parse(["guides/setup"])).toBe(false);
    expect(parse([{ Guide: "setup" }])).toBe(false);
    expect(parse([{ a: "/a", b: "/b" }])).toBe(false);
    expect(parse(Array.from({ length: 11 }, () => "/x"))).toBe(false);
  });

  it("lists nothing for false or no entries", () => {
    expect(relatedLinks(false, site)).toStrictEqual([]);
    expect(relatedLinks(undefined, site)).toStrictEqual([]);
  });
});

describe(relatedPageLinks, () => {
  it("hands the link checker every page link, not URLs", () => {
    expect(
      relatedPageLinks(["/deploy", { Guide: "/search#x" }, "https://x.dev", {}])
    ).toStrictEqual([
      { column: 1, line: 1, target: "/deploy" },
      { column: 1, line: 1, target: "/search#x" },
    ]);
    expect(relatedPageLinks(false)).toStrictEqual([]);
    expect(relatedPageLinks()).toStrictEqual([]);
  });
});
