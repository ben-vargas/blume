import { describe, expect, it } from "bun:test";

import { posthogHead } from "../src/analytics/posthog.ts";
import type { PosthogOptions } from "../src/analytics/posthog.ts";

/**
 * Blume captures a `$pageview` on client-router navigations only while
 * PostHog itself captures page loads alone. PostHog's own history tracking
 * would otherwise count every navigation twice, and `capture_pageview: false`
 * must mean no pageviews.
 */

const PAGEVIEW = 'posthog.capture("$pageview");';

const sendsNavigationPageviews = (options: PosthogOptions): boolean =>
  posthogHead(options).some((script) => script.content?.includes(PAGEVIEW));

describe("PostHog client-router pageviews", () => {
  it("are sent with PostHog's classic load-only pageviews", () => {
    expect(sendsNavigationPageviews({ key: "k" })).toBe(true);
    expect(sendsNavigationPageviews({ capture_pageview: true, key: "k" })).toBe(
      true
    );
    expect(sendsNavigationPageviews({ defaults: "unset", key: "k" })).toBe(
      true
    );
    // An explicit `true` keeps load-only pageviews whatever the defaults.
    expect(
      sendsNavigationPageviews({
        capture_pageview: true,
        defaults: "2025-05-24",
        key: "k",
      })
    ).toBe(true);
  });

  it("are left to PostHog when it tracks history changes itself", () => {
    expect(
      sendsNavigationPageviews({ capture_pageview: "history_change", key: "k" })
    ).toBe(false);
    expect(sendsNavigationPageviews({ defaults: "2025-05-24", key: "k" })).toBe(
      false
    );
  });

  it("are not sent when pageviews are off", () => {
    expect(
      sendsNavigationPageviews({ capture_pageview: false, key: "k" })
    ).toBe(false);
  });

  it("forwards the options to posthog.init either way", () => {
    const [script] = posthogHead({
      capture_pageview: "history_change",
      key: "k",
    });
    expect(script?.content).toContain('"capture_pageview":"history_change"');
  });
});
