import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { discoverContent } from "../src/core/content.ts";
import { buildContentGraph } from "../src/core/graph.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { BlumeConfigInput } from "../src/core/schema.ts";
import { resolveDocsCollection } from "../src/core/sources/collection.ts";

/**
 * The banner link (`banner.link.href`) is authored like a featured link — as
 * if the site were mounted at root, in the default locale's path space — so
 * the navigation carries it localized and mounted under `basePath`, which is
 * what Banner.astro renders.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const FILES = {
  "docs/fr/getting-started.mdx": "---\ntitle: Démarrer\n---\n# Démarrer\n",
  "docs/fr/index.mdx": "---\ntitle: Accueil\n---\n# Accueil\n",
  "docs/getting-started.mdx": "---\ntitle: Get started\n---\n# Get started\n",
  "docs/index.mdx": "---\ntitle: Home\n---\n# Home\n",
  "docs/only-en.mdx": "---\ntitle: Only EN\n---\n# Only EN\n",
};

const graphFor = async (
  input: BlumeConfigInput,
  options: { bannerHref?: string; extraRoutes?: ReadonlySet<string> }
) => {
  const resolved = blumeConfigSchema.parse(input);
  const root = await mkdtemp(join(tmpdir(), "blume-banner-link-"));
  dirs.push(root);
  await Promise.all(
    Object.entries(FILES).map(async ([rel, content]) => {
      const abs = join(root, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content);
    })
  );
  const contentRoot = join(root, "docs");
  const collection = resolveDocsCollection(resolved, contentRoot);
  const { pages } = await discoverContent({
    basePath: resolved.basePath,
    contentRoot,
    defaultType: resolved.content.defaultType,
    exclude: collection.exclude,
    i18n: resolved.i18n,
    include: collection.include,
  });
  return buildContentGraph(pages, {
    ...options,
    basePath: resolved.basePath,
    folderMeta: new Map(),
    i18n: resolved.i18n,
    navigation: resolved.navigation,
  });
};

const I18N = {
  defaultLocale: "en",
  locales: [
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
  ],
};

describe("banner link", () => {
  it("mounts the link under basePath on a single-locale site", async () => {
    const graph = await graphFor(
      { basePath: "/docs" },
      { bannerHref: "/getting-started" }
    );
    expect(graph.navigation.bannerHref).toBe("/docs/getting-started");
  });

  it("keeps a route served outside the content tree at its own path", async () => {
    // The generated changelog index and custom pages answer outside
    // `basePath`, so a banner pointing at one must not be moved under it.
    const graph = await graphFor(
      { basePath: "/docs" },
      { bannerHref: "/changelog", extraRoutes: new Set(["/changelog"]) }
    );
    expect(graph.navigation.bannerHref).toBe("/changelog");
  });

  it("passes an external link through and leaves a linkless banner alone", async () => {
    const external = await graphFor(
      { basePath: "/docs" },
      { bannerHref: "https://example.com/launch" }
    );
    expect(external.navigation.bannerHref).toBe("https://example.com/launch");
    const none = await graphFor({ basePath: "/docs" }, {});
    expect(none.navigation.bannerHref).toBeUndefined();
    expect(Object.hasOwn(none.navigation, "bannerHref")).toBe(false);
  });

  it("localizes the link per locale, then mounts it under basePath", async () => {
    const graph = await graphFor(
      { basePath: "/docs", i18n: I18N },
      { bannerHref: "/getting-started" }
    );
    expect(graph.navigationByLocale.en?.bannerHref).toBe(
      "/docs/getting-started"
    );
    // The locale segment sits inside the base, like every localized route.
    expect(graph.navigationByLocale.fr?.bannerHref).toBe(
      "/docs/fr/getting-started"
    );
    // The default-locale tree is the site's `navigation`.
    expect(graph.navigation.bannerHref).toBe("/docs/getting-started");
  });

  it("keeps a route only the default locale serves on its own path", async () => {
    // `/cli` is a custom page: it exists only at its own route, so French
    // readers are not sent to a `/fr/cli` that 404s.
    const graph = await graphFor(
      { basePath: "/docs", i18n: I18N },
      { bannerHref: "/cli", extraRoutes: new Set(["/cli"]) }
    );
    expect(graph.navigationByLocale.fr?.bannerHref).toBe("/cli");
    const linkless = await graphFor({ i18n: I18N }, {});
    expect(
      Object.hasOwn(linkless.navigationByLocale.fr ?? {}, "bannerHref")
    ).toBe(false);
  });
});
