import type { Features } from "satteri";

/**
 * Sätteri's feature set for plain `.md` pages. Shared by the renderer and the
 * search extractor so the index reads the same grammar the page renders.
 */
export const MARKDOWN_FEATURES = {
  subscript: true,
  superscript: true,
} satisfies Features;

/**
 * The `.mdx` feature set: Markdown's plus `:::` directives (→ `<Callout>`) and
 * block-only math — `singleDollarTextMath: false` keeps a bare `$` (currency,
 * shell, code) as literal text and only parses `$$…$$`. The directive switch
 * also parses `:name` text and `::name` leaf directives, which prose like
 * `16:9` and `og:image` is full of; Blume renders those as the text the
 * author wrote (see `directives.ts`).
 */
export const MDX_FEATURES = {
  ...MARKDOWN_FEATURES,
  directive: true,
  math: { singleDollarTextMath: false },
} satisfies Features;
