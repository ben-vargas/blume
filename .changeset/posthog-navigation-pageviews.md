---
"blume": patch
---

The `posthog()` analytics adapter only sends its own `$pageview` on client-router navigations while PostHog captures page loads alone. With `capture_pageview: "history_change"` or a `defaults` date such as `"2025-05-24"`, PostHog tracks navigations itself and each one is no longer counted twice, and `capture_pageview: false` now means no pageviews at all.
