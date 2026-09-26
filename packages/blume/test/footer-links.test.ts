import { describe, expect, it } from "bun:test";

import { footerColumns } from "../src/components/layout/footer-links.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";

const { footer } = blumeConfigSchema.parse({
  footer: {
    links: [
      {
        items: [
          { href: "/guide#setup", label: { en: "Guide", fr: "Guide FR" } },
          { href: "/only-en", label: "Only EN" },
          { href: "https://x.dev", label: "X" },
        ],
        label: { en: "Docs", fr: "Docs FR" },
      },
      { items: [{ href: "/guide", label: "Plain" }] },
    ],
  },
});
const links = footer?.links ?? [];

const i18n = {
  defaultLocale: "en",
  hideDefaultLocalePrefix: true,
  locales: [{ code: "en" }, { code: "fr" }],
};
const routes = new Set(["/guide", "/fr/guide", "/only-en"]);

describe(footerColumns, () => {
  it("shows labels in the page's locale and moves served links into it", () => {
    expect(
      footerColumns(links, { basePath: "", i18n, locale: "fr", routes })
    ).toStrictEqual([
      {
        items: [
          { href: "/fr/guide#setup", label: "Guide FR" },
          // Untranslated, and a URL: as written.
          { href: "/only-en", label: "Only EN" },
          { href: "https://x.dev", label: "X" },
        ],
        label: "Docs FR",
      },
      { items: [{ href: "/fr/guide", label: "Plain" }], label: undefined },
    ]);
  });

  it("falls back to the default locale's label", () => {
    const [docs] = footerColumns(links, {
      basePath: "",
      i18n: { ...i18n, locales: [...i18n.locales, { code: "de" }] },
      locale: "de",
      routes,
    });
    expect(docs?.label).toBe("Docs");
    expect(docs?.items[0]).toStrictEqual({
      href: "/guide#setup",
      label: "Guide",
    });
  });

  it("leaves links alone on a single-locale site", () => {
    const [docs] = footerColumns(links, { basePath: "", i18n: null, routes });
    expect(docs?.label).toBe("Docs");
    expect(docs?.items[0]?.href).toBe("/guide#setup");
  });
});
