---
"blume": patch
---

`blume audit` passes on Blume's own output for multilingual and versioned sites. The hreflang checks and the non-canonical page check skip i18n fallback copies, which canonicalize to the page they copy on purpose; the hreflang checks also accept archived pages that canonicalize to the latest docs, and match non-ASCII slugs. The sitemap and llms.txt checks no longer flag pages those files leave out on purpose: fallback copies, archived pages that canonicalize elsewhere, and pages with `ai: { exclude: true }`, which the llms.txt fix now names. A sitemap index, which Blume writes past 50,000 URLs, is read through its child sitemaps, and the size limits apply to each file.

Other checks no longer report what the config asked for. Noindex pages aren't asked for a canonical, robots.txt isn't expected to name a sitemap when `seo.sitemap` is off or to be reachable when `seo.robots` is off, `/_vercel/image` URLs aren't reported as broken images, and a locale prefix such as `pt-BR` doesn't count as an uppercase URL.
