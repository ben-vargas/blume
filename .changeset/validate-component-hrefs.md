---
"blume": patch
---

`blume validate` now checks a component's string `href` (`<Card href="/guides/setup">`, `<Tile href="./install">`) the way it checks a Markdown link, including an `href` a formatter wraps onto its own line, so a broken card or tile link is reported at its line instead of shipping. An expression-valued `href={…}` and a raw HTML `<a>` tag are left alone.
