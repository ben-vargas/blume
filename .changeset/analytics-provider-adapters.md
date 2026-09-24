---
"blume": minor
---

Add first-class analytics adapters for Adobe Analytics, Amplitude, Microsoft Clarity, Clearbit, Fathom, Google Analytics 4, Google Tag Manager, Heap, Hightouch, Hotjar, LogRocket, Mixpanel, Pirsch, Plausible, and Segment, alongside PostHog, Vercel, and Cloudflare:

```ts
import { googleAnalytics, mixpanel, plausible } from "blume/analytics";

export default defineConfig({
  analytics: [
    googleAnalytics({ id: "G-…" }),
    plausible({ domain: "docs.example.com" }),
    mixpanel({ token: "…", region: "eu" }),
  ],
});
```

Each adapter renders the provider's own install snippet from its public identifier, maps the options it names (`region` to Mixpanel's ingestion host, `host` to Plausible's script origin, `cdn` to Segment's custom domain, …), and forwards everything else verbatim — into the SDK's `init` options for the script-based providers and as `data-` attributes for the tag-based ones. Client-router navigations count as pageviews on every adapter: Segment and Hightouch get the same `astro:page-load` hook PostHog has, Mixpanel is initialized with URL-change tracking on, Fathom's tag defaults to `data-spa="auto"`, and the rest follow history changes on their own. Page feedback's custom event now reaches each of these providers through its client API as well (into a custom `dataLayer` when `googleTagManager()` names one), and Plausible gets its custom-event queue stub so an event fired before the deferred script loads isn't lost.
