---
"blume": minor
---

New `markdown.externalLinks` option: set it to `true` to open external links written in Markdown (`[Status](https://status.example.com)`, autolinks, and reference-style links) in a new tab, in both `.md` and `.mdx`. Each gets `target="_blank"`, `rel="noreferrer"`, the arrow icon featured sidebar links already use, and a localized screen-reader note that it opens in a new tab. It is off by default, and site routes, `#fragments`, `mailto:`/`tel:` links, and raw `<a>` tags are never changed.

Every link Blume itself opens in a new tab (header actions and CTA, the GitHub link, featured sidebar links, page actions, `Card`, `Tile`, `Tooltip`, and `GithubInfo`) now carries the same screen-reader note. `Card`, `Tile`, and `Tooltip` also decide what counts as external with the same rule as the header, so a protocol-relative `//host` link now opens in a new tab and a relative path that merely starts with `http` no longer does.
