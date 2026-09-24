---
"blume": patch
---

SVG images a content source downloads are served with `Content-Security-Policy: sandbox`, from the `/blume-assets` route in dev and server builds, from a `node()` server's entry, and through the `_headers` and `vercel.json` rules a static build writes. An SVG opened directly is a document, so one uploaded to a CMS with a `<script>` inside could otherwise run as the docs site; an `<img>` that embeds it renders as before.
