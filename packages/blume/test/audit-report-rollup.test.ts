import { describe, expect, it } from "bun:test";

import { finding } from "../src/audit/catalog.ts";
import { formatReport, reportJson, rollup } from "../src/audit/report.ts";
import type { AuditResult } from "../src/audit/run.ts";

/**
 * The grouped report's headline numbers: a group counts the pages it touches,
 * not its findings, and its glyph shows the severity its findings actually
 * carry.
 */

const strip = (value: string): string =>
  // oxlint-disable-next-line no-control-regex -- strip ANSI colors for assertions
  value.replaceAll(/\[[0-9;]*m/gu, "");

const result = (diagnostics: AuditResult["diagnostics"]): AuditResult => ({
  diagnostics,
  origin: null,
  pages: 10,
  staticDir: "/root/dist",
  tiers: { external: false, network: false, static: true },
});

const absolute = (url: string, href: string) =>
  finding(
    "BLUME_AUDIT_INTERNAL_LINK_ABSOLUTE",
    { url },
    `Link to ${href} hardcodes the site's origin.`
  );

describe("page counts", () => {
  // One page with three hardcoded-origin links, plus one more page.
  const diagnostics = [
    absolute("/a", "https://x.dev/1"),
    absolute("/a", "https://x.dev/2"),
    absolute("/a", "https://x.dev/3"),
    absolute("/b", "https://x.dev/4"),
  ];

  it("labels a group with its distinct pages and previews each once", () => {
    const text = strip(formatReport(result(diagnostics), "/root"));
    expect(text).toContain(
      "Internal link hardcodes the site's own origin  2 pages"
    );
    expect(text.match(/^ {6}\/a\b/gmu)).toHaveLength(1);
    expect(text.match(/^ {6}\/b\b/gmu)).toHaveLength(1);
    expect(text).not.toContain("more (--verbose)");
  });

  it("collapses pages past the preview, counting pages rather than findings", () => {
    const many = ["/a", "/a", "/b", "/c", "/d", "/e"].map((url) =>
      absolute(url, "https://x.dev/")
    );
    const text = strip(formatReport(result(many), "/root"));
    expect(text).toContain("5 pages");
    expect(text).toContain("… and 2 more (--verbose)");
  });

  it("lists every finding under --verbose", () => {
    const text = strip(
      formatReport(result(diagnostics), "/root", { verbose: true })
    );
    expect(text.match(/^ {6}\/a\b/gmu)).toHaveLength(3);
    for (const n of [1, 2, 3, 4]) {
      expect(text).toContain(`Link to https://x.dev/${n}`);
    }
    expect(text).not.toContain("more (--verbose)");
  });

  it("keeps the finding count alongside the page count in the rollup", () => {
    const [group] = rollup(diagnostics);
    expect(group?.count).toBe(4);
    expect(group?.pages).toBe(2);
  });
});

describe("group severity", () => {
  // An external link answering 503 is downgraded to a warning at runtime.
  const downgraded = {
    ...finding(
      "BLUME_AUDIT_EXTERNAL_LINK_BROKEN",
      { url: "/a" },
      "https://x.dev/ is unreachable (HTTP 503), linked from 1 page(s)."
    ),
    severity: "warning" as const,
  };

  it("shows the severity the findings carry, not the catalog's", () => {
    const text = strip(formatReport(result([downgraded]), "/root"));
    expect(text).toContain("0 errors · 1 warning");
    expect(text).toContain("⚠ External link is broken");
    expect(text).not.toContain("✖");
    expect(
      JSON.parse(reportJson(result([downgraded]), "/root")).audit.checks
    ).toEqual([
      {
        category: "network",
        count: 1,
        id: "BLUME_AUDIT_EXTERNAL_LINK_BROKEN",
        severity: "warning",
      },
    ]);
  });

  it("shows the worst severity in a mixed group", () => {
    const broken = finding(
      "BLUME_AUDIT_EXTERNAL_LINK_BROKEN",
      { url: "/b" },
      "https://x.dev/gone is unreachable (HTTP 404), linked from 1 page(s)."
    );
    const [group] = rollup([downgraded, broken]);
    expect(group?.severity).toBe("error");
  });
});

describe("fix lines", () => {
  it("prints each distinct fix a group's findings carry, once", () => {
    const text = strip(
      formatReport(
        result([
          finding("BLUME_AUDIT_LINK_TO_BROKEN", { url: "/a" }, "a"),
          finding("BLUME_AUDIT_LINK_TO_BROKEN", { url: "/b" }, "b"),
          finding(
            "BLUME_AUDIT_LINK_TO_BROKEN",
            { url: "/c" },
            "c",
            "Fix the entry in your navigation config or meta file."
          ),
        ]),
        "/root"
      )
    );
    expect(text.match(/fix: /gu)).toHaveLength(2);
    expect(text).toContain(
      "fix: Fix the link target, or create the page it points at."
    );
    expect(text).toContain(
      "fix: Fix the entry in your navigation config or meta file."
    );
  });
});
