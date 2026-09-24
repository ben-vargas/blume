---
"blume": minor
---

New `blume upgrade` command for moving a project to a new major. Run it through the package runner (`npx blume@latest upgrade`), since a project on Blume 1 doesn't have it yet: it bumps `blume` in `package.json` (editing only that range), installs with the project's package manager, and lists every change still needed with its file, line, and replacement, exiting non-zero until none are left. It checks `blume.config.ts`, each `components.ts` entry, page frontmatter for removed fields, and `package.json` scripts that still pass removed `blume build` flags. `--claude` or `--codex` hands the list, with the new [Upgrade to Blume 2](https://useblume.dev/docs/upgrading) guide, to Claude Code or Codex; `--no-install` bumps without installing.
