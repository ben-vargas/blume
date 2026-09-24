---
"blume": major
---

Remove the `search.boost` frontmatter field. Search never read it, so a page that set it ranked exactly the same without it. A page that still sets it now fails frontmatter validation with a hint to delete the field.
