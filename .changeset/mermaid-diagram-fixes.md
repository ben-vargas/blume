---
"blume": patch
---

`blume check` no longer fails on every site with a Mermaid diagram with `ts(2306)`, "File … mermaid-element.ts is not a module". Mermaid diagrams also stop re-rendering after every client-side navigation: the theme script rewrites the page's theme attribute on each swap, usually to the same value, and each diagram rendered again in response. A real light/dark switch still re-renders them.
