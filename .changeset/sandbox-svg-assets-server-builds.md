---
"blume": patch
---

SVG images a content source downloads are now served with `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff` by `vercel()`, `netlify()`, and `cloudflare()` server builds too, each through its host's own mechanism: a route in Vercel's routing config, a header rule in Netlify's `.netlify/v1/config.json`, and the Worker Blume puts in front of Astro's on Cloudflare. The `/blume-assets` route prerenders, so its own headers never reached a deployed site. A `node()` server now matches those SVGs by the file it serves rather than the raw URL, so an encoded spelling (`abc.sv%67`, `abc%2Esvg`) or a path outside `deployment.base` no longer skips the sandbox, and static builds add `nosniff` beside it.
