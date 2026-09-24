---
"blume": patch
---

A `node()` server build answers a configured `302` or `307` redirect with that status, as the Cloudflare Worker already does, instead of a permanent `301` or `308` that browsers cache. A `netlify()` static build forces its `_redirects` rules (`/old /new 301!`), so Netlify issues the redirect instead of serving the redirect page at the old path with a `200`; the `_redirects` for `cloudflare()` and for a build with no named host stays unforced, since Cloudflare rejects the flag.
