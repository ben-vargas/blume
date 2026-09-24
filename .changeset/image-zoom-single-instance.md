---
"blume": patch
---

Click-to-zoom images (`markdown.imageZoom`) no longer leak across client-router navigations. Every page view created a new zoom instance, each adding keyboard, scroll, and resize listeners to the document that were never removed and keeping the previous pages' images in memory; one instance is now re-pointed at each page's images.
