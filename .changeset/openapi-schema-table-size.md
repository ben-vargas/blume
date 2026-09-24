---
"blume": patch
---

API reference schema tables stay a manageable size for specs whose schemas reference each other densely. A named schema expands wherever it appears in the first two levels of nesting, as before, and below that only where it first appears; later mentions show its name. A request body of twelve schemas that each reference four others went from tens of thousands of nested tables to a few dozen at most.
