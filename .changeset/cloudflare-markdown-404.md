---
"blume": patch
---

Cloudflare server builds now answer a missing page with the prerendered Markdown 404 (`/404.md`) when the client sends `Accept: text/markdown`, and with the JSON problem document (`/404.json`) when it prefers JSON — keeping the `404` status, as Vercel builds already did. To let a request for a URL no page backs reach the Worker at all, the generated `assets.run_worker_first` rules now claim every path except the fingerprinted build assets, the raw `.md`, `.mdx`, and `.txt` files, the `.well-known` files, and the JSON Blume writes at fixed paths, instead of only the content routes. JSON under `/api/` reaches the Worker, so a request for a page's JSON that doesn't exist answers with the API's `PAGE_NOT_FOUND` problem document instead of an empty 404.
