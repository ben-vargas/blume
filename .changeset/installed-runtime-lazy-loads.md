---
"blume": patch
---

Fix `search: pagefind()` failing every `blume build` in a project that installed Blume from npm, with "Vite module runner has been closed". The same fault skipped the Algolia, Orama Cloud, and Typesense index sync with a "Search sync skipped" warning, left inline `` `code{:lang}` `` snippets unhighlighted, and stopped an ejected app's `astro build` from loading the Notion and Sanity SDKs or routing remote OpenAPI fetches through a configured proxy. Blume now loads these libraries in a way that works however Astro evaluated its config.
