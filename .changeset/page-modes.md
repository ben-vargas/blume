---
"blume": minor
---

Add page layout modes. `mode` in a page's frontmatter sets what it shows around its content: `wide` drops the table of contents and lets the content take its width, `center` drops the sidebar too and centers a wider column, `custom` keeps only the header for a landing page written in MDX, and `frame` is `custom` with the sidebar. `custom` and `frame` pages render no title, description, breadcrumbs, page-end links, or site footer, so they bring their own heading. Every mode stays in search and keeps its Markdown copy. The values match Mintlify's; its full-page `assistant` mode has no equivalent.
