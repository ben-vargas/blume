---
"blume": patch
---

A `githubReleases()` source rewrites links in release notes that point at the site's own `deployment.site` to root-relative paths, so changelog pages follow preview deploys and the deployment base and no longer trip `blume audit`'s "Internal link hardcodes the site's own origin" check.
