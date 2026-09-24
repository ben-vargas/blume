---
"blume": patch
---

With a `basePath`, the `_headers` and `vercel.json` rules that pin `charset=utf-8` on raw Markdown now cover every mirror, not only those under `basePath`: the section home's `/<basePath>.md` and the generated `/index.md`, `/changelog.md`, and `/404.md` went out without a charset, so browsers showed their non-ASCII text as mojibake.
