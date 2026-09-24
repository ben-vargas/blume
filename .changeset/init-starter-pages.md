---
"blume": patch
---

`blume init` fixes: the starter pages no longer repeat their frontmatter title as a body `# Introduction` heading, so each renders one `<h1>`, and the docs starter no longer tells you to run a bare `blume dev`, which isn't on `PATH`. In a folder whose `package.json` already exists — which `init` leaves alone — the next steps now add `blume` and any source SDK it doesn't list yet (`npm install blume`) and start the dev server through the package runner (`npx blume dev`) unless its `dev` script already runs Blume, instead of printing `npm run dev` for a script that isn't there. The Sanity source scaffolds `@sanity/client` `^8.6.1`, the major Blume is tested against.
