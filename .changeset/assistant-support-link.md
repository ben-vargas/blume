---
"blume": patch
---

Add a support handoff to the assistant. `ai.assistant.support` takes a `mailto:` address, a URL, or a page on your site, and once there's a conversation the panel shows a translated "Contact support" link: an email starts with the conversation as its body, and a link gets the conversation's id as a `thread` query parameter. The assistant's `ask`, `ask_answer`, and `ask_error` analytics events now carry the same `thread`, and `useAssistant` returns it.
