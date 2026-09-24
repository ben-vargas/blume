---
"blume": patch
---

Sites with Mermaid diagrams no longer print Vite's "Some chunks are larger than 500 kB" warning on every build. Mermaid's layout engine and core load in their own chunks, only on pages with a diagram, so the warning had nothing to fix; the threshold on those sites is now 2 MB.
