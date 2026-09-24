---
"blume": patch
---

The generated `/changelog` index now has a Markdown form: `/changelog.md`, `Accept: text/markdown` on `/changelog`, and MCP `get_page` with `/changelog` return the release list the page shows — newest first, grouped by year, each release with its date, category, and link. The index is short enough for an agent to read in one go, but only the rendered HTML existed.
