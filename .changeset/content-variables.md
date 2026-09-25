---
"blume": minor
---

Add content variables. Define values under `variables` in `blume.config.ts`, like `{ version: "2.1.0", "api-url": "https://api.example.com" }`, and `{{version}}` anywhere in a page reads the value: in prose, headings, links, code, and component props, in `.md` and `.mdx` pages and the files they include. Search, the `.md` mirrors, and `llms-full.txt` show the value too. An undefined name in prose fails the build at its line (`BLUME_UNDEFINED_VARIABLE`); inside code it's left as written. Sites that define no variables are unaffected.
