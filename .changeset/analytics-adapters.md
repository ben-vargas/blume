---
"blume": major
---

Replace the `analytics` object with a list of adapters imported from `blume/analytics`, emitted in order:

```ts
import { posthog, script, vercel } from "blume/analytics";

export default defineConfig({
  analytics: [
    posthog({ key: "phc_…" }),
    vercel(),
    script({ src: "https://plausible.io/js/script.js", strategy: "defer" }),
  ],
});
```

Move each key to its adapter: `posthog: { key, host }` → `posthog({ key, host })`, `vercel: true` → `vercel()`, `cloudflare: { token }` → `cloudflare({ token })`, and each `scripts[]` entry → `script({ … })`. Every adapter forwards the options Blume doesn't name to the provider (into `posthog.init`, the Cloudflare beacon's JSON, or the Vercel component's props), and the object form fails validation with a hint pointing at the list.
