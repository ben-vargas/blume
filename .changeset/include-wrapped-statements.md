---
"blume": patch
---

An `<include>` statement wrapped across lines — the path on its own line between the opening and closing tags, as a formatter wraps a long one — now splices like a one-line statement in `.md` and `.mdx`, and on search, the `.md` mirrors, and `llms-full.txt`. A line that opens `<include` but isn't a statement Blume can read now raises a `BLUME_INCLUDE_MALFORMED` warning instead of rendering the raw tag without a word.
