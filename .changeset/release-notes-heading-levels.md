---
"blume": patch
---

Release pages from a `githubReleases()` source now open their notes at h2. Changesets starts every section at `### Patch Changes`, so each page jumped from its h1 title straight to an h3, which `blume audit` flags on every release; the notes' headings are now lifted together until the shallowest is an h2, and a `#` inside a code block is left alone.
