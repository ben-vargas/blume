import { toString as mdastToString } from "mdast-util-to-string";

import { jsxAttribute, jsxFlowElement } from "./mdast.ts";
import type { MdastNode, MdastVisitorContext } from "./mdast.ts";

interface DirectiveNode extends MdastNode {
  attributes?: Record<string, string | null | undefined> | null;
  // Satteri gives an empty container directive (`:::note\n:::`) `children: null`.
  children?: MdastNode[] | null;
  name: string;
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
}

/**
 * The visitor-context slice the container visitor uses. `source` is the page
 * the directive offsets index into; without it the literal fallback rebuilds
 * a directive from its node instead.
 */
interface DirectiveVisitorContext extends MdastVisitorContext {
  source?: string;
}

/** The context slice the text and leaf visitors add: the parent chain. */
interface LiteralVisitorContext extends DirectiveVisitorContext {
  parent: (node: MdastNode) => MdastNode | undefined;
}

/** Directive names that map directly onto a Callout type. */
const CALLOUT_TYPES = new Set([
  "danger",
  "info",
  "note",
  "success",
  "tip",
  "warning",
]);

/** Friendly aliases for the canonical Callout types. */
interface CalloutAliases {
  [alias: string]: string;
}

const ALIASES: CalloutAliases = {
  caution: "warning",
  error: "danger",
  important: "note",
  warn: "warning",
};

/** Resolve a directive name to a Callout type, or `null` if it is not one. */
export const calloutTypeFor = (name: string): string | null => {
  const lower = name.toLowerCase();
  if (CALLOUT_TYPES.has(lower)) {
    return lower;
  }
  return ALIASES[lower] ?? null;
};

/** The markers that open a text (`:name`) and a leaf (`::name`) directive. */
const LITERAL_MARKERS = new Map([
  ["leafDirective", "::"],
  ["textDirective", ":"],
]);

/**
 * A text or leaf directive exactly as the author wrote it. The slice by
 * offsets is the exact text — `[label]` and `{attrs}` included — and is
 * trusted only when it opens with the directive's own marker and name;
 * content an `<include>` spliced in carries no offsets into this page, so it
 * is rebuilt from the node instead.
 */
const directiveSource = (
  node: DirectiveNode,
  marker: string,
  source: string
): string => {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  const opening = `${marker}${node.name}`;
  if (start !== undefined && end !== undefined) {
    const slice = source.slice(start, end);
    if (slice.startsWith(opening)) {
      return slice;
    }
  }
  const children = node.children ?? [];
  const label =
    children.length > 0
      ? `[${mdastToString(children, { includeImageAlt: false })}]`
      : "";
  const attributes = Object.entries(node.attributes ?? {}).map(
    ([key, value]) => (value ? `${key}="${value}"` : key)
  );
  const attributeText =
    attributes.length > 0 ? `{${attributes.join(" ")}}` : "";
  return `${opening}${label}${attributeText}`;
};

/**
 * The node a text or leaf directive renders as: its literal source, as text
 * in place of a text directive and as a paragraph in place of a leaf one.
 */
const literalDirective = (
  node: DirectiveNode,
  marker: string,
  source: string
): MdastNode => {
  const text = { type: "text", value: directiveSource(node, marker, source) };
  return marker === ":" ? text : { children: [text], type: "paragraph" };
};

/**
 * Swap every text and leaf directive under `node` for its literal source. The
 * callout visitor reads its label and moves its body before Satteri reaches
 * the directives inside them, so it literalizes both itself.
 */
const literalize = (node: MdastNode, source: string): MdastNode => {
  const marker = LITERAL_MARKERS.get(node.type);
  if (marker) {
    // SAFETY: only Satteri's `textDirective`/`leafDirective` nodes have a
    // marker, and they carry a `name` plus optional attributes, children,
    // and position — the `DirectiveNode` shape.
    return literalDirective(node as DirectiveNode, marker, source);
  }
  // SAFETY: a parent's `children` is always a node list; leaves carry none.
  const children = node.children as MdastNode[] | null | undefined;
  if (!children) {
    return node;
  }
  return {
    ...node,
    children: children.map((child) => literalize(child, source)),
  };
};

/** Whether a callout the container visitor rewrote (and literalized) holds `node`. */
const insideCallout = (node: MdastNode, ctx: LiteralVisitorContext) => {
  for (
    let parent = ctx.parent(node);
    parent !== undefined;
    parent = ctx.parent(parent)
  ) {
    if (
      parent.type === "containerDirective" &&
      // SAFETY: a `containerDirective` always carries its string `name`.
      calloutTypeFor((parent as DirectiveNode).name) !== null
    ) {
      return true;
    }
  }
  return false;
};

/** The text and leaf visitor: render the directive as its literal source. */
const renderLiteral =
  (marker: string) => (node: DirectiveNode, ctx: LiteralVisitorContext) => {
    // A callout's body was already literalized into its replacement; a
    // transform queued on the replaced original would be dropped with a
    // warning.
    if (insideCallout(node, ctx)) {
      return;
    }
    ctx.replaceNode(node, literalDirective(node, marker, ctx.source ?? ""));
  };

/**
 * Satteri MDAST plugin for directives. Container directives (`:::note`,
 * `:::warning`, `:::tip`, …) map onto Blume's `<Callout>` component: the title
 * comes from a `[label]` or a `{title="…"}` attribute, and the body becomes
 * the callout content; container names that are not callouts are left
 * untouched.
 *
 * Blume handles no text (`:name`) or leaf (`::name`) directives, and prose is
 * full of text that parses as one — `16:9`, `10:30am`, `og:image`,
 * `pets:read` — so both render as the literal source the author wrote instead
 * of vanishing.
 */
export const directiveToCalloutPlugin = () => ({
  containerDirective(node: DirectiveNode, ctx: DirectiveVisitorContext) {
    const type = calloutTypeFor(node.name);
    if (type === null) {
      return;
    }

    const source = ctx.source ?? "";
    const children = (node.children ?? []).map((child) =>
      literalize(child, source)
    );
    let title = node.attributes?.title ?? undefined;

    // A leading `:::name[Label]` parses to a paragraph flagged `directiveLabel`.
    // SAFETY: Satteri stamps `directiveLabel` on that paragraph's `data`; any
    // other node reads undefined and fails the check.
    const labelIndex = children.findIndex(
      (child) =>
        child.type === "paragraph" &&
        (child.data as { directiveLabel?: boolean } | undefined)?.directiveLabel
    );
    if (labelIndex !== -1) {
      const [label] = children.splice(labelIndex, 1);
      if (label) {
        // Flatten the label's phrasing children so `:::note[Read **this**]`
        // yields `Read this`; image alt is excluded (an image is not label
        // text), matching the historical child-values-only behavior.
        title ??= mdastToString(label, { includeImageAlt: false }) || undefined;
      }
    }

    const attributes = [jsxAttribute("type", type)];
    if (title) {
      attributes.push(jsxAttribute("title", title));
    }
    ctx.replaceNode(node, jsxFlowElement("Callout", attributes, children));
  },
  leafDirective: renderLiteral("::"),
  name: "blume-directive-callout",
  // Positions are opt-in since satteri 0.10; the literal fallback slices text
  // and leaf directives out of the source by offset.
  options: { position: true },
  textDirective: renderLiteral(":"),
});
