import { describe, expect, it } from "bun:test";

import { checkTerms, shortId, unknownCheckTerms } from "../src/audit/terms.ts";

describe("audit --only/--skip terms", () => {
  it("shortens a check id to its lowercase suffix", () => {
    expect(shortId("BLUME_AUDIT_LINK_TO_BROKEN")).toBe("link_to_broken");
  });

  it("lists every category and short check id once", () => {
    const terms = checkTerms();
    expect(terms).toContain("links");
    expect(terms).toContain("link_to_broken");
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("accepts short ids, full ids, and categories in any case", () => {
    expect(
      unknownCheckTerms([
        "links",
        "LINK_TO_BROKEN",
        "blume_audit_link_to_broken",
        " Content ",
      ])
    ).toEqual([]);
  });

  it("returns the terms that name nothing", () => {
    expect(unknownCheckTerms(["link", "links", "nonsense"])).toEqual([
      "link",
      "nonsense",
    ]);
  });
});
