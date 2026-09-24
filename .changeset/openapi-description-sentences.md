---
"blume": patch
---

A generated API reference page's meta and social description no longer runs its summary into the sentence after it. OpenAPI summaries are usually title-like ("Get a flag"), so the description read "Get a flag Reference for the GET /flags/{id} endpoint in the Acme API."; the summary now ends with a period when it has no closing punctuation of its own, and so does each operation's line in the agent-facing tag listings ("— Get a flag. Deprecated.").
