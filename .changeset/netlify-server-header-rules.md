---
"blume": patch
---

A `netlify()` server build now serves the header rules a static build puts in `_headers` — the homepage `Link` header, `charset=utf-8` on the raw Markdown and text files, and the `.well-known` discovery files' media types and CORS header — by writing them into Netlify's `.netlify/v1/config.json`, which a server build reads instead of `_headers`.
