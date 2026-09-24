---
"blume": patch
---

Builds no longer print Rolldown's nine-line `MODULE_LEVEL_DIRECTIVE` warning about `"use astro:head-inject"` for every Markdown page. Astro opens each page's asset module with that directive and nothing reads it after bundling, but Rolldown 1.2.10 and later, which a fresh install resolves, warns about it on every build. The generated Astro config, and an ejected one, now drops that one warning and passes every other build log through.
