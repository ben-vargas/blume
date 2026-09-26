---
"blume": minor
---

Add rate limiting to the server routes a reader can call: the assistant, the API playground proxy, and Mixedbread search. Each reader, by IP address, gets 30 requests per route every 10 minutes by default, and past that the route answers `429 Too Many Requests` with a `Retry-After` header, which the assistant turns into a translated "try again in a few minutes". `rateLimit` in `blume.config.ts` takes an adapter from `blume/ratelimit`: `memory()`, the default, counts in the server's memory (exact on `node()`, per instance on serverless hosts); `upstash()` shares the count through Upstash Redis's REST API (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`); and `cloudflare()` counts with Workers rate limiting, declaring the binding in the built Worker's config. Each takes `requests` and `window` (seconds). A request whose address the host can't tell is let through, and so is one a shared store fails to count. `rateLimit: false` turns it off.
