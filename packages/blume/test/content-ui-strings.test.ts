import { describe, expect, it } from "bun:test";

import { contentStrings } from "../src/components/content/content-strings.ts";
import { EN_UI, resolveUIStrings } from "../src/core/i18n-ui.ts";
import { UI_PACKS } from "../src/core/ui-packs/index.ts";

/**
 * The content components' chrome (TypeTable, Component, Tabs, Expandable,
 * Update, GithubInfo) and the search dialog's version tag used to be
 * hard-coded English; they now read the UI string packs, with English
 * defaults for a key a pack or a user override lacks.
 */
const CONTENT_KEYS = [
  "code",
  "default",
  "forks",
  "preview",
  "prop",
  "selectTab",
  "showMore",
  "stars",
  "tab",
  "type",
  "update",
] as const;

describe("content component UI strings", () => {
  it("defaults to the English labels the components rendered before", () => {
    expect(EN_UI.content).toMatchObject({
      code: "Code",
      default: "Default",
      forks: "Forks",
      preview: "Preview",
      prop: "Prop",
      selectTab: "Select tab",
      showMore: "Show more",
      stars: "Stars",
      tab: "Tab {n}",
      type: "Type",
      update: "Update",
    });
    expect(EN_UI.search.latest).toBe("latest");
  });

  it("localizes every new label in every shipped pack", () => {
    for (const [code, pack] of Object.entries(UI_PACKS)) {
      for (const key of CONTENT_KEYS) {
        expect(
          pack.content?.[key],
          `pack "${code}" misses content.${key}`
        ).toBeTruthy();
      }
      // An untitled tab's number is spliced into `{n}` at runtime.
      expect(pack.content?.tab, `pack "${code}" tab misses {n}`).toContain(
        "{n}"
      );
      expect(
        pack.search?.latest,
        `pack "${code}" misses search.latest`
      ).toBeTruthy();
    }
  });

  it("resolves the page locale's labels for a content component", () => {
    const de = resolveUIStrings("de", { defaultLocale: "en" });
    const strings = contentStrings(
      { config: { i18n: {} }, ui: EN_UI, uiByLocale: { de } },
      "de"
    );
    expect(strings.content.prop).toBe("Eigenschaft");
    expect(strings.content.preview).toBe("Vorschau");
    expect(strings.content.tab).toBe("Tab {n}");
    expect(de.search.latest).toBe("neueste");
  });

  it("falls back to English for a locale with no pack", () => {
    const xx = resolveUIStrings("xx", { defaultLocale: "en" });
    expect(xx.content.selectTab).toBe("Select tab");
    expect(xx.search.latest).toBe("latest");
  });
});
