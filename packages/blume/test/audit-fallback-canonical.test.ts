import { describe, expect, it } from "bun:test";

import { indexabilityChecks } from "../src/audit/checks/indexability.ts";
import type { AuditContext } from "../src/audit/types.ts";
import type { Diagnostic } from "../src/core/types.ts";
import { codes, context, manifestRoute, snapshot } from "./audit-support.ts";

// An i18n fallback copy renders the default locale's page at a localized URL
// and canonicalizes to that page on purpose, so untranslated content doesn't
// compete with its source for ranking. The audit used to report every one as
// a non-canonical page.

const SITE = "https://x.dev";

// SAFETY: the indexability checks run synchronously; only the network tiers
// return a promise.
const run = (ctx: AuditContext): string[] =>
  codes(indexabilityChecks.run(ctx) as Diagnostic[]);

describe("canonical checks on i18n fallback copies", () => {
  it("accept a fallback copy canonicalizing to the page it copies", () => {
    const ctx = context({
      pages: [
        snapshot({ canonical: `${SITE}/a`, url: "/a" }),
        snapshot({
          canonical: `${SITE}/a`,
          route: manifestRoute({ fallback: true, locale: "fr", path: "/fr/a" }),
          url: "/fr/a",
        }),
      ],
      site: SITE,
    });
    expect(run(ctx)).not.toContain("CANONICAL_NOT_SELF");
  });

  it("still report a real page canonicalizing elsewhere", () => {
    const ctx = context({
      pages: [
        snapshot({ canonical: `${SITE}/a`, url: "/a" }),
        snapshot({
          canonical: `${SITE}/a`,
          route: manifestRoute({ locale: "fr", path: "/fr/a" }),
          url: "/fr/a",
        }),
      ],
      site: SITE,
    });
    expect(run(ctx)).toContain("CANONICAL_NOT_SELF");
  });

  it("still report a fallback copy whose canonical is broken", () => {
    const ctx = context({
      pages: [
        snapshot({
          canonical: `${SITE}/missing`,
          route: manifestRoute({ fallback: true, locale: "fr", path: "/fr/a" }),
          url: "/fr/a",
        }),
      ],
      site: SITE,
    });
    expect(run(ctx)).toContain("CANONICAL_BAD_TARGET");
  });
});
