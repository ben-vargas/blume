---
"blume": major
---

`redirects` take exact paths: a `from` or `to` holding a `:param` segment or a `*` wildcard now fails config validation, naming the redirect. Patterns were never supported, and hosts disagreed on them — a static build wrote a literal `:slug` folder, Vercel and Netlify passed the pattern through, and a Cloudflare server build served the page instead of redirecting — so move pattern rules into your host's own config (`vercel.json`, `_redirects`) and list exact paths in `redirects`.
