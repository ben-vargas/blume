---
"blume": patch
---

`blume dev` no longer crashes with "Cannot read properties of null (reading 'port')" when Astro restarts during startup. The first `blume dev` after a `blume build` rewrites the generated `astro.config.mjs` just before the server starts, and when Astro's watcher picked that write up mid-startup it restarted before listening, leaving no address to read; Blume now takes the port from the restarted server's own URL.
