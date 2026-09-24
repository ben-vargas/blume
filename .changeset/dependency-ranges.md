---
"blume": patch
---

Installing Blume on Node 22.12 through 22.22.1, or 24.0 through 24.14, no longer prints an `EBADENGINE` warning: Blume now depends on `write-file-atomic` 7.x, whose code is identical to 8.0 but whose engine range covers Blume's own `>=22.12.0`. The optional `@mixedbread/sdk` peer now accepts every 0.x release from 0.77, so a current SDK no longer draws an incorrect-peer warning.
