---
"blume": patch
---

Root-relative links in the agent Markdown (`.md` and `.mdx` mirrors, `llms-full.txt`, MCP `get_page`) now match the rendered page: `[Install](/guides/install)` and `<Card href="/guides/config">` gain the site's `deployment.base` and `basePath`, and on a translated page they point at that locale's copy of the page when it exists. A paragraph written straight after a converted `<Callout>`, `<Steps>`, or `<Prompt>` now stays its own paragraph instead of joining the quote or list, and `<Visibility>` markup inside inline code or an indented code block (in a tab or step) is left as written.
