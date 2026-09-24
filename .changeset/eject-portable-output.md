---
"blume": patch
---

`blume eject` now writes an Astro app that builds from any checkout, not only the directory it ran in. The ejected `astro.config.mjs` uses a relative `outDir` and `pages/` scan glob, hands a deploy adapter no absolute project root, and resolves its `blume:*` aliases against the config file when it loads, so Vite no longer prints a "not an absolute path" warning per alias on every build; island and example wrappers import their components by relative path; and the config's header no longer says it is recreated on each run. Eject also adds the packages the ejected app imports by name to `package.json` at the ranges Blume uses — `astro`, `@astrojs/mdx`, `@tailwindcss/vite`, the integrations and adapter SDKs the config wires in, and `react` and `react-dom` when React renders an island, example, or Ask AI — and its closing message lists the install command first, so `astro build` runs under pnpm, which resolves only a project's own dependencies.
