---
"blume": patch
---

A config error for an unknown key now points at the line that sets that key, instead of at its parent object's line (or at no line at all for a top-level key), and when a config has several problems they're listed in the order they appear in the file.
