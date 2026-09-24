---
"blume": patch
---

On a multi-locale site, the 404 page speaks the locale in the missing URL: `/ar/does-not-exist` shows the Arabic message, right to left, with its home link pointing at `/ar`, where it used to show the default locale's. Hosts serve one `404.html` for every missing URL, so the page carries each locale's message and switches to the one the URL names when it loads.
