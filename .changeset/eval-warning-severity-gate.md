---
"blume": patch
---

A `severity: warning` question in `blume eval` now warns instead of failing CI, as documented: its miss doesn't count against the gate or `--threshold`, so the exit code agrees with the JSON summary's error count. When an agent CLI exits before reading its prompt, `blume eval` and `blume translate` report the agent's exit code and stderr for that item instead of aborting the whole run with an internal error.
