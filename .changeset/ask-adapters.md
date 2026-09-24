---
"blume": major
---

Configure the Ask AI backend with an adapter from `blume/ai`: `ai.ask.provider` takes `gateway({ model })`, `openrouter({ model, reasoning })`, `llmgateway({ model })`, `inkeep({ model })`, or `openaiCompatible({ baseUrl, name, model, apiKeyEnv })`, and each owns its model, API key env var, `headers`, `reasoning` mapping, and a `providerOptions` passthrough to `streamText`. The flat `provider` name and the `model`, `apiKeyEnv`, `baseUrl`, `headers`, and `reasoning` fields on `ai.ask` are gone, and a config still using them fails naming the adapter call that replaces them; leaving `provider` unset still means the AI Gateway with `openai/gpt-5.5`.

```ts
import { openrouter } from "blume/ai";

export default defineConfig({
  ai: {
    ask: {
      enabled: true,
      // was: provider: "openrouter", model: "anthropic/claude-sonnet-4-5"
      provider: openrouter({ model: "anthropic/claude-sonnet-4-5" }),
    },
  },
});
```
