---
"blume": patch
---

OG cards render every script by default. A Noto fallback for each script is now part of the default card font stack, not only for configured locales, so a Japanese, Hindi, or Arabic title renders instead of tofu on any site, including sites with no `i18n` block and ejected projects. A card fetches from Google Fonts only when its text has a glyph the built-in font can't draw, and then only the families and subsets those glyphs need, so English cards fetch nothing and Latin-only sites still build offline. Configured locales move their family to the front, so a `zh` site draws Han in Chinese forms.
