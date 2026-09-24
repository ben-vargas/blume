---
"blume": major
---

Blume 2 turns search, deployment, content sources, API references, analytics, and the Ask AI backend into adapters imported from `blume/*` subpaths, moves the machine-readable settings from `ai` to a new `agents` key, and plans `components.ts` statically. Pages need no edits unless they set the removed `search.boost` frontmatter field. To upgrade a Blume 1 project, run `npx blume@latest upgrade` from the folder with `blume.config.ts`: it bumps `blume`, installs it, and lists every change still needed with its file, line, and replacement, and `--claude` or `--codex` hands that list to a coding agent. The [Upgrade to Blume 2](https://useblume.dev/docs/upgrading) guide covers each change below with before-and-after examples.
