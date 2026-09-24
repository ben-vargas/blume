---
"blume": patch
---

A static build deployed to Vercel — `vercel({ output: "static" })`, or a static build with no host named — now carries the response headers the other hosts get from `_headers`, as a `headers` block in `dist/vercel.json`: `charset=utf-8` on the raw `.md`, `.mdx`, and `.txt` files, the homepage `Link` header, and the media types and CORS header of the `.well-known` discovery files. The file is written even when the site has no redirects.
