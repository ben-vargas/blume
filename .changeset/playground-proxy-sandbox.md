---
"blume": patch
---

The API playground's built-in proxy (`/_api-proxy`, for `openapi()` and `graphql()` references with `playground: { proxy: true }`) now sends every response it relays with `Content-Security-Policy: sandbox`, `X-Content-Type-Options: nosniff`, and `Cross-Origin-Resource-Policy: same-origin`, and marks an HTML or SVG response as a download. The proxy serves the documented API's bytes from the docs origin, so an API error page that echoed its input could run script as the docs site for anyone who opened a crafted proxy link. It also refuses a request body over 4 MB with a `413` before buffering it, where a self-hosted Node server used to read the whole body into memory first. The playground's own requests are unaffected.
