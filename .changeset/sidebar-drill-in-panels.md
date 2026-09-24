---
"blume": patch
---

Sidebar sections loaded on first open show their icons on every page, where an icon could come out blank on a page that hadn't used it itself. A drill-in panel loaded on first open keeps its Back button and section title. Drilling into a panel or going back moves keyboard focus into the panel that slides in (its Back button, or the row that opened the panel you left), and each drill-in row reports whether its panel is open with `aria-expanded` and `aria-controls`.
