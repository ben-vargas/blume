---
"blume": patch
---

The assistant shows its error message when an answer comes back empty, which is how a provider failure after the response starts (a bad key, a rate limit, an unknown model) arrives, instead of leaving a pulsing placeholder that never resolves. `useAssistant` from `blume/hooks` does the same.
