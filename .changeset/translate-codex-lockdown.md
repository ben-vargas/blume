---
"blume": patch
---

`blume translate --codex` runs Codex with the same lockdown as `blume eval`: no shell, exec, or local-image tool, and no inherited environment. Before, `--sandbox read-only` still let the translator's shell read any file the user could.
