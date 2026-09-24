import { describe, expect, it } from "bun:test";

import { localeOgFonts, resolveOgFonts } from "../src/og/derive.ts";

const ROOT = "/site";
const CARD_WEIGHTS = [400, 600];

/** The family names `localeOgFonts` picks for `locales`. */
const families = (locales: string[]) =>
  localeOgFonts(locales).map((font) => font.name);

describe("localeOgFonts", () => {
  it("adds nothing for locales the built-in font draws", () => {
    expect(localeOgFonts([])).toEqual([]);
    expect(localeOgFonts(["en", "de", "pt-BR", "fr"])).toEqual([]);
  });

  it("picks a Noto family per script, at the card's weights", () => {
    expect(localeOgFonts(["en", "hi", "ja"])).toEqual([
      { name: "Noto Sans Devanagari", weight: CARD_WEIGHTS },
      { name: "Noto Sans JP", weight: CARD_WEIGHTS },
    ]);
    expect(families(["ko", "ar", "th", "he"])).toEqual([
      "Noto Sans KR",
      "Noto Sans Arabic",
      "Noto Sans Thai",
      "Noto Sans Hebrew",
    ]);
  });

  it("tells simplified from traditional Chinese", () => {
    expect(families(["zh", "zh-CN", "zh-Hans"])).toEqual(["Noto Sans SC"]);
    expect(families(["zh-Hant", "zh-TW", "zh-HK"])).toEqual(["Noto Sans TC"]);
  });

  it("covers Cyrillic, Greek, Vietnamese, and extended Latin with Noto Sans", () => {
    expect(families(["ru", "el", "vi", "pl", "sr-Latn"])).toEqual([
      "Noto Sans",
    ]);
  });
});

describe("resolveOgFonts with locales", () => {
  it("pins untouched cards to the built-in face and adds script fallbacks", () => {
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
      families: { body: "Geist", title: "Geist" },
      fonts: [{ name: "Noto Sans JP", weight: CARD_WEIGHTS }],
    });
  });

  it("appends fallbacks after the theme's fonts and keeps its families", () => {
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
    expect(resolved.fonts).toEqual([
      { name: "Inter", weight: "400..700" },
      { name: "Noto Sans JP", weight: CARD_WEIGHTS },
    ]);
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
    expect(resolved).toEqual({
      families: { body: "Noto Sans JP" },
      fonts: [{ name: "Noto Sans JP", weight: CARD_WEIGHTS }],
    });
  });

  it("leaves an explicit og.fonts alone", () => {
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

  it("changes nothing for a Latin-only site", () => {
    expect(
      resolveOgFonts(
        {
          locales: ["en", "de"],
          ogFonts: undefined,
          themeFonts: {},
          themeFontsConfigured: false,
        },
        ROOT
      )
    ).toEqual({ fonts: [] });
  });
});
