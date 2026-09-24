---
"blume": patch
---

Links in content Blume imports from someone else — an OpenAPI or AsyncAPI spec's descriptions, a `githubReleases()` repository's release notes, and rich text from Sanity, Contentful, Payload, and Strapi — now render only when they point at a web, mail, phone, or relative address. A `javascript:`, `data:`, or `vbscript:` link keeps its label as plain text instead of becoming a link that would run as the docs site when a reader clicked it. Pages you write yourself are unchanged.
