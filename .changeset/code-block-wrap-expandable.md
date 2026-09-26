---
"blume": patch
---

Add `wrap` and `expandable` to code fences. `wrap` after the language (` ```ts wrap `) wraps one block's long lines instead of scrolling them, the way `markdown.code.wrap` does for every block. `expandable` collapses a long block to its first lines under a fade, with a Show more toggle that opens it in full, no inner scroll, and Show less to close it again; a block under 16 lines renders as usual. Both compose with a title, line numbers, and each other, and the toggle's labels are translated in every built-in language.
