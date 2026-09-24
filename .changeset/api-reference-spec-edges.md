---
"blume": patch
---

GraphQL references build from schemas that use directives they don't declare, such as Apollo Federation subgraphs (`@key`, `@link`) and AppSync schemas (`@aws_*`); syntax errors and unknown types still fail the build. A custom scalar's `@specifiedBy` URL is a link only when it's a safe web address, so a `javascript:` URL from a remote schema shows as text. OpenAPI overview pages list tag sections in the order the spec's `tags` declares them, code spans in description lines that start with HTML keep their braces, and the build warns that OpenAPI 3.1 `webhooks` aren't rendered instead of dropping them silently.
