import { describe, expect, it } from "bun:test";

import { ogFallbackFonts, resolveOgFonts } from "../src/og/derive.ts";

const ROOT = "/site";
const CARD_WEIGHTS = [400, 600];

/** The family names `ogFallbackFonts` orders for `locales`. */
const families = (locales: string[]) =>
  ogFallbackFonts(locales).map((font) => font.name);

/** Every script's family, in the default order. */
const DEFAULT_ORDER = [
  "Noto Sans",
  "Noto Sans Ethiopic",
  "Noto Sans Arabic",
  "Noto Sans Bengali",
  "Noto Sans Gujarati",
  "Noto Sans Hebrew",
  "Noto Sans Devanagari",
  "Noto Sans Armenian",
  "Noto Sans JP",
  "Noto Sans Georgian",
  "Noto Sans Khmer",
  "Noto Sans Kannada",
  "Noto Sans KR",
  "Noto Sans Lao",
  "Noto Sans Malayalam",
  "Noto Sans Myanmar",
  "Noto Sans Oriya",
  "Noto Sans Gurmukhi",
  "Noto Sans Sinhala",
  "Noto Sans Tamil",
  "Noto Sans Telugu",
  "Noto Sans Thai",
  "Noto Sans SC",
  "Noto Sans TC",
];

describe("ogFallbackFonts", () => {
  it("covers every script by default, even with no locales configured", () => {
    // A site that writes Japanese without an i18n block still gets a family
    // that draws it; Latin-only locales change nothing.
    expect(families([])).toEqual(DEFAULT_ORDER);
    expect(families(["en", "de", "pt-BR", "fr"])).toEqual(DEFAULT_ORDER);
  });

  it("loads each family at the card's weights", () => {
    for (const font of ogFallbackFonts([])) {
      expect(font.weight).toEqual(CARD_WEIGHTS);
    }
  });

  it("moves each configured locale's family ahead of the rest", () => {
    expect(families(["en", "hi", "ja"]).slice(0, 3)).toEqual([
      "Noto Sans Devanagari",
      "Noto Sans JP",
      "Noto Sans",
    ]);
    expect(families(["ko", "ar", "th", "he"]).slice(0, 4)).toEqual([
      "Noto Sans KR",
      "Noto Sans Arabic",
      "Noto Sans Thai",
      "Noto Sans Hebrew",
    ]);
    // Moved, not duplicated.
    expect(families(["ja"])).toHaveLength(DEFAULT_ORDER.length);
  });

  it("puts a Chinese locale's family ahead of Japanese so Han takes its forms", () => {
    const simplified = families(["zh", "zh-CN", "zh-Hans"]);
    expect(simplified[0]).toBe("Noto Sans SC");
    expect(simplified.indexOf("Noto Sans SC")).toBeLessThan(
      simplified.indexOf("Noto Sans JP")
    );
    expect(families(["zh-Hant", "zh-TW", "zh-HK"])[0]).toBe("Noto Sans TC");
  });

  it("leads with Noto Sans for Cyrillic, Greek, Vietnamese, and extended Latin", () => {
    for (const locale of ["ru", "el", "vi", "pl", "sr-Latn"]) {
      expect(families([locale])).toEqual(DEFAULT_ORDER);
    }
  });
});

describe("resolveOgFonts fallbacks", () => {
  it("pins untouched cards to the built-in face and adds every script fallback", () => {
    expect(
      resolveOgFonts(
        {
          locales: ["en", "ja"],
          ogFonts: undefined,
          themeFonts: {},
          themeFontsConfigured: false,
        },
        ROOT
      )
    ).toEqual({
      fallbacks: ogFallbackFonts(["en", "ja"]),
      families: { body: "Geist", title: "Geist" },
      fonts: [],
    });
  });

  it("adds the fallbacks to a Latin-only site too", () => {
    const resolved = resolveOgFonts(
      {
        ogFonts: undefined,
        themeFonts: {},
        themeFontsConfigured: false,
      },
      ROOT
    );
    expect(resolved.families).toEqual({ body: "Geist", title: "Geist" });
    expect(resolved.fallbacks?.map((font) => font.name)).toEqual(DEFAULT_ORDER);
  });

  it("keeps the theme's fonts and families ahead of the fallbacks", () => {
    const resolved = resolveOgFonts(
      {
        locales: ["en", "ja"],
        ogFonts: undefined,
        themeFonts: { body: "inter" },
        themeFontsConfigured: true,
      },
      ROOT
    );
    expect(resolved.families).toEqual({ body: "Inter" });
    expect(resolved.fonts).toEqual([{ name: "Inter", weight: "400..700" }]);
    expect(resolved.fallbacks?.[0]).toEqual({
      name: "Noto Sans JP",
      weight: CARD_WEIGHTS,
    });
  });

  it("skips a fallback the theme already loads", () => {
    const resolved = resolveOgFonts(
      {
        locales: ["ja"],
        ogFonts: undefined,
        themeFonts: { body: { name: "Noto Sans JP" } },
        themeFontsConfigured: true,
      },
      ROOT
    );
    expect(resolved.fonts).toEqual([
      { name: "Noto Sans JP", weight: CARD_WEIGHTS },
    ]);
    expect(resolved.fallbacks?.map((font) => font.name)).toEqual(
      DEFAULT_ORDER.filter((name) => name !== "Noto Sans JP")
    );
  });

  it("lets an explicit og.fonts take over the whole list", () => {
    expect(
      resolveOgFonts(
        {
          locales: ["ja"],
          ogFonts: ["Inter"],
          themeFonts: {},
          themeFontsConfigured: false,
        },
        ROOT
      )
    ).toEqual({ fonts: ["Inter"] });
  });
});
