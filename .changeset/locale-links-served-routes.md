---
"blume": patch
---

On a multi-locale site, the header logo now links into the reader's locale, and the logo, header tabs, header links, and featured links move into that locale only when it serves the route. The brand link was always `/`, the default locale's start page, so a reader on `/en/...` who clicked it left the language they were reading. The configured `logo.href` (default `/`) is now treated as a default-locale path and moved into the reader's locale (`/` → `/en`, `/docs` → `/en/docs`) when that locale serves it, while absolute and protocol-relative hrefs pass through untouched; the `Logo` layout slot receives the active `locale` as a new prop. A tab or link to a custom page or the generated changelog index, which exist only at their own path, stays there instead of pointing at a localized URL that 404s.
