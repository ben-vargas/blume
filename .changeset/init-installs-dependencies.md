---
"blume": patch
---

`blume init` now installs dependencies after scaffolding, with the package manager that ran it (`npx blume init` → `npm install`, `bunx blume init` → `bun install`) or the one given with `--package-manager`, so the new project runs `dev` straight away. Pass `--no-install` to only write the files; a failed install keeps the scaffold, prints the command to retry, and exits non-zero, and `--eject` now ejects in the same run. For pnpm, `init` writes a `pnpm-workspace.yaml` approving esbuild's build script, and for Yarn 2 or later a `.yarnrc.yml` with `nodeLinker: node-modules`, which Blume needs; inside an existing workspace it leaves the workspace's config alone and says what to add.
