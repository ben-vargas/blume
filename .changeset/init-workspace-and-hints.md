---
"blume": patch
---

`blume init` inside a pnpm workspace that doesn't list the new folder under `packages` now skips the install (pnpm would exit without installing Blume) and tells you to add the folder, instead of saying the project joined the workspace. The `cd` line in its next steps is quoted when the directory needs it (`cd "my docs"`), and when `init --eject` can't eject after an install that ran, it reports the actual error rather than blaming missing dependencies.
