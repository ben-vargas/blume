---
"blume": patch
---

`#`, `?`, and `%` are now dropped from routes the way `:` already was, so `sdks/100%.md` publishes at `/sdks/100` and sidebar and pagination links reach it; before, links to `c#.md` sent readers to `/sdks/c` while Astro wrote the page to `c%23/`, and a bare `%` broke the build's URL decoding. A frontmatter `slug` with a `.` or `..` segment (`../../etc/escape`, `guides/./x`) is now rejected with an error at the key instead of publishing a page no link could reach. A group folder's numeric prefix now works on either side of the parentheses: `(01-zeta)` sorts first instead of last, and `01-(gamma)` publishes at `/g` as a "Gamma" group instead of at `/(gamma)/g`.
