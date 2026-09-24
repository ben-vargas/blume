---
"blume": patch
---

The generated Ask AI route streams its answer through the AI SDK's `createTextStreamResponse` and `toTextStream` helpers instead of the deprecated `result.toTextStreamResponse()`, so `blume check` no longer reports it, and it answers `503` rather than `500` when its API key isn't set: the route exists, but can't answer until the deployment provides the key.
