---
"blume": patch
---

Command output fixes:

- `blume preview` in a project where only `blume dev` has run says to run `blume build` first, instead of printing Astro's stack trace.
- `blume check --strict` and `blume dev --strict`, which are strict only on request, now say to drop `--strict` to continue past errors, not to pass `--no-strict`.
- `blume translate --check --json` lists every missing or stale translation as an error diagnostic, so its `summary` agrees with the non-zero exit.
- `blume translate`, `blume audit`, and `blume eval` report an invalid config with its code, file, and line, like the other commands, instead of the bare message.
- When the agent run itself fails in `blume eval`, the finding points at the question in the evals file and reads `run failed:`, instead of a `fix:` line naming a docs page that has nothing to fix.
- `blume --help` carries the current tagline.
