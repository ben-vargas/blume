---
"blume": patch
---

Open Graph cards for non-Latin locales now render their text instead of empty boxes. Each configured locale whose script the card's built-in font can't draw adds a Google Noto fallback for it (`Noto Sans JP` for `ja`, `Noto Sans Devanagari` for `hi`, `Noto Sans` for Cyrillic, Greek, and accented Latin, and so on), with no config needed. Latin text keeps the built-in font, so English cards look the same, and an explicit `seo.og.fonts` still replaces the whole list.
