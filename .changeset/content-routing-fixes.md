---
"blume": patch
---

With `basePath: "/docs"`, a content folder named `docs/` now publishes beneath the base (`docs/guide.md` at `/docs/docs/guide`) instead of colliding with the root pages. Folder `meta.ts` discovery now honors the content source's `include` and `exclude` globs, so an unrelated `src/lib/meta.ts` in a `.`-rooted project is no longer imported, and meta in a lowercase locale folder (`pt-br/`) now applies to its configured locale (`pt-BR`).
