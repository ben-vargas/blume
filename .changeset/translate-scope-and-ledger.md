---
"blume": patch
---

`blume translate` leaves archived-version folders' `meta.ts` files alone, like the rest of a frozen snapshot. Drafts count as content: a hand-written translation marked `draft: true` is adopted instead of overwritten, and a source page that is a draft for a while keeps its ledger entries, so its outdated translations still read as stale. A partial that is one code block validates without its own fences being stripped, and folder titles from two sources with the same folder name each get their own translation.

A `blume.translations.json` with unresolved merge-conflict markers now fails with a clear error instead of reading as empty, which let `--check` pass over outdated translations. Line endings are normalized before hashing, so a CRLF checkout doesn't look like an edit to every page.
