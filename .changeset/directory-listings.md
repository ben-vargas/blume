---
"blume": minor
---

Add directory listings. `directory` in a folder's `meta.ts`, or on a group in an explicit `navigation.sidebar`, lists the group's pages below the content of its own page (a folder's `index` page, or the group's `root`): `card` as a grid of cards with each page's icon and description, `accordion` as rows with each subgroup a section that opens to its pages, and `none`, the default, as nothing. Nested groups inherit the nearest setting, so one `directory` in the content root's `meta.ts` gives every section a listing, and any folder can set its own. The values match Mintlify's `directory`.
