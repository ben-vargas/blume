import { describe, expect, it } from "bun:test";

import { downlevelComponents } from "../src/ai/component-markdown.ts";

/**
 * A downleveled block stands where the JSX's closing tag used to end the
 * block. Markdown written on the next line would otherwise read as a lazy
 * continuation — a paragraph after `</Callout>` joining the blockquote, one
 * after `</Steps>` joining the last list item.
 */
describe("text straight after a downleveled block", () => {
  it("starts its own paragraph after a callout", () => {
    expect(
      downlevelComponents("<Callout>\nBody.\n</Callout>\nNext paragraph.\n")
    ).toBe("> **Info**\n>\n> Body.\n\nNext paragraph.\n");
  });

  it("starts its own paragraph after steps and a prompt", () => {
    expect(
      downlevelComponents(
        '<Steps>\n<Step title="A">\nDo.\n</Step>\n</Steps>\nAfter.\n'
      )
    ).toBe("1. **A**\n\n    Do.\n\nAfter.\n");
    expect(
      downlevelComponents(
        '<Prompt description="Try">\nHi there\n</Prompt>\nNext.\n'
      )
    ).toBe("**Try**\n\n> Hi there\n\nNext.\n");
  });

  it("keeps adjacent callouts as two quotes", () => {
    expect(
      downlevelComponents("<Callout>A</Callout>\n<Callout>B</Callout>\n")
    ).toBe("> **Info**\n>\n> A\n\n> **Info**\n>\n> B\n");
  });

  it("adds nothing when a blank line already follows", () => {
    expect(downlevelComponents("<Callout>A</Callout>\n\nNext.\n")).toBe(
      "> **Info**\n>\n> A\n\nNext.\n"
    );
  });

  it("separates a nested block from the text after it, dedented", () => {
    expect(
      downlevelComponents(
        '<Tabs>\n  <Tab title="x">\n    <Callout>\n    A\n    </Callout>\n    After.\n  </Tab>\n</Tabs>\n'
      )
    ).toBe("**x**\n\n> **Info**\n>\n> A\n\nAfter.\n");
    expect(
      downlevelComponents(
        "<Wrapper>\n  <Callout>\n  A\n  </Callout>\n  After.\n</Wrapper>\n"
      )
    ).toBe("<Wrapper>\n  > **Info**\n  >\n  > A\n\n  After.\n</Wrapper>\n");
  });

  it("leaves inline components and empty renderings alone", () => {
    expect(downlevelComponents("Text <Badge>new</Badge>\nmore.\n")).toBe(
      "Text new\nmore.\n"
    );
    expect(downlevelComponents('<Icon name="x" />\nNext\n')).toBe("\nNext\n");
  });
});
