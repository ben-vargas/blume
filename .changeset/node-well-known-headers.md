---
"blume": patch
---

A `node()` server build now serves the `.well-known` discovery files with their registered media type and CORS header, as the Vercel, Netlify, and Cloudflare builds already did. The standalone server's static handler types a file by its extension alone and sends no CORS header, so `/.well-known/api-catalog` went out as `application/octet-stream` and a registry reading the AI catalog, ARD manifest, or MCP discovery files from another origin was blocked. `blume build` now puts a small wrapper in front of the server entry (`dist/server/entry.mjs`, with Astro's own entry beside it as `astro-entry.mjs`) that sets those headers before Astro handles the request; the entry's `handler` export, `astro preview`, and middleware mode keep working as before.
