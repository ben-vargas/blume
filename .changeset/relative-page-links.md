---
"blume": patch
---

Relative links in Markdown and MDX now render as the root-relative route they point at. Left as written, a browser resolved them against the page's slashless URL, so `[Install](./install)` on a folder's `index` page (`/guides`) went to `/install`, and a link to a file (`[Setup](./setup.md)`) opened its raw Markdown instead of the page. Each relative page link now resolves the way `blume validate` checks it — against the page's own folder, with a `.md` or `.mdx` link landing on the route that file publishes at, its `slug` and ordering prefix included — and `blume audit` reads any relative `href` left in the HTML the way a browser does from the slashless URL, so the rendered link, `validate`, and `audit` agree. The Markdown agents read — the `.md` and `.mdx` mirrors, `llms-full.txt`, and MCP `get_page` — gets the same rewrite, since an agent resolved those links against the URL it fetched (`/guides.md`) and `llms-full.txt` has no page URL at all.
