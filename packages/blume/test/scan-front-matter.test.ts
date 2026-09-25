import { describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import { join } from "pathe";

import matter from "../src/core/frontmatter.ts";
import { normalizeEntry, scanBody } from "../src/core/sources/normalize.ts";
import {
  blumeMarkdownProcessor,
  blumeMdxProcessor,
} from "../src/markdown/index.ts";

const slugs = (body: string, format: "md" | "mdx" = "md"): string[] =>
  scanBody(body, format).headings.map((heading) => heading.slug);

/** The heading slugs of a `.md` body, rendered as Astro renders it: trimmed. */
const renderedMdSlugs = async (body: string): Promise<string[]> => {
  const renderer = await blumeMarkdownProcessor({}).createRenderer({});
  const { metadata } = await renderer.render(body.trim());
  return metadata.headings.map((heading: { slug: string }) => heading.slug);
};

const GET_HEADINGS = /getHeadings\(\) \{ return (?<json>.*); \}/u;

/**
 * The heading slugs of an `.mdx` body, compiled as Astro compiles it: the page
 * handed over whole, its front matter blanked to spaces.
 */
const renderedMdxSlugs = async (body: string): Promise<string[]> => {
  const { createMdxRenderer } = blumeMdxProcessor({});
  if (!createMdxRenderer) {
    throw new Error("expected Sätteri's MDX renderer");
  }
  const renderer = await createMdxRenderer(
    {},
    { optimize: false, srcDir: pathToFileURL(`${tmpdir()}/`) }
  );
  const blanked = `${" ".repeat(3)}\n${" ".repeat(11)}\n${" ".repeat(3)}\n`;
  const { code } = await renderer.process(
    `${blanked}${body}`,
    join(tmpdir(), "blume-scan-front-matter.mdx"),
    {}
  );
  const headings: { slug: string }[] = JSON.parse(
    GET_HEADINGS.exec(code)?.groups?.json ?? "[]"
  );
  return headings.map((heading) => heading.slug);
};

// Bodies whose front matter was already stripped, each opening with a block a
// front matter parser would read: a blank line after the dashes, a setext
// look-alike, blank lines ahead of it and a `...` close, and one never closed.
const BODIES = [
  ["---", "", "# First", "", "---", "", "## Second"].join("\n"),
  ["---", "Intro", "---", "", "## After"].join("\n"),
  ["", "", "---", "Intro", "...", "", "## After"].join("\n"),
  ["---", "", "## Unclosed"].join("\n"),
];

describe("a raw document's front matter", () => {
  it("is skipped when a blank line follows the opening dashes", () => {
    const raw = [
      "---",
      "",
      "title: Setup",
      "description: How to",
      "---",
      "",
      "## Ordering",
    ].join("\n");
    // core/frontmatter.ts reads the block as front matter, and so does the
    // scan — its YAML is no setext heading underlined by the closing dashes.
    expect(matter(raw).data).toStrictEqual({
      description: "How to",
      title: "Setup",
    });
    const scan = scanBody(raw);
    expect(scan.headings).toStrictEqual([
      { depth: 2, slug: "ordering", text: "Ordering" },
    ]);
    // Line numbers still count the block.
    expect(scan.sites).toStrictEqual([{ line: 7, pinned: false }]);
  });
});

describe("a stripped body that opens with a --- block", () => {
  it("drops the block from a .md body, as the renderer does", async () => {
    const scanned = BODIES.map((body) => slugs(body));
    expect(scanned).toStrictEqual(
      await Promise.all(BODIES.map(renderedMdSlugs))
    );
    expect(scanned).toStrictEqual([
      ["second"],
      ["after"],
      ["after"],
      ["unclosed"],
    ]);
  });

  it("keeps the block in an .mdx body, as the compiler does", async () => {
    const scanned = BODIES.map((body) => slugs(body, "mdx"));
    expect(scanned).toStrictEqual(
      await Promise.all(BODIES.map(renderedMdxSlugs))
    );
    expect(scanned[1]).toStrictEqual(["intro", "after"]);
  });

  it("is scanned in the format of the page it belongs to", () => {
    const headingsOf = (format: "md" | "mdx"): string[] => {
      const [page] = normalizeEntry(
        {
          body: { format, text: BODIES[1] ?? "" },
          data: { title: "Page" },
          ref: `page.${format}`,
        },
        { defaultType: "doc", source: { name: "s", staged: false } }
      ).pages;
      return page?.headings.map((heading) => heading.slug) ?? [];
    };
    expect(headingsOf("md")).toStrictEqual(["after"]);
    expect(headingsOf("mdx")).toStrictEqual(["intro", "after"]);
  });
});
