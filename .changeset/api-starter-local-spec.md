---
"blume": patch
---

`blume init --template api` now writes a small example spec, `openapi.json`, beside `blume.config.ts` and points `openapi()` at it, so a new project's first build no longer depends on the public Petstore server. Its operation pages carry descriptions that a fresh `blume audit` accepts.
