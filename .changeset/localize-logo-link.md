---
"blume": patch
---

Link the header logo to the active locale's root on a multi-locale site. The brand link was always `/`, the default locale's start page, so a reader on `/en/...` who clicked the logo left the language they were reading while the header tabs beside it correctly pointed at `/en`. The logo now follows the same rule as the tabs: the configured `logo.href` (default `/`) is treated as a default-locale path and moved into the reader's locale (`/` → `/en`, `/docs` → `/en/docs`), while absolute and protocol-relative hrefs pass through untouched. The `Logo` layout slot receives the active `locale` as a new prop.
