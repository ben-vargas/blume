---
"blume": patch
---

A `notion()` source saves a downloaded asset only when the server reports an image or video type, or when the response names no type and the URL has an image or video extension. An "image" that links to an HTML page keeps its original URL with a warning instead of being served as a page from `/blume-assets/`, and an image whose caption holds a bracket or whose URL holds spaces or parentheses is now downloaded too, instead of keeping a signed Notion URL that expires. `/blume-assets/` publishes only the images and videos a source downloaded, so a file an earlier build saved under another extension is no longer served, and a downloaded video carries its video type in dev.
