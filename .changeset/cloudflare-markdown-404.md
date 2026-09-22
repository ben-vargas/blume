---
"blume": patch
---

Cloudflare server builds now answer a missing page with the prerendered Markdown 404 (`/404.md`) when the client sends `Accept: text/markdown`, and with the JSON problem document (`/404.json`) when it prefers JSON — keeping the `404` status, as Vercel builds already did. To let a request for a URL no page backs reach the Worker at all, the generated `assets.run_worker_first` rules now claim every path except the fingerprinted build assets and the raw `.md`, `.txt`, `.json`, and `.well-known` files, instead of only the content routes.
