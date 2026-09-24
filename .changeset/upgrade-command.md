---
"blume": minor
---

New `blume upgrade` command for moving a project to a new major. Run it through the package runner (`npx blume@latest upgrade`), since a project on Blume 1 doesn't have it yet: it bumps `blume` in `package.json`, installs with the project's package manager, then checks `blume.config.ts` and `components.ts` against the new version and lists every change still needed with its file, line, and replacement, exiting non-zero until none are left. `--claude` or `--codex` hands that list, with the new [Upgrade to Blume 2](https://useblume.dev/docs/upgrading) guide, to Claude Code or Codex to apply interactively; `--no-install` bumps without installing. A Blume 1 search config (`provider: "algolia"` beside its `algolia` credentials block) now fails validation with the adapter that replaces it, like the other removed fields.
