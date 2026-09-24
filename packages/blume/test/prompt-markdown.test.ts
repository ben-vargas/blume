import { describe, expect, it } from "bun:test";

import { promptMarkdown } from "../src/components/content/prompt-markdown.ts";

describe("promptMarkdown", () => {
  it("keeps links, list markers, and inline code a plain textContent drops", () => {
    const html = [
      "<p>Do these steps:</p><ul>",
      '<li>Install the <a href="https://www.npmjs.com/package/blume">package</a></li>',
      "<li>Run <code>npx blume init</code></li>",
      "</ul><p>Then report back.</p>",
    ].join("\n");
    expect(promptMarkdown(html)).toBe(
      [
        "Do these steps:",
        "",
        "- Install the [package](https://www.npmjs.com/package/blume)",
        "- Run `npx blume init`",
        "",
        "Then report back.",
      ].join("\n")
    );
  });

  it("renders headings, emphasis, strikethrough, images, and line breaks", () => {
    const html = [
      "<h2>Goal</h2>",
      "<p>Fix <strong> the bug </strong>and <em>test</em> it, <b>bold</b>",
      " <i>italic</i> <del>old</del> <s>gone</s> <strong> </strong></p>",
      '<p><img src="/a.png" alt="Diagram"> <img alt="no source"> <img src="/b.png"></p>',
      "<p>line<br>break</p>",
    ].join("");
    expect(promptMarkdown(html)).toBe(
      [
        "## Goal",
        "",
        "Fix **the bug** and _test_ it, **bold** _italic_ ~~old~~ ~~gone~~",
        "",
        "![Diagram](/a.png) ![](/b.png)",
        "",
        "line\nbreak",
      ].join("\n")
    );
  });

  it("writes a bare URL once when a link's text is its own href", () => {
    expect(
      promptMarkdown(
        '<p>See <a href="https://x.dev">https://x.dev</a>, <a>no href</a>, and <a href="/y"></a>.</p>'
      )
    ).toBe("See https://x.dev, no href, and /y.");
  });

  it("nests tight and loose lists, honoring an ordered list's start", () => {
    const html = [
      "<ul><li>One<ul><li>nested</li></ul></li><li>Two</li></ul>",
      '<ol start="3"><li><p>First</p><ul><li>nested</li></ul></li><li>Second</li></ol>',
      '<ol start="x"><li>Defaults to one</li></ol>',
      "<ul>\n<!-- comment --><li>Only items count</li></ul>",
    ].join("");
    expect(promptMarkdown(html)).toBe(
      [
        "- One",
        "  - nested",
        "- Two",
        "",
        "3. First",
        "",
        "   - nested",
        "4. Second",
        "",
        "1. Defaults to one",
        "",
        "- Only items count",
      ].join("\n")
    );
  });

  it("fences code blocks with their language and a fence longer than any inside", () => {
    const html = [
      '<pre data-language="ts"><code><span class="line">const a = "```";</span>\n',
      '<span class="line">b()</span>\n</code></pre>',
      '<pre><code class="language-sh">npm i</code></pre>',
      "<pre>plain</pre>",
    ].join("");
    expect(promptMarkdown(html)).toBe(
      [
        "````ts",
        'const a = "```";',
        "b()",
        "````",
        "",
        "```sh",
        "npm i",
        "```",
        "",
        "```",
        "plain",
        "```",
      ].join("\n")
    );
  });

  it("pads an inline code span that starts or ends with a backtick", () => {
    expect(
      promptMarkdown("<p><code>`tick`</code> and <code>a</code></p>")
    ).toBe("`` `tick` `` and `a`");
  });

  it("quotes every line of a blockquote and renders rules and containers", () => {
    const html = [
      "<blockquote><p>Note one</p><p>Two</p></blockquote>",
      "<hr>",
      "<div><section><p>Inside</p>loose text</section></div>",
    ].join("");
    expect(promptMarkdown(html)).toBe(
      [
        "> Note one",
        ">",
        "> Two",
        "",
        "---",
        "",
        "Inside",
        "",
        "loose text",
      ].join("\n")
    );
  });

  it("leaves out chrome, scripts, and hidden content", () => {
    const html = [
      "<p>Keep <button>Copy</button><svg><text>icon</text></svg>this</p>",
      "<script>alert(1)</script><style>p{}</style><template><p>t</p></template>",
      '<div hidden><p>hidden</p></div><p aria-hidden="true">aria</p>',
      '<span aria-hidden="true">x</span>',
    ].join("");
    expect(promptMarkdown(html)).toBe("Keep this");
  });

  it("returns an empty string for an empty body", () => {
    expect(promptMarkdown("")).toBe("");
    expect(promptMarkdown("<p>   </p>")).toBe("");
  });
});
