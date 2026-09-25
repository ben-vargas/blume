---
"blume": minor
---

The assistant can now search the docs and read whole pages itself. Beyond the pages retrieved up front, the model gets a `search_docs` tool and a `read_page` tool, and can search, read, and search again before it answers, within one question and at most five steps. The tools run on your server against the assistant's snapshot and keep to the reader's language and docs version. When nothing matches a question up front, the assistant now searches instead of saying it doesn't know. They're on by default for `gateway()`, `openrouter()`, and `llmgateway()`, and off for `openaiCompatible()`, whose model may not support tool calling. Set `ai.assistant.tools` to change either.
