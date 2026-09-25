---
"blume": minor
---

OpenAPI references now document webhooks and callbacks. Each webhook in a 3.1 spec's `webhooks` gets its own page, filed under its first tag or a Webhooks group. The page shows its payload schema, the responses your endpoint should send, and an example payload in place of the Try it panel. It lists only the security the webhook itself declares, since the spec's root `security` guards calls to the API, not the requests it sends. Webhook pages are in search, `llms.txt`, and the MCP server, and their Markdown marks them as requests the API sends. An operation's `callbacks`, inline or `$ref`'d from `components.callbacks`, render in a Callbacks section on its page with their URL expression, method, request body, and responses. Specs with webhooks no longer log a warning that they're missing from the reference.
