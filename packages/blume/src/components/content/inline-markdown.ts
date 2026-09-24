import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import { defineMdastPlugin } from "satteri";

/**
 * Shared helpers for components that render a short Markdown prop (a caption,
 * a description, a tooltip label) into inline HTML injected via `set:html`.
 * Previously copied verbatim into Prompt, Frame, and Tooltip.
 */

/**
 * Neutralize raw HTML in a Markdown-rendered text prop: each raw HTML node
 * the parser finds (an inline tag, a block, a comment) renders as its literal
 * text instead. Deciding in the tree rather than escaping `<`/`>` in the
 * source keeps what only looks like HTML intact — a code span's
 * `` `Array<string>` `` and an autolink's `<https://…>` — and `&` entity
 * references keep resolving (`&copy;` renders as ©).
 */
export const rawHtmlAsTextPlugin = defineMdastPlugin({
  html(node, ctx) {
    ctx.replaceNode(node, { type: "text", value: node.value });
  },
  name: "blume-raw-html-as-text",
});

/**
 * Unwrap the `<p>` a block-level Markdown render wraps around single-line
 * content, so it can sit inside inline markup. Only a *single* paragraph is
 * unwrapped: the content must not contain its own `</p>`, or
 * `<p>a</p>\n<p>b</p>` would "unwrap" to `a</p>\n<p>b` — unbalanced HTML
 * injected via `set:html`.
 */
export const unwrapParagraph = (html: string): string => {
  const trimmed = html.trim();
  const match = trimmed.match(/^<p>(?<content>(?:(?!<\/p>)[\s\S])*)<\/p>$/u);
  return match?.groups?.content ?? trimmed;
};

/**
 * Render a short Markdown text prop to inline HTML, its raw HTML shown as
 * text (see {@link rawHtmlAsTextPlugin}) and a single paragraph unwrapped.
 */
export const renderInlineMarkdown = async (value: string): Promise<string> => {
  const processor = await createSatteriMarkdownProcessor({
    mdastPlugins: [rawHtmlAsTextPlugin],
  });
  const rendered = await processor.render(value);
  return unwrapParagraph(rendered.code);
};
