---
"blume": patch
---

`blume init` now installs dependencies after scaffolding, using the package manager that ran it (`bunx blume init` → `bun install`, `npx blume init` → `npm install`, and so on) or the one given with `--package-manager`, so the generated project runs `dev` straight away. Pass `--no-install` to only write the files. When the install fails, the scaffold is kept, the exact command to retry is printed, and the command exits non-zero. `--eject` now ejects in the same run instead of asking you to install first.
