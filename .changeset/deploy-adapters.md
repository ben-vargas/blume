---
"blume": major
---

Replace `deployment.adapter` and `deployment.output` with adapters imported from `blume/deploy`: `vercel()`, `netlify()`, `cloudflare()`, or `node()`, each taking `site`, `base`, and `output` plus any option of the underlying `@astrojs/*` adapter, or the plain `{ site, base }` form for a static build on any host. Naming a host adapter builds for the server there (pass `output: "static"` to stay static with that host's platform files), and leaving `deployment` unset is still a static build, so zero-config sites are unchanged.

```ts
import { vercel } from "blume/deploy";

export default defineConfig({
  // was: deployment: { output: "server", adapter: "vercel" }
  deployment: vercel({ isr: { expiration: 60 } }),
});
```

Server output is no longer inferred from the platform's environment — name the host adapter — while `site` detection on Vercel, Netlify, and Cloudflare Pages works as before. The `--adapter`, `--output`, and `--base` flags on `blume build` are gone, and passing one stops the build naming the `deployment` setting that replaces it. The old object form fails validation with a hint, and a build that uses a server feature on static output fails naming the host adapter to set, or telling you to drop a host adapter's `output: "static"`.
