---
"blume": patch
---

Meet WCAG AA contrast with the accent colors, and check a site's theme colors in `blume audit`. Each accent preset now has a darker light-mode shade and a lighter dark-mode shade, so accent text and button labels reach 4.5:1 in both modes. Blue is the default, so this changes sites that set no accent too. Labels on accent and action fills are white while white reaches AA on that color, and dark otherwise. A light accent, and every preset in dark mode, now gets dark labels instead of unreadable white ones. A new `accessibility` category in `blume audit` measures a custom `theme.accent`, `theme.action`, or `theme.background` against the same bar in both modes, and says when it can't read a color.
