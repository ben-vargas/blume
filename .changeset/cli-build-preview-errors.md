---
"blume": patch
---

`blume build` reports a page Astro can't compile or render (MDX that doesn't parse, say) as a `BLUME_BUILD_FAILED` error at that file and position, instead of an internal error asking you to report a Blume bug. After a `vercel()` or `netlify()` server build, `blume preview` explains that the adapter has no local preview server and suggests `blume dev` or the host's preview deploy, and in an ejected app `blume check`, `blume sync`, and `blume preview` now stop like `dev` and `build` do, naming the app's own command to run instead.
