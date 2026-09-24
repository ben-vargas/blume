---
"blume": patch
---

`blume eval --agent codex` now runs both the reader and the judge with Codex's shell, exec, and local-image tools turned off and no inherited environment, leaving them only the prompt and the docs MCP tools. Codex's read-only sandbox still let its shell tool read any file on the machine, so an instruction planted in remote docs content could have pulled a local secret into the transcript sent to the model provider.
