---
"blume": patch
---

The first `blume version <id>` now turns versioning on in `blume.config.ts`, adding a `versions` block with the id archived and the live docs labeled "Latest". It used to only print a snippet — with a placeholder `current: { label: "…" }` to fill in — so until it was pasted, the snapshot built as ordinary content and every page shipped twice. When the config can't be edited safely, the snippet is now a warning saying so, and `blume doctor` warns about a version-shaped folder (`v1.0/`) on a site with no versioning configured.
