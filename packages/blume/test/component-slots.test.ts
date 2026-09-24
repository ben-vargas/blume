import { describe, expect, it } from "bun:test";

import { importSpecifier } from "../src/astro/component-slots.ts";

describe("importSpecifier", () => {
  it("keeps the path as it is without a directory to be relative to", () => {
    expect(importSpecifier("/p/components/Callout.astro")).toBe(
      "/p/components/Callout.astro"
    );
  });

  it("leaves a bare package specifier alone", () => {
    expect(importSpecifier("@acme/ui/Callout.astro", "/p/src/generated")).toBe(
      "@acme/ui/Callout.astro"
    );
  });

  it("walks up out of the importing file's directory", () => {
    expect(
      importSpecifier("/p/components/Callout.astro", "/p/src/generated")
    ).toBe("../../components/Callout.astro");
  });

  it("marks a file beside or below the importer as relative", () => {
    expect(
      importSpecifier("/p/src/generated/local/Tip.astro", "/p/src/generated")
    ).toBe("./local/Tip.astro");
  });
});
