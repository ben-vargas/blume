---
"blume": minor
---

Add a site footer. `footer` in `blume.config.ts` takes `socials`, profile URLs keyed by platform (`github`, `x`, `discord`, `linkedin`, `youtube`, and more) and shown as brand icons in the order written, and `links`, up to four columns of `{ label, items: [{ label, href }] }`. The footer renders below the content on every page, including custom pages built on `PageLayout` that don't fill its `footer` slot. A `Footer` layout override still replaces it, and `blume add footer` copies the built-in into your project to edit. Sites without `footer` are unchanged.
