---
"blume": patch
---

Config paths and URLs are checked up front. `deployment.site` must be an absolute `http://` or `https://` URL, so `localhost:4321`, `mailto:`, and `javascript:` values fail with a hint instead of prefixing every sitemap entry and canonical link. Redirects need a leading slash on `from` and on a relative `to`, since a path without one never gained the base path. `basePath` rejects a full URL, query, or fragment. A navigation tab's `path` is normalized to one leading slash and no trailing slash, so `/guides/` marks its tab and scopes the sidebar, and `api` links to `/api`.
