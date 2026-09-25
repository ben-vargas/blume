---
"blume": patch
---

A page whose body starts with a `---` horizontal rule, right below its front matter, no longer loses everything up to the next `---` line. The renderer read that stretch as a second front matter block and dropped it; both rules and the text between them now render.
