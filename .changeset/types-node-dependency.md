---
"blume": patch
---

`blume check` no longer fails in a fresh project on the image asset route Blume generates (`Cannot find name 'node:fs'`). The route imports Node's filesystem and path modules, whose types lived only in Blume's development dependencies, so a project that installed nothing but Blume had no `@types/node` to check it against; Blume now depends on `@types/node` itself.
