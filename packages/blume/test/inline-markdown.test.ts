import { describe, expect, it } from "bun:test";

import {
  renderInlineMarkdown,
  unwrapParagraph,
} from "../src/components/content/inline-markdown.ts";

describe("renderInlineMarkdown", () => {
  it("shows raw HTML as text but leaves entities authorable", async () => {
    expect(await renderInlineMarkdown("<b>bold</b> *em*")).toBe(
      "&lt;b&gt;bold&lt;/b&gt; <em>em</em>"
    );
    expect(await renderInlineMarkdown("x <img src=y onerror=alert(1)>")).toBe(
      "x &lt;img src=y onerror=alert(1)&gt;"
    );
    // A block of raw HTML (and a comment) is text too, not markup.
    expect(await renderInlineMarkdown("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(await renderInlineMarkdown("<!-- note --> after")).toBe(
      "&lt;!-- note --&gt; after"
    );
    // CommonMark resolves entities itself, so `&copy;` keeps rendering as ©
    // instead of the literal text `&copy;`.
    expect(await renderInlineMarkdown("a &copy; b")).toBe("a © b");
  });

  it("keeps angle brackets in code spans and autolinks intact", async () => {
    expect(
      await renderInlineMarkdown("Use `Array<string>` and ``a ` <b>``")
    ).toBe(
      "Use <code>Array&lt;string&gt;</code> and <code>a ` &lt;b&gt;</code>"
    );
    expect(await renderInlineMarkdown("See <https://x.dev/a?b=1&c=2>")).toBe(
      'See <a href="https://x.dev/a?b=1&amp;c=2">https://x.dev/a?b=1&amp;c=2</a>'
    );
    expect(await renderInlineMarkdown("Mail <team@x.dev>")).toBe(
      'Mail <a href="mailto:team@x.dev">team@x.dev</a>'
    );
  });
});

describe("unwrapParagraph", () => {
  it("unwraps a single rendered paragraph", () => {
    expect(unwrapParagraph("<p>hi <em>there</em></p>")).toBe(
      "hi <em>there</em>"
    );
    expect(unwrapParagraph("  <p>trimmed</p>\n")).toBe("trimmed");
  });

  it("leaves multi-paragraph and non-paragraph HTML balanced", () => {
    const multi = "<p>a</p>\n<p>b</p>";
    expect(unwrapParagraph(multi)).toBe(multi);
    expect(unwrapParagraph("<ul><li>x</li></ul>")).toBe("<ul><li>x</li></ul>");
  });
});
