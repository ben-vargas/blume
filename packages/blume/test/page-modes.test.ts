import { describe, expect, it } from "bun:test";

import { PAGE_MODES, pageModeLayout } from "../src/core/page-modes.ts";
import { pageMetaSchema } from "../src/core/schema.ts";

/**
 * Page layout modes (`mode` frontmatter, `src/core/page-modes.ts`): what a
 * page shows around its content, in Mintlify's names.
 */

describe(pageModeLayout, () => {
  it("keeps everything by default", () => {
    expect(pageModeLayout()).toEqual({
      chrome: true,
      sidebar: true,
      toc: true,
      width: "content",
    });
    expect(pageModeLayout("default")).toEqual(pageModeLayout());
  });

  it("drops what each mode drops", () => {
    expect(pageModeLayout("wide")).toEqual({
      chrome: true,
      sidebar: true,
      toc: false,
      width: "full",
    });
    expect(pageModeLayout("center")).toEqual({
      chrome: true,
      sidebar: false,
      toc: false,
      width: "center",
    });
    expect(pageModeLayout("custom")).toEqual({
      chrome: false,
      sidebar: false,
      toc: false,
      width: "full",
    });
    expect(pageModeLayout("frame")).toEqual({
      chrome: false,
      sidebar: true,
      toc: false,
      width: "full",
    });
  });
});

describe("the mode frontmatter", () => {
  it("takes the modes Blume renders, and not Mintlify's assistant mode", () => {
    for (const mode of PAGE_MODES) {
      expect(pageMetaSchema.safeParse({ mode }).success).toBe(true);
    }
    expect(pageMetaSchema.safeParse({ mode: "assistant" }).success).toBe(false);
  });
});
