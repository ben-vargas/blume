---
"blume": patch
---

The banner's link is written as if the site were mounted at root, like a featured link: with `basePath` set it lands under the base, and on a multi-locale site it points at the reader's locale when that locale serves the page. A link to a route served outside the docs (a custom page, the generated changelog) keeps its own path. A `<TypeTable>` entry's `typeDescriptionLink` gets the base too.
