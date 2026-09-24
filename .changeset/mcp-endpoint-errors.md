---
"blume": patch
---

The MCP endpoint now reads a request body only up to 64 KB and answers anything larger with `413`. A call to a tool that doesn't exist, or with `arguments` that aren't an object, now gets the JSON-RPC Invalid params error (`-32602`) with a short message. The `/mcp` operation in `openapi.json` now lists `text/event-stream` beside `application/json`, so a generated client sends the `Accept` header the endpoint requires.
