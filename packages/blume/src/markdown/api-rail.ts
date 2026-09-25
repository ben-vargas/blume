import { jsxFlowElement } from "./mdast.ts";
import type { MdastNode, MdastValue } from "./mdast.ts";

/**
 * `<RequestExample>` and `<ResponseExample>` pin to a column beside the page,
 * as Mintlify renders them: this plugin moves each top-level one into an
 * `<ApiRail>` at the end of the document, request examples first, and flags
 * the render so the layout makes room for the column (see `ApiRail.astro`).
 * Below `xl` the rail follows the page's content, and the examples are
 * ordinary code groups there. An example nested in another component stays
 * where it is written.
 */

/** The render-frontmatter key that tells the layout a page has a rail. */
export const API_RAIL_KEY = "blumeApiRail";

/** The components that move to the rail, in the order they stack there. */
const RAIL_COMPONENTS = ["RequestExample", "ResponseExample"];

/** The root, as the plugin's `after` hook receives it. */
interface RailRoot {
  children: MdastNode[];
}

/** The slice of Satteri's visitor context the plugin uses. */
export interface ApiRailContext {
  appendChild: (node: RailRoot, child: MdastNode) => void;
  data?: { astro?: { frontmatter?: Record<string, MdastValue> } };
  removeNode: (node: MdastNode) => void;
}

/**
 * A detached copy of a node Satteri materialized lazily: its own fields,
 * children included, without the arena handles that tie it to its old place.
 * Appending the original instead would move an empty shell.
 */
const detach = (node: MdastNode): MdastNode =>
  JSON.parse(
    JSON.stringify(node, (key: string, value: MdastValue) =>
      key === "_id" || key === "_resolver" ? undefined : value
    )
  );

const isName = (value: MdastValue): value is string =>
  typeof value === "string";

const railIndex = (node: MdastNode): number =>
  node.type === "mdxJsxFlowElement" && isName(node.name)
    ? RAIL_COMPONENTS.indexOf(node.name)
    : -1;

export const apiRailPlugin = () => ({
  after(root: RailRoot, ctx: ApiRailContext) {
    const examples = root.children.filter((node) => railIndex(node) !== -1);
    if (examples.length === 0) {
      return;
    }
    for (const example of examples) {
      ctx.removeNode(example);
    }
    ctx.appendChild(
      root,
      jsxFlowElement(
        "ApiRail",
        [],
        examples.toSorted((a, b) => railIndex(a) - railIndex(b)).map(detach)
      )
    );
    const frontmatter = ctx.data?.astro?.frontmatter;
    if (frontmatter) {
      frontmatter[API_RAIL_KEY] = true;
    }
  },
  name: "blume-api-rail",
});
