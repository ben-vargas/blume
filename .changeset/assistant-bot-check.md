---
"blume": minor
---

Add a bot check for the assistant. `ai.assistant.captcha` takes an adapter from `blume/captcha`, `turnstile({ siteKey })` or `hcaptcha({ siteKey })`, run invisibly: the provider's script loads with a reader's first question, the panel sends a fresh token with each question, and the generated route verifies it (with `TURNSTILE_SECRET_KEY` or `HCAPTCHA_SECRET_KEY`) before the model runs. A failed check answers `403`, which the panel shows as a translated "we couldn't check that you're human"; a missing secret answers with the assistant's "not configured" notice, and `blume build` warns. With an external `endpoint`, the token is sent as `captcha` in the request body for that backend to verify. `useAssistant` takes the `captcha` settings and a `verifyMessage` too.
