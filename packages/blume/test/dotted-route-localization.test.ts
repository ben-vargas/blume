import { describe, expect, it } from "bun:test";

import { localizeHref } from "../src/core/locale-links.ts";

const options = {
  basePath: "",
  deployBase: "",
  i18n: {
    defaultLocale: "en",
    hideDefaultLocalePrefix: true,
    locales: [{ code: "en" }, { code: "fr" }],
  },
  locale: "fr",
  routes: new Set([
    "/releases/v1.2",
    "/fr/releases/v1.2",
    "/node.js",
    "/fr/node.js",
    "/guide",
    "/fr/guide",
  ]),
};

describe("localizing links to dotted page routes", () => {
  it("moves a dotted page route into the reader's locale, suffix kept", () => {
    expect(localizeHref("/releases/v1.2", options)).toBe("/fr/releases/v1.2");
    expect(localizeHref("/node.js#install", options)).toBe(
      "/fr/node.js#install"
    );
  });

  it("leaves asset links alone, since no page is served at their localized path", () => {
    expect(localizeHref("/logo.png", options)).toBe("/logo.png");
    expect(localizeHref("/guide.md", options)).toBe("/guide.md");
    expect(localizeHref("/files/report.pdf?v=2", options)).toBe(
      "/files/report.pdf?v=2"
    );
  });

  it("keeps the deployment base around a localized dotted route", () => {
    expect(
      localizeHref("/base/releases/v1.2", { ...options, deployBase: "/base" })
    ).toBe("/base/fr/releases/v1.2");
  });
});
