import { describe, expect, it } from "bun:test";

import { resolveLocalizable } from "../src/core/localizable.ts";

describe(resolveLocalizable, () => {
  const label = { de: "Neu", en: "New", fr: "Nouveau" };

  it("renders a plain string in every locale", () => {
    expect(resolveLocalizable("New", "fr", "en")).toBe("New");
  });

  it("takes the active locale's entry", () => {
    expect(resolveLocalizable(label, "fr", "en")).toBe("Nouveau");
  });

  it("falls back to the default locale's entry, then the first", () => {
    expect(resolveLocalizable(label, "ja", "en")).toBe("New");
    expect(resolveLocalizable(label, "ja", "pt")).toBe("Neu");
    // No locale (a single-locale site): the default's, else the first.
    expect(resolveLocalizable(label, undefined, "en")).toBe("New");
    expect(resolveLocalizable(label)).toBe("Neu");
  });

  it("renders nothing for an empty map", () => {
    expect(resolveLocalizable({}, "en", "en")).toBe("");
  });
});
