---
"blume": patch
---

Relative links in Markdown and MDX now render as the root-relative route they point at. Left as written, a browser resolved them against the page's slashless URL, so `[Install](./install)` on a folder's `index` page (`/guides`) went to `/install`, and a link to a file (`[Setup](./setup.md)`) opened its raw Markdown. Each relative link now resolves the way `blume validate` checks it — from the page's own folder, with a `.md` or `.mdx` link landing on the route that file publishes at, `slug` included — and `blume audit` reads relative `href`s the way a browser does, so all three agree. A component's string `href` (`<Card href="./install">`) and a dotted page name (`./v1.2`) resolve the same way, a link to a sibling that isn't translated yet lands on the default locale's page in the reader's locale, and the `.md` mirrors, `llms-full.txt`, and MCP `get_page` get the same rewrite.
