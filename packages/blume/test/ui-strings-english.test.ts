import { describe, expect, it } from "bun:test";

import { EN_UI, resolveUIStrings } from "../src/core/i18n-ui.ts";

describe("resolveUIStrings on English locales", () => {
  it("gives English pages the built-in English strings under a German default", () => {
    const dict = resolveUIStrings("en", { defaultLocale: "de" });
    expect(dict).toStrictEqual(EN_UI);
    expect(dict.search.placeholder).toBe("Search documentation…");
    expect(dict.feedback.question).toBe("Was this page helpful?");
  });

  it("treats a regional English code the same way under a French default", () => {
    expect(resolveUIStrings("en-GB", { defaultLocale: "fr" })).toStrictEqual(
      EN_UI
    );
    expect(resolveUIStrings("EN_us", { defaultLocale: "fr" })).toStrictEqual(
      EN_UI
    );
  });

  it("applies the English locale's own overrides, never the default locale's", () => {
    const dict = resolveUIStrings("en", {
      defaultLocale: "de",
      overrides: {
        de: { feedback: { yes: "Jawohl" }, search: { placeholder: "Suchen" } },
        en: { search: { placeholder: "Find anything" } },
      },
    });
    expect(dict.search.placeholder).toBe("Find anything");
    expect(dict.feedback.yes).toBe("Yes");
  });

  it("keeps the default locale's fallback for other languages", () => {
    const dict = resolveUIStrings("xx", {
      defaultLocale: "de",
      overrides: { de: { search: { placeholder: "Suchen" } } },
    });
    expect(dict.search.placeholder).toBe("Suchen");
  });

  it("lets an English default's overrides reach another English locale", () => {
    const dict = resolveUIStrings("en-GB", {
      defaultLocale: "en",
      overrides: { en: { search: { placeholder: "Find anything" } } },
    });
    expect(dict.search.placeholder).toBe("Find anything");
  });
});
