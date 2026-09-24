---
"blume": patch
---

The `blume audit` report labels each check with the number of distinct pages it affects and previews each page once, while `--verbose` still lists every finding. A check's glyph follows its findings' actual severity, so an external link downgraded to a warning no longer shows as an error. Each distinct fix in a group is printed, and length findings on pages generated from an API spec point at the spec's summary or description instead of front matter.

On a site with `deployment.base`, links, assets, and `og:image` URLs that leave out the base are reported, since the deployed site doesn't serve them. `blume audit --url` rejects a value with no scheme, such as `example.com`, with a message suggesting the `https://` form instead of failing with an internal error.
