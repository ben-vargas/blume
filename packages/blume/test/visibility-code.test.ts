import { describe, expect, it } from "bun:test";

import {
  applyAgentVisibility,
  applyAudienceVisibility,
} from "../src/ai/visibility.ts";

/**
 * Code that shows `<Visibility>` markup is never resolved: a fenced block at
 * any indent (a fence under a `<Tab>` or `<Step>` is indented) and an inline
 * code span both keep what the author wrote.
 */
describe("Visibility markup inside code", () => {
  it("keeps an indented fence under a component as written", () => {
    const source = [
      '<Tab title="MDX">',
      "  ```mdx",
      '  <Visibility for="web">Only on the site.</Visibility>',
      "  ```",
      "</Tab>",
      "",
    ].join("\n");
    expect(applyAgentVisibility(source)).toBe(source);
    expect(applyAudienceVisibility(source, "web")).toBe(source);
  });

  it("keeps an inline code span as written", () => {
    const source =
      'Wrap it in `<Visibility for="web">…</Visibility>` to hide it from agents.\n';
    expect(applyAgentVisibility(source)).toBe(source);
  });

  it("still resolves real blocks beside the code", () => {
    const source = [
      'Use `<Visibility for="agents">` like this:',
      "",
      '<Visibility for="web">',
      "Web only.",
      "</Visibility>",
      "",
      '<Visibility for="agents">',
      "Agents only, with `code`.",
      "</Visibility>",
      "",
      "~~~md",
      '<Visibility for="web">shown</Visibility>',
      "~~~",
      "",
    ].join("\n");
    expect(applyAgentVisibility(source)).toBe(
      [
        'Use `<Visibility for="agents">` like this:',
        "",
        "Agents only, with `code`.",
        "",
        "~~~md",
        '<Visibility for="web">shown</Visibility>',
        "~~~",
        "",
      ].join("\n")
    );
  });

  it("reads an unclosed fence as code to the end", () => {
    const source = '```md\n<Visibility for="web">shown</Visibility>\n';
    expect(applyAgentVisibility(source)).toBe(source);
  });
});
