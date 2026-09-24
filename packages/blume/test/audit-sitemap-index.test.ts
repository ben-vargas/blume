import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { sitemapChecks } from "../src/audit/checks/sitemap.ts";
import { crawlStaticDir } from "../src/audit/crawl.ts";
import type { AuditContext, SitemapDoc } from "../src/audit/types.ts";
import type { BlumeManifest, Diagnostic } from "../src/core/types.ts";
import { codes, context, manifestRoute, snapshot } from "./audit-support.ts";

/**
 * The sitemap as Blume writes it: a single urlset, or — past 50,000 URLs — a
 * sitemap index over numbered urlset chunks. And the reverse check, which
 * must leave alone the pages the sitemap omits on purpose.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const build = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-sitemap-index-"));
  dirs.push(root);
  await Promise.all(
    Object.entries(files).map(async ([rel, content]) => {
      const abs = join(root, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content);
    })
  );
  return root;
};

const noRoutes: BlumeManifest["routes"] = [];
// SAFETY: the crawl reads only `routes` off the manifest, so the fixture can
// omit the other manifest fields.
const manifest = { routes: noRoutes } as BlumeManifest;

const PAGE =
  '<!doctype html><html lang="en"><head><title>Home</title></head><body><main></main></body></html>';

const SITE = "https://x.dev";

const urlset = (...locs: string[]) =>
  `<urlset>${locs
    .map((loc) => `<url><loc>${loc}</loc><lastmod>2026-01-01</lastmod></url>`)
    .join("")}</urlset>`;

const index = (...locs: string[]) =>
  `<sitemapindex>${locs
    .map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`)
    .join("")}</sitemapindex>`;

const crawl = (staticDir: string, deployBase?: string) =>
  crawlStaticDir({ basePath: "", deployBase, manifest, staticDir });

const errorOf = async (staticDir: string): Promise<string | undefined> => {
  const { sitemap } = await crawl(staticDir);
  return sitemap?.error;
};

// SAFETY: the sitemap checks run synchronously.
const diagnosticsOf = (ctx: AuditContext): Diagnostic[] =>
  sitemapChecks.run(ctx) as Diagnostic[];

const run = (ctx: AuditContext): string[] => codes(diagnosticsOf(ctx));

describe("crawling a sitemap index", () => {
  it("merges every child urlset's URLs and lastmods", async () => {
    const dir = await build({
      "index.html": PAGE,
      "sitemap-1.xml": urlset(`${SITE}/`, `${SITE}/a`),
      "sitemap-2.xml": urlset(`${SITE}/b`),
      "sitemap.xml": index(`${SITE}/sitemap-1.xml`, `${SITE}/sitemap-2.xml`),
    });
    const { sitemap } = await crawl(dir);
    expect(sitemap?.error).toBeUndefined();
    expect(sitemap?.urls).toEqual([`${SITE}/`, `${SITE}/a`, `${SITE}/b`]);
    expect(sitemap?.lastmod?.get(`${SITE}/b`)).toBe("2026-01-01");
    expect(sitemap?.parts?.map((part) => [part.url, part.urls])).toEqual([
      ["/sitemap-1.xml", 2],
      ["/sitemap-2.xml", 1],
    ]);
  });

  it("finds the children under the deployment base", async () => {
    const dir = await build({
      "index.html": PAGE,
      "sitemap-1.xml": urlset(`${SITE}/base/`),
      "sitemap.xml": index(`${SITE}/base/sitemap-1.xml`),
    });
    const { sitemap } = await crawl(dir, "/base");
    expect(sitemap?.error).toBeUndefined();
    expect(sitemap?.urls).toEqual([`${SITE}/base/`]);
  });

  it("reports a child the build doesn't have, or that isn't a urlset", async () => {
    const missing = await build({
      "index.html": PAGE,
      "sitemap.xml": index(`${SITE}/sitemap-1.xml`),
    });
    expect(await errorOf(missing)).toContain(
      "which is not a urlset in the build"
    );

    const nested = await build({
      "index.html": PAGE,
      "sitemap-1.xml": index(`${SITE}/sitemap-2.xml`),
      "sitemap.xml": index(`${SITE}/sitemap-1.xml`),
    });
    expect(await errorOf(nested)).toContain(
      "which is not a urlset in the build"
    );

    const unparseable = await build({
      "index.html": PAGE,
      "sitemap.xml": index("not a url"),
    });
    expect(await errorOf(unparseable)).toContain(
      "which is not a valid absolute URL"
    );
  });

  it("is audited like a single sitemap", async () => {
    const dir = await build({
      "a/index.html": PAGE,
      "index.html": PAGE,
      "sitemap-1.xml": urlset(`${SITE}/`),
      "sitemap-2.xml": urlset(`${SITE}/a`),
      "sitemap.xml": index(`${SITE}/sitemap-1.xml`, `${SITE}/sitemap-2.xml`),
    });
    const { sitemap } = await crawl(dir);
    const ctx = context({
      pages: [snapshot({ url: "/" }), snapshot({ url: "/a" })],
      site: SITE,
      sitemap,
    });
    expect(run(ctx)).toEqual([]);
  });
});

const doc = (over: Partial<SitemapDoc> = {}): SitemapDoc => ({
  bytes: 100,
  file: "/dist/sitemap.xml",
  lastmod: new Map(),
  urls: [`${SITE}/`],
  ...over,
});

describe("sitemap size limits", () => {
  it("applies the 50,000-URL limit to each file of an index, not the total", () => {
    const within = context({
      pages: [snapshot({ url: "/" })],
      site: SITE,
      sitemap: doc({
        parts: [
          {
            bytes: 100,
            file: "/dist/sitemap-1.xml",
            url: "/sitemap-1.xml",
            urls: 50_000,
          },
          {
            bytes: 100,
            file: "/dist/sitemap-2.xml",
            url: "/sitemap-2.xml",
            urls: 1,
          },
        ],
      }),
    });
    expect(run(within)).toEqual([]);

    const over = context({
      pages: [snapshot({ url: "/" })],
      site: SITE,
      sitemap: doc({
        parts: [
          {
            bytes: 100,
            file: "/dist/sitemap-1.xml",
            url: "/sitemap-1.xml",
            urls: 50_001,
          },
        ],
      }),
    });
    const finding = diagnosticsOf(over).find(
      (diagnostic) => diagnostic.code === "BLUME_AUDIT_SITEMAP_TOO_LARGE"
    );
    expect(finding?.url).toBe("/sitemap-1.xml");
    expect(finding?.message).toContain("sitemap-1.xml holds 50001 URLs");
  });
});

describe("indexable pages missing from the sitemap", () => {
  it("leaves out i18n fallback copies and pages that canonicalize elsewhere", () => {
    const ctx = context({
      pages: [
        snapshot({ canonical: `${SITE}/`, url: "/" }),
        // A fallback copy: the French URL rendering the English page.
        snapshot({
          canonical: `${SITE}/`,
          route: manifestRoute({ fallback: true, path: "/fr" }),
          url: "/fr",
        }),
        // An archived page pointing at its latest equivalent.
        snapshot({ canonical: `${SITE}/`, url: "/v1" }),
      ],
      site: SITE,
      sitemap: doc(),
    });
    expect(run(ctx)).toEqual([]);
  });

  it("still reports a self-canonical page the sitemap left out", () => {
    const ctx = context({
      pages: [
        snapshot({ canonical: `${SITE}/`, url: "/" }),
        snapshot({ canonical: `${SITE}/a`, url: "/a" }),
        snapshot({ url: "/b" }),
      ],
      site: SITE,
      sitemap: doc(),
    });
    expect(run(ctx)).toEqual([
      "INDEXABLE_PAGE_NOT_IN_SITEMAP",
      "INDEXABLE_PAGE_NOT_IN_SITEMAP",
    ]);
  });
});
