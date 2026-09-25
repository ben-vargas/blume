---
"blume": minor
---

Add components for documenting endpoints by hand. `<ParamField>` is a request parameter, named by where it goes (`<ParamField query="limit" type="integer" default={20}>`, or `path`, `header`, `body`), and `<ResponseField name="id" type="string">` is a field of the response, with optional `pre` and `post` labels. Both take `type`, `required`, `deprecated`, and `default`, hold their description as content, and nest an object's fields inside an `<Expandable>`. They render like the OpenAPI reference's rows, and a page's Markdown copy lists each field with its type and flags. `<RequestExample>` and `<ResponseExample>` hold code blocks as tabs (or a language menu with `dropdown`); on a wide screen they pin to a column beside the page, request above response, and stay in view while the reader scrolls, the way an OpenAPI operation's examples do. The names and props match Mintlify's, so migrated pages keep them as written.
