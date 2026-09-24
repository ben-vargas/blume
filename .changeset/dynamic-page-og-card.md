---
"blume": patch
---

A custom page on a dynamic route (`pages/compare/[tool].astro`) no longer sets an `og:image` pointing at a generated card that was never rendered. Generated cards cover static custom pages only, so pass `ogImage` to `PageLayout` for a dynamic page's social card.
