---
"blume": patch
---

`search: pagefind()` indexes each page's article instead of its whole `<body>`. Excerpts used to open with the skip link, header, and language switcher, and a word from the chrome ("search", "skip", a locale name) matched every page, including the 404 and custom landing pages. Content pages now mark their article with `data-pagefind-body`, so Pagefind reads only the page's own text and leaves out every page without it — the 404, custom pages, and the generated changelog index, none of which the other search adapters index either.
