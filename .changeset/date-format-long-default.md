---
"blume": patch
---

A `dateFormat` that sets only `timeZone`, `calendar`, or `numberingSystem` keeps the long date form (`July 21, 2026`) instead of falling back to a bare numeric date (`7/21/2026`). Setting `dateStyle` or a component field such as `year` still picks the shape.
