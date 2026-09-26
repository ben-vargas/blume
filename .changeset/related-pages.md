---
"blume": patch
---

Add related pages. `related` in a page's frontmatter lists up to ten pages to suggest at its foot, shown as cards under a translated "Related pages" heading: a root-relative path shows that page's title and description (its translation, on a translated page), a `{ Title: link }` entry names the card itself, and an absolute URL links off the site. Paths are checked like the page's other links, so `blume validate` reports one that matches no page. The key matches Mintlify's.
