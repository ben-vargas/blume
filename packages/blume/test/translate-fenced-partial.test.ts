import { describe, expect, it } from "bun:test";

import { validateTranslation } from "../src/translate/validate.ts";

/**
 * A frontmatter-less partial that is a single code block starts and ends
 * with its own fence. Agents sometimes wrap their whole reply in a fence, and
 * validation strips that wrapper — but it must never strip the source's own.
 */

const PARTIAL = "```bash\nnpm install blume\n```\n";

describe("validating a source that is one fenced block", () => {
  it("keeps the source's own fences when the reply matches it", () => {
    expect(validateTranslation(PARTIAL, PARTIAL)).toEqual({
      ok: true,
      text: PARTIAL,
    });
  });

  it("still strips a fence the agent wrapped around it", () => {
    expect(
      validateTranslation(PARTIAL, `\`\`\`\`md\n${PARTIAL}\`\`\`\``)
    ).toEqual({
      ok: true,
      text: PARTIAL,
    });
  });

  it("still fails a reply that drops the block's fences", () => {
    expect(validateTranslation(PARTIAL, "npm install blume\n")).toEqual({
      ok: false,
      reason: "code fence count changed (source has 2, translation has 0)",
    });
  });
});
