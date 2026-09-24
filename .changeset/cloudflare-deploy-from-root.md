---
"blume": patch
---

A `cloudflare()` server build now deploys with `npx wrangler deploy` from the project root. The Cloudflare Vite plugin writes its pointer to the built Worker config inside Blume's hidden runtime, where wrangler never looks, so a deploy from the project root failed with "Could not detect a directory containing static files"; Blume now writes that pointer at the project root as well. The Worker is also named after the project — its `package.json` name, else the site's hostname, else the project folder — instead of `blume-runtime`, which every Blume site shared, so two sites deployed to one account no longer overwrite each other. A `name` set in a `wrangler.jsonc` at the project root still wins.
