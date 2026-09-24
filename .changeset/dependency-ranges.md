---
"blume": patch
---

Blume's own dependencies now install on every Node version Blume supports (`>=22.12.0`) without an `EBADENGINE` warning: it depends on `write-file-atomic` 7.x, whose code is identical to 8.0, and `undici` 7.x, since their 8.x releases require Node 22.22 and 22.19. The optional `@mixedbread/sdk` peer now accepts every 0.x release from 0.77, so a current SDK no longer draws an incorrect-peer warning.
