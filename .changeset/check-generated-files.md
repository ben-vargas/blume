---
"blume": patch
---

`blume check` no longer fails on files Blume generates itself in a project without its own `tsconfig.json`, where Astro type-checks the whole generated `.blume` project under its strict settings. The sidebar fragment pages of a `page`- or `group`-display folder read a group-only property off a union, and the Mixedbread search endpoint read `text` off chunks that can be images, audio, or video; both now narrow first.

In a fresh project the image asset route Blume generates no longer fails with `Cannot find name 'node:fs'`: its Node module types lived only in Blume's development dependencies, so Blume now depends on `@types/node` itself. A site with a Mermaid diagram no longer fails with `ts(2306)`, "File … mermaid-element.ts is not a module".
