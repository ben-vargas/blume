import { describe, expect, it } from "bun:test";

import type { BlumeConfig } from "../src/core/config-input.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import { node, vercel } from "../src/deploy/adapters/index.ts";

/** The `path: message` of every issue `input` fails validation with. */
const issues = (input: BlumeConfig): string[] => {
  const result = blumeConfigSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
};

const SITE_HINT =
  'Use an absolute http(s) URL with a host, like "https://docs.example.com" or "http://localhost:4321".';

describe("deployment.site", () => {
  it.each([
    "localhost:4321",
    "mailto:docs@example.com",
    // oxlint-disable-next-line no-script-url -- the schema must refuse exactly this
    "javascript:alert(1)",
  ])("rejects %s with a hint", (site) => {
    expect(issues({ deployment: { site } })).toEqual([
      `deployment.site: ${SITE_HINT}`,
    ]);
    expect(issues({ deployment: vercel({ site }) })).toEqual([
      `deployment.options.site: ${SITE_HINT}`,
    ]);
  });

  it("rejects a scheme other than http(s)", () => {
    expect(issues({ deployment: node({ site: "ftp://example.com" }) })).toEqual(
      [`deployment.options.site: ${SITE_HINT}`]
    );
  });

  it("accepts http and https origins", () => {
    expect(
      issues({ deployment: { site: "https://docs.example.com" } })
    ).toEqual([]);
    expect(
      issues({ deployment: vercel({ site: "http://localhost:4321/" }) })
    ).toEqual([]);
  });
});

describe("redirect paths", () => {
  it("requires `from` to start with a slash", () => {
    expect(issues({ redirects: [{ from: "old-page", to: "/new" }] })).toEqual([
      "redirects.0.from: redirects take root-relative paths: `from` must start with `/` (`/old-page`, not `old-page`).",
    ]);
  });

  it("requires `to` to start with a slash or be a full URL", () => {
    expect(issues({ redirects: [{ from: "/old", to: "new-page" }] })).toEqual([
      "redirects.0.to: redirects take root-relative paths or full URLs: `to` must start with `/` (`/new-page`, not `new-page`) or be an absolute URL (`https://…`).",
    ]);
    expect(
      issues({
        redirects: [
          { from: "/old", to: "/new" },
          { from: "/gone", to: "https://example.com/elsewhere" },
        ],
      })
    ).toEqual([]);
  });
});

describe("basePath", () => {
  it.each(["https://docs.example.com/docs", "/docs?x=1", "/docs#top"])(
    "rejects %s with a hint",
    (basePath) => {
      expect(issues({ basePath })).toEqual([
        'basePath: basePath takes a path like "/docs", not a URL: no scheme, host, query, or fragment. The site\'s origin goes in deployment.site.',
      ]);
    }
  );

  it("still normalizes a plain path", () => {
    expect(blumeConfigSchema.parse({ basePath: "docs/" }).basePath).toBe(
      "/docs"
    );
  });
});

describe("navigation tab paths", () => {
  it("normalizes to one leading slash and no trailing slash", () => {
    const { navigation } = blumeConfigSchema.parse({
      navigation: {
        tabs: [
          { label: "Guides", path: "/guides/" },
          { label: "API", path: "api" },
          { label: "Home", path: "/" },
        ],
      },
    });
    expect(navigation.tabs.map((tab) => tab.path)).toEqual([
      "/guides",
      "/api",
      "/",
    ]);
  });
});
