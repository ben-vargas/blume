---
"blume": patch
---

Rename Ask AI to the assistant. In `blume.config.ts`, `ai.ask` is now `ai.assistant`, with the same fields and no alias:

```ts
export default defineConfig({
  ai: {
    // was: ask: { enabled: true }
    assistant: { enabled: true },
  },
});
```

A config that still sets `ai.ask` fails validation with a hint naming `ai.assistant`, and `blume upgrade` and `blume doctor` report it at its line. The feature's other names follow:

- `i18n.ui` overrides: the `ask` group is now `assistant`, and `search.askAi` and `search.askAiHint` are now `search.assistant` and `search.assistantHint`. The old keys fail validation with a hint, where an unknown key used to be dropped silently.
- `useAskAI` from `blume/hooks` is now `useAssistant`, and its `UseAskAI` and `UseAskAIOptions` types are now `UseAssistant` and `UseAssistantOptions`.
- The `askEnabled` prop on `PageLayout`, `RootLayout`, `Header`, and a `Search` override is now `assistantEnabled`.
- In `blume:data`, `config.ask` and `ui.ask` are now `config.assistant` and `ui.assistant`.
- The adapter types from `blume/ai` swap their `Ask` prefix for `Assistant` (`AskAdapter` is now `AssistantAdapter`), and `askReasoningLevels` and `AskReasoning` from `blume/schema` are now `assistantReasoningLevels` and `AssistantReasoning`.
- The `blume:open-ask-ai` window event is now `blume:open-assistant`, and the panel's `data-blume-ask` body attribute is now `data-blume-assistant`.

The header trigger, panel title, and search hand-off now read "Assistant" in English and in every built-in locale. The generated `/api/ask` route and the `ask`, `ask_answer`, and `ask_error` analytics events keep their names. The unused `actions.askAI` UI string is removed.
