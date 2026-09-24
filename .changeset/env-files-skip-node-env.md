---
"blume": patch
---

Blume no longer takes `NODE_ENV` from `.env` files, so a monorepo root `.env` that sets it for another app can't turn `blume build` into a development build or `blume dev` into a production one. Set it in the shell when you need to.
