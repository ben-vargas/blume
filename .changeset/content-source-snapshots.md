---
"blume": patch
---

Remote sources keep one snapshot per preview mode and set of options under `.blume/cache/<source>/`. A plain `blume dev` after `blume dev --preview` no longer serves unpublished drafts, a build whose fetch fails no longer falls back to them, `--preview` fetches drafts even when a published snapshot is cached, and editing a source's `query` or `fields` refetches in dev. Contentful's `--preview` without a Preview API token now fails with a clear error instead of serving the cached snapshot with a warning, and a source passed to `custom()` from one of Blume's engine factories (`sanitySource`, `contentfulSource`, …) now honors `--preview` and caches in the runtime directory like the built-in adapter.
