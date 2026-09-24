---
"blume": patch
---

`blume eval` now runs its reader and judge with Codex by default; pass `--agent claude` to keep using Claude Code. The other agent commands (`audit`, `migrate`, `translate`, `upgrade`) now suggest `--codex` first in their hints and errors, as do the bundled skills.
