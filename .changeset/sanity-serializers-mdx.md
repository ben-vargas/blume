---
"blume": patch
---

A `sanitySource` with `serializers` now writes its entries as MDX, so a serializer that returns a Blume component (`<Callout>…</Callout>`) renders it instead of leaving the raw tag in a Markdown page. The rest of the lowered text stays valid MDX: `{` and `}` in a document's text are escaped, a block with no serializer is noted in an MDX comment, and an image's alt text is escaped like the surrounding prose.
