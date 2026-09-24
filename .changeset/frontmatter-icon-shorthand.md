---
"blume": patch
---

A page's top-level `icon` frontmatter now sets its sidebar icon when `sidebar.icon` is unset, like the top-level `hidden` and `noindex` shorthands. The key was accepted but never read, so a page migrated from Mintlify with `icon: download` showed no icon.
