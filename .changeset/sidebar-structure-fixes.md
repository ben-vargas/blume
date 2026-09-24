---
"blume": patch
---

A sidebar group's path now comes from its folder, so a page with a frontmatter `slug` no longer moves its whole folder out of its tab (a `guides/` page with `slug: install` left every page under a `/guides` tab with an empty sidebar). A folder `meta.ts` `pages` list now wins over a listed subfolder's own `order`, as it already did over a listed page's `sidebar.order`, and a listed position no longer reports a `BLUME_DUPLICATE_SIDEBAR_ORDER` warning against an unlisted sibling's numeric prefix or `sidebar.order`.
