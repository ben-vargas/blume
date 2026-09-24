---
"blume": patch
---

The agent Markdown (`.md` mirrors, `llms-full.txt`, MCP `get_page`) and the search index now read component props like `title={...}` as literal data and never run them, on `.mdx` and plain `.md` pages and on content from CMS and GitHub release sources alike. Strings, numbers, booleans, arrays, objects, template strings, and `frontmatter.*` references resolve as before; any other expression, such as a function call, leaves the component as written.
