import { describe, expect, it } from "bun:test";

import { astroConfigTemplate } from "../src/astro/templates.ts";
import {
  NEW_TAB_ATTRS,
  NEW_TAB_HINT_ID,
  newTabAttrs,
} from "../src/core/new-tab.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { ProjectContext } from "../src/core/types.ts";
import { externalLinksPlugin } from "../src/markdown/external-links.ts";
import {
  blumeMarkdownProcessor,
  blumeMdxProcessor,
} from "../src/markdown/index.ts";
import { tailwindEntryTemplate } from "../src/theme/entry.ts";

describe(newTabAttrs, () => {
  it("opens absolute and protocol-relative URLs in a new tab", () => {
    expect(newTabAttrs("https://example.com")).toBe(NEW_TAB_ATTRS);
    expect(newTabAttrs("//cdn.example.com/x")).toBe(NEW_TAB_ATTRS);
    expect(NEW_TAB_ATTRS).toStrictEqual({
      "aria-describedby": NEW_TAB_HINT_ID,
      rel: "noreferrer",
      target: "_blank",
    });
  });

  it("leaves routes, fragments, other schemes, and no href alone", () => {
    for (const href of ["/guide", "#install", "mailto:a@b.c", "http-status"]) {
      expect(newTabAttrs(href)).toStrictEqual({});
    }
    expect(newTabAttrs()).toStrictEqual({});
  });
});

describe(externalLinksPlugin, () => {
  interface LinkNode {
    properties: Record<string, string | string[]>;
    tagName: string;
    type: string;
  }

  /** Run the plugin over one `<a>` and return the properties it recorded. */
  const visit = (properties: LinkNode["properties"]) => {
    const node: LinkNode = { properties, tagName: "a", type: "element" };
    const recorded: Record<
      string,
      string | number | boolean | (string | number)[]
    > = {};
    externalLinksPlugin().element.visit(node, {
      setProperty(_node, key, value) {
        recorded[key] = value;
      },
    });
    return recorded;
  };

  it("marks an external link to open in a new tab", () => {
    expect(visit({ href: "https://example.com" })).toStrictEqual({
      ariaDescribedBy: [NEW_TAB_HINT_ID],
      dataBlumeExternal: "",
      rel: ["noreferrer"],
      target: "_blank",
    });
  });

  it("leaves internal and hrefless links alone", () => {
    expect(visit({ href: "/guide" })).toStrictEqual({});
    expect(visit({ href: "mailto:a@b.c" })).toStrictEqual({});
    expect(visit({})).toStrictEqual({});
    // hast allows token lists; only a string href is a URL.
    expect(visit({ href: ["https://example.com"] })).toStrictEqual({});
  });
});

/** Build a processor's renderer and return the HTML for a source string. */
const renderTo = async (
  processor: ReturnType<typeof blumeMarkdownProcessor>,
  source: string
): Promise<string> => {
  const renderer = await processor.createRenderer({});
  const result = await renderer.render(source);
  return result.code;
};

/** Link forms valid in both `.md` and `.mdx`. */
const SOURCE = [
  "Check the [status page](https://status.example.com), read the",
  "[guide](/guide), jump to [install](#install), or [email us](mailto:a@b.c).",
  "Autolinked: www.bare.example.com. See the [reference][ref].",
  "",
  "[ref]: https://ref.example.com",
].join("\n");

const EXTERNAL =
  'target="_blank" rel="noreferrer" aria-describedby="blume-new-tab-hint" data-blume-external=""';

describe("markdown.externalLinks in the processors", () => {
  for (const [name, make] of [
    [".md", blumeMarkdownProcessor],
    [".mdx", blumeMdxProcessor],
  ] as const) {
    it(`opens external ${name} links in a new tab when on`, async () => {
      const html = await renderTo(make({ externalLinks: true }), SOURCE);
      for (const href of [
        "https://status.example.com",
        "http://www.bare.example.com",
        "https://ref.example.com",
      ]) {
        expect(html).toContain(`<a href="${href}" ${EXTERNAL}>`);
      }
      // Site routes, fragments, and other schemes stay in the tab.
      expect(html).toContain('<a href="/guide">');
      expect(html).toContain('<a href="#install">');
      expect(html).toContain('<a href="mailto:a@b.c">');
    });

    it(`leaves ${name} links untouched by default`, async () => {
      const html = await renderTo(make({}), SOURCE);
      expect(html).toContain('<a href="https://status.example.com">');
      expect(html).not.toContain("data-blume-external");
    });
  }

  it("marks a .md angle-bracket autolink but not a raw HTML anchor", async () => {
    // Both are .md-only syntax: MDX rejects `<https://…>` and parses `<a>`
    // as JSX.
    const html = await renderTo(
      blumeMarkdownProcessor({ externalLinks: true }),
      '<https://auto.example.com>\n\n<a href="https://raw.example.com">raw</a>'
    );
    expect(html).toContain(`<a href="https://auto.example.com" ${EXTERNAL}>`);
    expect(html).toContain('<a href="https://raw.example.com">raw</a>');
  });
});

describe("markdown.externalLinks config", () => {
  it("defaults to off", () => {
    expect(blumeConfigSchema.parse({}).markdown.externalLinks).toBe(false);
  });

  it("threads the option into both processors", () => {
    const config = blumeConfigSchema.parse({
      markdown: { externalLinks: true },
    });
    // SAFETY: astroConfigTemplate reads only root, outDir, and pagesRoot from
    // the context.
    const context = {
      outDir: "/r/.blume",
      pagesRoot: null,
      root: "/r",
    } as ProjectContext;
    const output = astroConfigTemplate({
      askPath: "/r/.blume/src/generated/Ask.astro",
      config,
      contentRoutes: [],
      context,
      examplesPath: "/r/.blume/src/generated/examples.ts",
      examplesThemePath: "/r/.blume/src/generated/examples.css",
      featuresPath: "/r/.blume/src/generated/features.ts",
      needsReact: false,
      pages: [],
      searchClientPath: "/r/.blume/src/generated/search-client.ts",
      themePath: "/r/.blume/src/generated/app.css",
    });
    expect(output.match(/"externalLinks":true/gu)).toHaveLength(2);
  });

  it("draws the arrow from the marker, skipping image-only links", () => {
    const css = tailwindEntryTemplate({
      configTokens: "",
      sources: [],
      userTheme: "",
    });
    expect(css).toContain(
      ".prose :where(a[data-blume-external]:not(:has(img, svg)))::after"
    );
    expect(css).toContain('mask: url("data:image/svg+xml,');
  });
});
