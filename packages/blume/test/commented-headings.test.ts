import { describe, expect, it } from "bun:test";

import { normalizeEntry, scanBody } from "../src/core/sources/normalize.ts";

const pageFor = (ref: string, text: string, format: "md" | "mdx" = "md") =>
  normalizeEntry(
    { body: { format, text }, data: {}, ref },
    { defaultType: "doc", source: { name: "s", staged: false } }
  ).pages[0];

const texts = (body: string): string[] =>
  scanBody(body).headings.map((heading) => heading.text);

describe("headings inside comments", () => {
  it("skips a heading in a multi-line HTML comment", () => {
    const body = [
      "<!--",
      "# Old draft title",
      "## Old section",
      "-->",
      "",
      "## Real section",
    ].join("\n");
    expect(texts(body)).toStrictEqual(["Real section"]);
  });

  it("skips a heading in a multi-line MDX comment", () => {
    const body = ["  {/*", "# Old draft title", "*/ }", "## Real section"].join(
      "\n"
    );
    expect(texts(body)).toStrictEqual(["Real section"]);
  });

  it("keeps headings around comments that close on their own line", () => {
    const body = [
      "<!-- a note -->",
      "# Title",
      "{/* another note */}",
      "<!-->",
      "## Next",
    ].join("\n");
    expect(texts(body)).toStrictEqual(["Title", "Next"]);
  });

  it("reads a fence inside a comment as commented out, and a comment inside a fence as code", () => {
    const body = [
      "<!--",
      "```",
      "-->",
      "## After the comment",
      "```md",
      "<!--",
      "```",
      "## After the fence",
    ].join("\n");
    expect(texts(body)).toStrictEqual(["After the comment", "After the fence"]);
  });

  it("keeps a commented-out heading out of the title and the anchors", () => {
    const page = pageFor(
      "guides/setup.md",
      '<!--\n# Old draft title\n<a id="gone"></a>\n-->\n\nBody text.\n<a id="kept"></a>\n'
    );
    expect(page?.title).toBe("Setup");
    expect(page?.headings).toStrictEqual([]);
    expect(page?.anchors).toStrictEqual(["kept"]);
  });

  it("ignores comment syntax inside a Prompt", () => {
    const body = ["<Prompt>", "<!--", "</Prompt>", "## Visible"].join("\n");
    expect(texts(body)).toStrictEqual(["Visible"]);
  });
});

describe("titles derived from file names", () => {
  it("spells acronyms the way the sidebar spells folder names", () => {
    expect(pageFor("faq.md", "Body.\n")?.title).toBe("FAQ");
    expect(pageFor("guides/rest-api.md", "Body.\n")?.title).toBe("Rest API");
    expect(pageFor("02-cli-reference.md", "Body.\n")?.title).toBe(
      "CLI Reference"
    );
  });

  it("names an untitled index page after its folder", () => {
    expect(pageFor("guides/index.md", "Body.\n")?.title).toBe("Guides");
    expect(pageFor("01-api-docs/index.mdx", "Body.\n", "mdx")?.title).toBe(
      "API Docs"
    );
    expect(pageFor("(beta)/01-index.md", "Body.\n")?.title).toBe("Beta");
    // The content root's own index has no folder to borrow from.
    expect(pageFor("index.md", "Body.\n")?.title).toBe("Index");
  });
});
