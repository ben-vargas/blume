---
"blume": patch
---

Links now resolve the same way in the built site and in `blume validate`: relative links on a page named `Index.md` resolve beside it, as its `/…/Index` route does, and links to dotted page routes such as `/releases/v1.2` move into the reader's locale and under `basePath`, in content and in component `href`s alike; only a link no page is served at counts as a public asset. `blume version` also rewrites unprefixed links (`/guides/setup`) into the snapshot when the default locale keeps its URL prefix, and for pages that exist only in another locale.
