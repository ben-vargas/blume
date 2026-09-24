---
"blume": patch
---

The MCP server's `list_pages` tool and `resources/list`, and the JSON API's `/api/docs/pages.json`, no longer list i18n fallback copies. An untranslated page came back once per locale, English text tagged `fr` or `de` with nothing marking it untranslated, so a `locale` filter returned pages that aren't in that language and a `contentTypes` or `version` filter returned duplicates. The copies are left out as `llms.txt` and search already leave them out; `get_page` still reads a fallback URL.
