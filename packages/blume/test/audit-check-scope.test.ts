import { afterAll, describe, expect, it } from "bun:test";

import { contentChecks } from "../src/audit/checks/content.ts";
import { indexabilityChecks } from "../src/audit/checks/indexability.ts";
import { networkChecks } from "../src/audit/checks/network.ts";
import { robotsChecks } from "../src/audit/checks/robots.ts";
import { urlChecks } from "../src/audit/checks/social.ts";
import type { AuditContext, CheckModule } from "../src/audit/types.ts";
import { isHttpUrl } from "../src/audit/url.ts";
import type { Diagnostic } from "../src/core/types.ts";
import { codes, context, manifestRoute, snapshot } from "./audit-support.ts";

/**
 * Checks that must follow the site's own configuration: what Blume was told
 * not to emit, or emits differently on purpose, is not a finding.
 */

const SITE = "https://x.dev";

const findings = async (
  module: CheckModule,
  ctx: AuditContext
): Promise<Diagnostic[]> => await module.run(ctx);

const run = async (module: CheckModule, ctx: AuditContext) =>
  codes(await findings(module, ctx));

describe("canonical on noindex pages", () => {
  it("doesn't ask a noindex page for the canonical the layouts omit", async () => {
    const ctx = context({
      pages: [snapshot({ indexable: false, robots: "noindex", url: "/a" })],
      site: SITE,
    });
    expect(await run(indexabilityChecks, ctx)).not.toContain(
      "CANONICAL_MISSING"
    );
  });

  it("still asks an indexable page for one", async () => {
    const ctx = context({ pages: [snapshot({ url: "/a" })], site: SITE });
    expect(await run(indexabilityChecks, ctx)).toContain("CANONICAL_MISSING");
  });
});

describe("robots.txt Sitemap line", () => {
  const robots = {
    file: "/dist/robots.txt",
    invalid: [],
    raw: "User-agent: *\nAllow: /\n",
    sitemaps: [],
  };

  it("isn't expected when seo.sitemap is off", async () => {
    const ctx = context({ robots, seo: { sitemap: false }, site: SITE });
    expect(await run(robotsChecks, ctx)).toEqual([]);
  });

  it("is expected when there is a sitemap to point at", async () => {
    const ctx = context({ robots, site: SITE });
    expect(await run(robotsChecks, ctx)).toEqual(["ROBOTS_SITEMAP_MISSING"]);
  });
});

describe("robots.txt on the live site", () => {
  // Answers the page and nothing else: robots.txt and sitemap.xml 404.
  const server = Bun.serve({
    fetch: (request) =>
      new URL(request.url).pathname === "/"
        ? new Response("ok", { headers: { "content-encoding": "gzip" } })
        : new Response("not found", { status: 404 }),
    port: 0,
  });
  afterAll(() => {
    server.stop(true);
  });
  const live = (robots: boolean) => ({
    ...context({ pages: [snapshot({ url: "/" })], seo: { robots } }),
    origin: `http://localhost:${server.port}`,
  });

  it("isn't expected when seo.robots is off", async () => {
    expect(await run(networkChecks, live(false))).not.toContain(
      "ROBOTS_NOT_ACCESSIBLE"
    );
  });

  it("is reported missing when Blume generates it", async () => {
    expect(await run(networkChecks, live(true))).toContain(
      "ROBOTS_NOT_ACCESSIBLE"
    );
  });
});

describe("--url validation", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(isHttpUrl("https://docs.example.com")).toBe(true);
    expect(isHttpUrl("http://localhost:4321/docs")).toBe(true);
  });

  it("rejects a bare host, another scheme, or garbage", () => {
    expect(isHttpUrl("example.com")).toBe(false);
    expect(isHttpUrl("localhost:4321")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});

describe("URL style and locale prefixes", () => {
  const i18n = { locales: [{ code: "en" }, { code: "pt-BR" }] };

  it("ignores the casing of a configured locale segment", async () => {
    const ctx = context({
      i18n,
      pages: [snapshot({ url: "/pt-BR" }), snapshot({ url: "/pt-BR/guide" })],
    });
    expect(await run(urlChecks, ctx)).toEqual([]);
  });

  it("still flags uppercase in the slug itself", async () => {
    const ctx = context({
      i18n,
      pages: [
        snapshot({ url: "/pt-BR/Guide" }),
        // Not a configured locale, so its casing is the author's.
        snapshot({ url: "/pt-PT/guide" }),
      ],
    });
    expect(await run(urlChecks, ctx)).toEqual(["URL_STYLE", "URL_STYLE"]);
  });

  it("flags uppercase anywhere on a site without i18n", async () => {
    const ctx = context({ pages: [snapshot({ url: "/pt-BR/guide" })] });
    expect(await run(urlChecks, ctx)).toEqual(["URL_STYLE"]);
  });
});

describe("fixes for generated API reference pages", () => {
  // Past the 160-column snippet a search engine shows.
  const LONG = "Returns the pet. ".repeat(12);

  it("point at the spec, which has the text — there's no front matter", async () => {
    const ctx = context({
      pages: [
        snapshot({
          descriptions: [LONG],
          route: manifestRoute({ source: { name: "openapi", ref: "pet.md" } }),
          titles: ["Hi"],
          url: "/api/pet",
        }),
      ],
    });
    const found = await findings(contentChecks, ctx);
    expect(found.map((finding) => [finding.code, finding.suggestion])).toEqual([
      [
        "BLUME_AUDIT_TITLE_LENGTH",
        expect.stringContaining("the operation's `summary`"),
      ],
      [
        "BLUME_AUDIT_DESCRIPTION_LENGTH",
        expect.stringContaining("the operation's `description` or `summary`"),
      ],
    ]);
  });

  it("keep the front matter fix for authored pages", async () => {
    const ctx = context({
      pages: [snapshot({ descriptions: [LONG], route: manifestRoute() })],
    });
    const [finding] = await findings(contentChecks, ctx);
    expect(finding?.suggestion).toContain("frontmatter");
  });
});
