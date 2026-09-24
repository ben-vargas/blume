---
"blume": patch
---

The MCP server's `search_docs` tool and the `/api/docs/search` endpoint no longer return i18n fallback copies. A page not yet translated came back once per locale, the same English text at every localized URL, while the site's own search already left those copies out.
