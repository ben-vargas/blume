---
"blume": patch
---

Header and sidebar links now land where they should across versions, locales, and base paths:

- On an archived version's pages, a tab links into that version's section (`/v1.0/guides/…`) instead of the current docs' path, which 404ed when the section had no index page.
- On a non-default locale, a `/changelog` tab opens the changelog timeline instead of the newest entry, and a tab whose path is a custom page opens that page.
- With a `basePath`, the logo in a non-default locale links inside the base (`/docs/fr`) instead of to `/fr`.
- Internal `href` links in an explicit `navigation.sidebar` move into the reader's locale, as featured links do.
- An explicit `navigation.sidebar` item that can't render as written now reports a warning: a route that matches no page, a `root` that matches no page, or an item with no route, `href`, `root`, or `items`.
- A featured or header link with a query or fragment (`/guides?tab=cli`) is no longer reported as `BLUME_NAV_MISSING_PAGE` when its page exists.
