---
"blume": patch
---

Only file and folder names lose an ordering prefix (`01-intro.mdx` → `/intro`, and an Obsidian note `01 Intro` → `/intro`). A frontmatter `slug`, a GitHub release tag, and a CMS slug keep their leading numbers, so releases `1.0.0` and `2.0.0` publish at `/changelog/1-0-0` and `/changelog/2-0-0` instead of colliding on `/changelog/0-0`. A version (`1.2.0.md`) or an ISO date (`2024-01-05-first-post.md`) is part of a name rather than an order, which also stops posts from the same year raising a duplicate sidebar order warning. A source `prefix` written with slashes (`sanity({ prefix: "/guides" })`) now names the source `guides`, so its pages no longer 404 and its asset URLs no longer carry a double slash.
