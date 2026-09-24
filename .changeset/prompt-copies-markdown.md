---
"blume": patch
---

`<Prompt>`'s copy button and "Open in Cursor" link now hand over the prompt as Markdown — links with their URLs, list markers, emphasis, and fenced code — instead of its bare text, which dropped every link target and flattened lists. The button and link labels are localized with the rest of the UI, using a new `content.copyPrompt` string that every shipped language pack translates.
