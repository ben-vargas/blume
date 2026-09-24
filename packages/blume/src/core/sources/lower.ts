/**
 * Shared primitives for lowering a CMS's rich-text tree to Markdown text.
 * Every rich-text lowerer (Portable Text, Contentful, Lexical, Strapi
 * blocks) renders inline runs, wraps them in block syntax, and joins blocks
 * with blank lines; these helpers keep that Markdown identical across them.
 */

import { isSafeHref } from "../safe-href.ts";

// Markdown/raw-HTML structure characters. Rich-text leaves are *plain text* —
// formatting arrives as marks, never as syntax in the text — so a literal
// `*`, `_`, `[`, backtick, `~`, or `<` typed in the CMS must render as
// itself. Unescaped, it opened emphasis or a code span mid-paragraph, and `<`
// let CMS prose inject raw HTML into the rendered page. `{` and `}` open an
// expression once an entry is written as MDX (see {@link writesMdx}). CommonMark
// backslash-escapes every ASCII punctuation character, so `\*` is always the
// literal asterisk, in `.md` and `.mdx` alike.
const MARKDOWN_SPECIALS = /[\\`*_{}[\]~<]/gu;

// An entity or numeric character reference (`&copy;`, `&#38;`) is decoded
// even in plain text, so one typed in the CMS would render as the character
// it names rather than as written. A bare `&` is left alone.
const CHARACTER_REFERENCE = /&(?=#?[a-z0-9]+;)/giu;

// Block syntax is only syntax at the start of a line: `# ` (through
// `###### `), `- `, `+ ` and `1. `/`1) ` need the space (or line end) to
// become a heading or list item, while `>` opens a quote on its own, and a
// line of only `=` or `-` turns the line above it into a heading (or, alone,
// into a rule). Indentation of up to three spaces still counts. A CMS
// paragraph that begins with one of these — a soft break inside it counts as
// a line start too — must stay prose.
const BLOCK_START =
  /^(?<indent>[ \t]*)(?:(?<marker>#+|[+-]|\d+[.)])(?=[ \t]|$)|(?<quote>>)|(?<rule>=+|-{2,})(?=[ \t]*$))/gmu;

// MDX reads a top-level line that opens with `import` or `export` followed by
// a space, a tab, `{`, or `*` as an ESM statement, and prose like "import the
// CSV first" then fails the whole page. The keyword's first letter as a
// character reference renders the same in `.md` and `.mdx`, and MDX no longer
// sees the keyword. The keyword is escaped wherever a word ends on it, which
// covers every character that opens a statement. Only a block's first line
// counts; a blank line inside the text starts a new block.
const ESM_START = /(?<=^|\n[ \t]*\n)(?<keyword>import|export)(?![\w$])/gu;

// Whitespace opening a block: four columns of it (or a tab) make an indented
// code block, and a paragraph drops it when it renders anyway.
const BLOCK_INDENT = /(?<=^|\n[ \t]*\n)[ \t]+/gu;

const escapeBlockStart = (text: string): string =>
  text.replaceAll(BLOCK_START, (match: string, indent: string) => {
    // A numbered marker escapes its punctuation (`1\.`), the rest themselves.
    const marker = match.slice(indent.length);
    const index = marker.search(/[.)]/u);
    return index === -1
      ? `${indent}\\${marker}`
      : `${indent}${marker.slice(0, index)}\\${marker.slice(index)}`;
  });

const escapeEsmStart = (text: string): string =>
  text.replaceAll(
    ESM_START,
    (keyword: string) => `&#${keyword.codePointAt(0)};${keyword.slice(1)}`
  );

export const escapeMarkdownText = (text: string): string =>
  escapeEsmStart(
    escapeBlockStart(
      text
        .replaceAll(MARKDOWN_SPECIALS, String.raw`\$&`)
        .replaceAll(CHARACTER_REFERENCE, String.raw`\&`)
    )
  );

/** The marks a lowerer can put on an inline run. */
export interface InlineMarks {
  bold?: boolean;
  code?: boolean;
  italic?: boolean;
  strike?: boolean;
}

const BACKTICK_RUN = /`+/gu;

/** The longest run of backticks in `text`, 0 when there is none. */
const longestBacktickRun = (text: string): number => {
  let longest = 0;
  for (const run of text.match(BACKTICK_RUN) ?? []) {
    longest = Math.max(longest, run.length);
  }
  return longest;
};

/**
 * A code span whose delimiter outruns any backtick run inside it, padded with
 * a space on each side when the code starts or ends with a backtick (the
 * CommonMark rule that keeps the padding out of the rendered code).
 */
export const codeSpan = (code: string): string => {
  const fence = "`".repeat(longestBacktickRun(code) + 1);
  const pad = code.startsWith("`") || code.endsWith("`") ? " " : "";
  return `${fence}${pad}${code}${pad}${fence}`;
};

/**
 * A block's inline text, guarded where only the whole block can tell. Runs
 * are escaped one at a time, but "import" ending one run and a space or code
 * span opening the next form an MDX `import` statement only once they are
 * joined, and whitespace the first runs put in front of a block turns it into
 * an indented code block. Apply it to the joined text of a paragraph,
 * heading, quote, or list item — never to code.
 */
export const guardBlockStart = (text: string): string =>
  escapeEsmStart(text.replaceAll(BLOCK_INDENT, ""));

const EDGE_SPACE = /^(?<lead>\s*)(?<body>[\s\S]*?)(?<trail>\s*)$/u;

/**
 * Wrap a text run in the Markdown for its marks. Code stays verbatim inside
 * the backticks (an escape would render as a backslash); everything else is
 * escaped first. Whitespace at either edge moves outside the delimiters,
 * since `** bold **` is not strong emphasis but `**bold**` is — editors
 * routinely bold a word together with the space after it.
 */
export const renderInline = (text: string, marks: InlineMarks): string => {
  const match = EDGE_SPACE.exec(text);
  const lead = match?.groups?.lead ?? "";
  const body = match?.groups?.body ?? "";
  const trail = match?.groups?.trail ?? "";
  if (body === "") {
    return text;
  }
  let out = marks.code ? codeSpan(body) : escapeMarkdownText(body);
  if (marks.bold) {
    out = `**${out}**`;
  }
  if (marks.italic) {
    out = `*${out}*`;
  }
  if (marks.strike) {
    out = `~~${out}~~`;
  }
  return `${lead}${out}${trail}`;
};

// A destination with whitespace, a control character, or parentheses ends
// early in `[label](…)`; CommonMark's pointy-bracket form carries it intact.
// oxlint-disable-next-line no-control-regex -- control characters are exactly what the bare form refuses.
const UNSAFE_DESTINATION = /[\s()\u0000-\u001F\u007F]/u;

// Markdown decodes a destination before the browser sees it: a backslash
// escape or a character reference becomes its character, so
// `java&#115;cript:` would reach the `href` as `javascript:` after the safety
// check passed it. Escaping both — and `<`/`>`, which would close the
// pointy form early and let the rest of the URL open a second link — keeps
// the `href` exactly the URL the CMS holds.
const DESTINATION_SPECIALS = /[\\<>]|&(?=#?[a-z0-9]+;)/giu;

// A destination can't hold a line break, and the URL parser drops tabs and
// line breaks anyway, so removing them leaves the same URL.
const DESTINATION_IGNORED = /[\t\n\r]/gu;

/** A link or image destination as Markdown carries it verbatim. */
export const destination = (url: string): string => {
  const escaped = url
    .replaceAll(DESTINATION_IGNORED, "")
    .replaceAll(DESTINATION_SPECIALS, String.raw`\$&`);
  return UNSAFE_DESTINATION.test(escaped) ? `<${escaped}>` : escaped;
};

/**
 * A Markdown link, or the label alone when the target is missing — or unsafe:
 * CMS content is the editor's, not the site author's, so a destination that
 * isn't a web, mail, or relative address (`javascript:`, `data:`) never
 * becomes a clickable link on the docs site (see `safe-links.ts`).
 */
export const renderLink = (label: string, href?: string): string =>
  href && isSafeHref(href) ? `[${label}](${destination(href)})` : label;

/** The ATX prefix for a heading level, clamped to Markdown's six. */
export const headingPrefix = (level: number): string =>
  `${"#".repeat(Math.min(Math.max(Math.trunc(level), 1), 6))} `;

/** Quote every line of a block. */
export const blockquote = (text: string): string =>
  text
    .split("\n")
    .map((line) => (line === "" ? ">" : `> ${line}`))
    .join("\n");

/**
 * A list item: the marker on the first line, and every continuation line
 * indented to the marker's width so nested blocks stay inside the item.
 */
export const listItem = (marker: string, body: string): string => {
  const [first = "", ...rest] = body.split("\n");
  const pad = " ".repeat(marker.length + 1);
  return [
    `${marker} ${first}`,
    ...rest.map((line) => (line === "" ? "" : `${pad}${line}`)),
  ].join("\n");
};

/** Indent every non-empty line, for a nested list hanging off an item. */
export const indent = (text: string, width: number): string => {
  const pad = " ".repeat(width);
  return text
    .split("\n")
    .map((line) => (line === "" ? "" : `${pad}${line}`))
    .join("\n");
};

// A fence's language is one word of its info string. A backtick in it keeps
// the fence from opening at all, so the code renders as Markdown and HTML,
// and whitespace would start the meta Blume reads code titles from; a
// language that isn't a single such word is dropped.
const FENCE_LANGUAGE = /^[^\s`]+$/u;

/**
 * A fenced code block whose fence outruns any backtick run in the code,
 * labeled with its language when that is one word a fence can carry.
 */
export const codeFence = (code: string, language = ""): string => {
  const fence = "`".repeat(Math.max(3, longestBacktickRun(code) + 1));
  const label = FENCE_LANGUAGE.test(language) ? language : "";
  return `${fence}${label}\n${code}\n${fence}`;
};

/** A Markdown image; the alt is escaped so a `]` in a caption can't close it. */
export const image = (alt: string, url: string): string =>
  `![${escapeMarkdownText(alt)}](${destination(url)})`;

/**
 * Whether a lowerer's output is written as MDX. Serializers are how a CMS
 * block becomes a Blume component, and components (like directives) only
 * render in MDX, so configuring any serializer switches the source's
 * rich-text bodies to `.mdx`. The escaping above keeps the rest of the
 * lowered text valid there.
 */
export const writesMdx = <Node>(
  serializers?: Record<string, (node: Node) => string>
): boolean => serializers !== undefined && Object.keys(serializers).length > 0;

// A node's type is the CMS's data too: a `*/` (or `--`) in it would close the
// comment early and let the rest run as MDX (or render as HTML). A space
// between the two characters keeps it inside.
const COMMENT_END = /\*\/|--/gu;

/**
 * A comment marking a node the lowerer has no Markdown for — an MDX comment
 * when the output is MDX, which rejects `<!-- -->`.
 */
export const unsupported = (what: string, mdx = false): string => {
  const label = what.replaceAll(COMMENT_END, (end) => [...end].join(" "));
  return mdx ? `{/* unsupported ${label} */}` : `<!-- unsupported ${label} -->`;
};

/** Blocks separated by blank lines; empty blocks are dropped. */
export const joinBlocks = (blocks: string[]): string =>
  blocks.filter((block) => block !== "").join("\n\n");

/** A whole document: its blocks plus the trailing newline a file ends with. */
export const markdownDocument = (blocks: string[]): string =>
  `${joinBlocks(blocks)}\n`;

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/iu;

/**
 * A media URL as a static site can reference it. A protocol-relative
 * Contentful asset (`//images.ctfassets.net/…`) gets `https:`; a path a
 * self-hosted CMS serves (`/uploads/x.png`) resolves against the CMS origin.
 */
export const absoluteUrl = (url: string, base?: string): string => {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  if (ABSOLUTE.test(url) || base === undefined) {
    return url;
  }
  return new URL(url, base).href;
};
