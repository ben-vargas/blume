import { describe, expect, it } from "bun:test";

import { mdxToJs } from "satteri";
import type { MdastPluginDefinition } from "satteri";

import { downlevelComponents } from "../src/ai/component-markdown.ts";
import { catchAllPageTemplate } from "../src/astro/templates.ts";
import { API_RAIL_KEY, apiRailPlugin } from "../src/markdown/api-rail.ts";

/**
 * The example rail (`src/markdown/api-rail.ts`): top-level
 * `<RequestExample>` and `<ResponseExample>` move into an `<ApiRail>` at the
 * end of the page, request first, and the render tells the layout.
 */

const PAGE = [
  "# Create a user",
  "",
  "<ResponseExample>",
  "```json 201",
  '{ "ok": true }',
  "```",
  "</ResponseExample>",
  "",
  "Some prose with {1 + 1}.",
  "",
  "<RequestExample dropdown>",
  "```bash cURL",
  "curl https://api.example.com",
  "```",
  "</RequestExample>",
  "",
  "<Tabs><RequestExample>nested stays</RequestExample></Tabs>",
].join("\n");

// SAFETY: the plugin models the slice of Satteri's visitor protocol it
// uses, as Blume's pipeline bridges it (see `asMdastPlugin` there).
const asMdastPlugin = (plugin: { name: string }): MdastPluginDefinition =>
  plugin as MdastPluginDefinition;

/** Compile with the plugin, returning the code and the render frontmatter. */
const compile = async (source: string, withFrontmatter = true) => {
  // The render data Astro hands a compile, with the frontmatter plugins write to.
  const data: Record<string, { frontmatter: Record<string, boolean> }> =
    withFrontmatter ? { astro: { frontmatter: {} } } : {};
  const result = await mdxToJs(source, {
    data,
    mdastPlugins: [asMdastPlugin(apiRailPlugin())],
  });
  return { code: result.code, data };
};

describe(apiRailPlugin, () => {
  it("moves top-level examples into a rail at the end, request first, and flags the render", async () => {
    const { code, data } = await compile(PAGE);
    const rail = code.slice(code.indexOf("_jsxs(ApiRail"));
    expect(rail.indexOf("RequestExample")).toBeLessThan(
      rail.indexOf("ResponseExample")
    );
    expect(rail).toContain("dropdown: true");
    expect(rail).toContain("curl https://api.example.com");
    // A nested example stays where it was written.
    expect(code).toContain(
      '_jsx(Tabs, { children: _jsx(RequestExample, { children: "nested stays" }) })'
    );
    expect(data).toEqual({ astro: { frontmatter: { [API_RAIL_KEY]: true } } });
  });

  it("leaves a page without examples alone, and needs no frontmatter to move them", async () => {
    const plain = await compile("# Plain\n\nText.\n");
    expect(plain.code).not.toContain("ApiRail");
    expect(plain.data).toEqual({ astro: { frontmatter: {} } });
    const bare = await compile(PAGE, false);
    expect(bare.code).toContain("ApiRail");
    expect(bare.data).toEqual({});
  });
});

describe("the page template", () => {
  it("passes the rail flag to the layout", () => {
    expect(
      catchAllPageTemplate({
        exportEpub: false,
        exportPdf: false,
        mathEnabled: false,
        needsReact: false,
      })
    ).toContain(`apiRail={remarkPluginFrontmatter?.${API_RAIL_KEY} === true}`);
  });
});

describe("the Markdown downlevel", () => {
  it("writes the examples as their code blocks", async () => {
    const source = [
      "<RequestExample>",
      "```bash cURL",
      "curl x",
      "```",
      "</RequestExample>",
      "",
      "<ResponseExample>",
      "```json 200",
      "{}",
      "```",
      "</ResponseExample>",
    ].join("\n");
    expect(await downlevelComponents(source)).toBe(
      ["```bash cURL", "curl x", "```", "", "```json 200", "{}", "```"].join(
        "\n"
      )
    );
  });
});
