---
"blume": minor
---

Pass props to an `<include>`: every attribute other than `lang` and `meta` becomes a value the included file reads with `{{name}}`, like `<include plan="Pro" feature="SSO">./_snippets/upgrade.mdx</include>`. Props reach the partial's own nested includes and take precedence over a site-wide variable with the same name.
