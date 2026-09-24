---
"blume": minor
---

Add `contentful()`, `payload()`, and `strapi()` content source adapters to `blume/sources`. Each reads one content type or collection through the CMS's REST API, with no SDK to install, maps its fields to frontmatter through the same `fields` option Sanity uses, and lowers its rich text to Markdown (Contentful rich text, Payload's Lexical state, and Strapi's Blocks field), escaping it so what an author typed stays prose. Setting `serializers` on `contentfulSource` or `payloadSource` writes the body as MDX, so the components they return render; a Markdown text field passes through as written.

`contentful()` reads `CONTENTFUL_ACCESS_TOKEN`, and under `--preview` reads drafts through the Preview API with `CONTENTFUL_PREVIEW_TOKEN` (failing clearly without one). `payload()` reads `PAYLOAD_API_KEY` and `strapi()` reads `STRAPI_API_TOKEN`; under `--preview` both stage unpublished documents with `draft: true`. Relative upload paths resolve against the CMS origin, `params` appends query parameters (`where[...]`, `filters[...]`), requests time out after 30 seconds, and `blume init` offers all three.
