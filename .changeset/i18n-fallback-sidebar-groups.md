---
"blume": patch
---

On a multilingual site, a sidebar group with no `meta.ts` in a locale now mirrors the fallback locale's: that folder's `meta.ts` (title, order, `collapsed`, `display`) and the `sidebar.display` its index page sets. Groups set to collapsible no longer render flat on pages that fall back to the default language.
