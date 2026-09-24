---
"blume": patch
---

Content imported from a CMS or GitHub releases can no longer run script on the docs site. A Sanity code span keeps its text as code however many backticks or braces it holds, and a `javascript:` link keeps only its label wherever it comes from: a Sanity link, a scheme hidden behind an escape (`java&#115;cript:`, `javascript&colon;`), a release note's footnote, or a Contentful, Payload, or Strapi Markdown field. A link's URL can't close it early to start a second link, a code block whose language holds a backtick still opens its fence, and an unsupported block's type can't end its comment. Lowered rich text also keeps `## text`, indented text, and an `import` followed by code in the next run as prose, instead of rendering a heading or code block or failing the MDX page.
