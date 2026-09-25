---
"blume": minor
---

Add pattern redirects. A redirect's `from` can now cover many paths, written the way Mintlify and `vercel.json` write them: `:name` matches one segment (`/blog/:slug`), `:name*` as the last segment matches the rest of the path (`/beta/:slug*` sends `/beta/a/b` to `/v2/a/b` and `/beta` to `/v2`), and `*` ending a segment matches the rest from there (`/old/article-*`). `to` reads the captures (`/v2/:slug*`, `/new/article-*`). Every host gets them in its own syntax: `_redirects` splats, `vercel.json` sources, and the routing config of a Vercel or Netlify server build, while the Node and Cloudflare servers and `blume dev` match them directly. Exact redirects win over a pattern that covers the same path. A pattern that also matches a page fails the build (`BLUME_REDIRECT_MATCHES_PAGE`), since hosts disagree on which answers, and links into a pattern count as valid in `blume validate` and `blume audit`.
