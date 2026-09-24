---
"blume": patch
---

The Algolia sync now declares `locale` and `version` for faceting (as `filterOnly`), keeping any facets you set yourself, so search on a multi-language or versioned site finds results. The search dialog's section for pages outside every sidebar group is now labeled in the reader's language through the new `search.docs` UI string, and the WebMCP `search_docs` tool returns plain text, with characters like `<` and `&` no longer HTML-escaped.
