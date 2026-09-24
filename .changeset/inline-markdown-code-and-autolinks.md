---
"blume": patch
---

A `<Frame>` caption and a `<Prompt>` description keep code spans (`` `Array<string>` ``) and autolinks (`<https://…>`) intact, while raw HTML in them still shows as text. Before, their `<` and `>` rendered as `&lt;`/`&gt;` in code and as stray brackets around links.
