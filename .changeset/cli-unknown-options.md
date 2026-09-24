---
"blume": major
---

Every `blume` command now rejects a flag it doesn't take, instead of silently ignoring it: `blume build --isolatd` used to run a real, non-isolated build, and `blume validate --strcit` skipped strict mode. The error names the likely intended flag (`did you mean --isolated?`) and every flag the command takes. `blume audit --only` and `--skip` likewise reject a term that names no check or category (`--only link` suggests `links`), where a typo used to filter out every finding and pass the gate. A config that fails validation while a command runs is now reported as its diagnostic, with its line, instead of a raw stack trace (`blume version`, `blume eject`). A mistyped negation is suggested as a negation (`--no-strcit` → `--no-strict`), and a switch that's on by default is listed by the form that changes it (`--no-strict`).
