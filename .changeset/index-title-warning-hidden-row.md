---
"blume": patch
---

`BLUME_NAV_INDEX_TITLE_MISMATCH` now fires only when a folder's index page hides its own sidebar row, so the linked group header is the only sidebar label the page has. A visible index row already shows the page's own title beneath the header ("CLI" over "Overview"), so a site pairing the two on purpose no longer gets a warning per section and locale on every build.
