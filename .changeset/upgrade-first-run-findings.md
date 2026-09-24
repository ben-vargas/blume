---
"blume": patch
---

Config validation reports `content.root` (or `include`/`exclude`) beside `content.sources` even while a source entry is still in the Blume 1 `{ type }` form, so `blume upgrade` and `blume doctor` list both on the first run. A `blume` range `blume upgrade` can't bump, such as `catalog:` or an `npm:` alias, is reported with what to change by hand (the catalog entry in `pnpm-workspace.yaml`, or the alias's version) instead of as ready.
