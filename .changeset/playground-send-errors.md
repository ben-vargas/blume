---
"blume": patch
---

The API playground tells a mistyped server from a CORS problem. A bare relative server (`api.example.com` or `v1`) is refused before sending, with a note to enter an absolute URL or a path on the docs site, instead of sending the request to the docs site and showing its 404 page. When a send fails before any response, the CORS explanation (and its `playground: { proxy: true }` advice) appears only when the API's origin answers a follow-up probe; a host that doesn't answer, and any failure through the proxy, reads "Couldn't reach the API" instead.
