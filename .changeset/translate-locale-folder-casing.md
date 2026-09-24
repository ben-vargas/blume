---
"blume": patch
---

`blume translate` writes into a locale folder that already exists in another casing (`pt-br/` for a configured `pt-BR`) instead of creating a second one beside it, which on a case-sensitive filesystem published every page twice.
