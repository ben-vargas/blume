---
"blume": patch
---

When a `blume eval` or `blume translate` agent run times out and exits on the SIGTERM, Blume now cancels the SIGKILL follow-up instead of sending it five seconds later to a process id the system may have reused.
