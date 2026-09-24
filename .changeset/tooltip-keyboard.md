---
"blume": patch
---

A `<Tooltip>` stays open while focus is anywhere inside it, so a keyboard reader can Tab from the underlined term to its call-to-action link instead of watching the panel vanish, and Escape now dismisses it until the pointer or focus leaves. Its element id is derived from the tooltip's content rather than drawn at random, so rebuilding an unchanged page produces the same HTML.
