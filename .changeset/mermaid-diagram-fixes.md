---
"blume": patch
---

Mermaid diagrams stop re-rendering after every client-side navigation: the theme script rewrites the page's theme attribute on each swap, usually to the same value, and each diagram rendered again in response. A real light/dark switch still re-renders them.
