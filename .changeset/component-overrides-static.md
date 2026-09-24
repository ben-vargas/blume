---
"blume": major
---

Component overrides in `components.ts` are planned statically, with no runtime fallback. Every `mdx` and `layout` entry must be an imported identifier, a path string, or a `{ component, client, media }` object literal; anything else — an inline function, a component declared in the file, a spread, a computed key — or an import of a file that doesn't exist is a `BLUME_COMPONENTS_INVALID` error at its line, reported by `blume dev`, `blume build`, and `blume doctor`. Such overrides used to render without hydration or any warning.

The `islands` group is gone: an `mdx` entry with a `client` mode is an island, so `islands: { Counter }` becomes `mdx: { Counter: { component: Counter, client: "visible" } }`. The `islands/` folder convention is unchanged, and a `components.ts` `mdx` entry replaces a folder island of the same name. Generated islands move from `src/generated/islands/` to `src/generated/component-slots/`, in `blume eject` output too, where every import is relative so the ejected app builds from any checkout.
