---
"blume": patch
---

A sidebar section whose deferred contents fail to load (offline, or a deploy that dropped the fragment) no longer leaves the click dead. A drill-in row follows the section's own page link instead, and a collapsed group closes again so the next open retries, where both used to do nothing and raise an unhandled promise rejection.
