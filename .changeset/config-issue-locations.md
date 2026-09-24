---
"blume": patch
---

A config error now points at the line that holds the problem: an invalid `redirects[2].status` at the third redirect rather than the first, and a missing key such as `github.repo` or `i18n.locales[1].label` at its parent object or array entry rather than at a same-named key later in the file, so issues also list in the order they appear. A `blume.config.ts` without a default export (a bare `defineConfig({ … })` call, `export const config`, or `export default null`) now fails with one diagnostic naming the file and the missing `export default`, where it used to build a default site or fail with an unrelated error. The `defineConfig` hover docs no longer list `markdown.math` or inline-highlighting options the config doesn't accept.
