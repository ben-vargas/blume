---
"blume": patch
---

When a Vercel server build's function bundle is missing packages, the fix it prints now adds them with the project's own package manager (`pnpm add -D …`, `bun add -D …`, `yarn add -D …`) instead of always `npm install -D`. The missing packages are an isolated-linker problem, so the project running into it is usually not on npm.
