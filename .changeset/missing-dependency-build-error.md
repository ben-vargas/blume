---
"blume": patch
---

`blume build` now stops before generating anything when a configured adapter's package isn't installed — `algoliasearch` for `algolia()`, `@openrouter/ai-sdk-provider` for `openrouter()`, `@astrojs/netlify` for `netlify()`, a Vue or Svelte island's Astro integration — with one `BLUME_DEPENDENCY_MISSING` error that names every missing package and the command that installs them with the project's package manager (`pnpm add algoliasearch`). It used to warn and then fail inside Vite with an opaque `MISSING_EXPORT` or `ERR_MODULE_NOT_FOUND`. `blume dev` still warns and keeps serving. `blume doctor` now reports the same missing packages, plus any secret an enabled feature needs that isn't set (reading `.env` and `.env.local` first, as `dev` and `build` do), where it used to print "No problems found" for a project whose build would fail.
