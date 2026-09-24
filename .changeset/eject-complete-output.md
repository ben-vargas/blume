---
"blume": patch
---

`blume eject` now adds `tailwindcss` and `@tailwindcss/typography` to the project's dependencies, so the ejected stylesheets resolve under pnpm and other strict linkers, and the ejected `features.ts` names `epub-gen-memory` only when EPUB export is on. The ejected app also serves colocated images from its raw Markdown at `/blume-assets/content/…`, and renders the Open Graph card its `/changelog` page points at.
