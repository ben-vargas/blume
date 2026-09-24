---
"blume": major
---

Replace the `search.provider` string and its credential blocks with adapters imported from `blume/search`: `orama()` (still the default), `flexsearch()`, `pagefind()`, `algolia({ appId, apiKey, indexName })`, `oramaCloud({ endpoint, apiKey, indexId })`, `typesense({ host, collection, apiKey })`, `mixedbread({ storeId })`, or `false` to turn search off. Pass the adapter directly, or as `search: { provider, popular, indexing }` beside curated links and indexing options. The hosted adapters forward any option Blume doesn't name to their SDK's search client (options must be JSON values), and the keyless ones take no options.

Migration: `search: { provider: "algolia", algolia: { appId, indexName, searchApiKey } }` becomes `search: algolia({ appId, indexName, apiKey: searchApiKey })`, and the Orama Cloud, Typesense, and Mixedbread blocks map the same way, with the search-only key as `apiKey` everywhere; `provider: "pagefind"` becomes `pagefind()`, and `provider: "none"` becomes `search: false`. Admin keys stay in their env vars.
