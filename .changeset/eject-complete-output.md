---
"blume": patch
---

`blume eject` now adds `tailwindcss` and `@tailwindcss/typography` to the project's dependencies, so the ejected stylesheets resolve under pnpm and other strict linkers, and the ejected `features.ts` names `epub-gen-memory` only when EPUB export is on. The ejected app also serves colocated images from its raw Markdown at `/blume-assets/content/…`, and renders the Open Graph card its `/changelog` page points at. With `playground: { proxy: true }` on a reference, the ejected app serves the API playground's built-in proxy at `{basePath}/_api-proxy`, with the same origin allowlist, instead of every Send returning a 404.
