---
"blume": patch
---

On a translated page, header tabs, header links, featured links, and the logo now move into the reader's locale only when that locale serves the route. A link to a custom page or the generated changelog index, which exist only at their own path, stays there instead of pointing at a localized URL that 404s. Release pages from a GitHub Releases source are also no longer copied to every other locale's URL: they publish in one language, so the copies were duplicates missing from the sitemap and llms.txt.
