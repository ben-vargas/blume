---
"blume": patch
---

`llms.txt`, `agent-readability.json`, the API and AI catalogs, and the `_headers` and `vercel.json` rules now list the agent skills index only when the build published a skill, and the MCP server only when it was generated, rather than whenever `agents.skills` or `agents.mcp` is set. The API catalog is now served as `application/linkset+json` with the RFC 9727 `profile` parameter, in its `Content-Type` and in the homepage `Link` header.
