import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { mountBasePath } from "../src/core/base-path.ts";
import { discoverContent } from "../src/core/content.ts";
import { buildContentGraph } from "../src/core/graph.ts";
import { buildManifest } from "../src/core/manifest.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { BlumeConfigInput } from "../src/core/schema.ts";
import { resolveDocsCollection } from "../src/core/sources/collection.ts";
import type { ProjectContext } from "../src/core/types.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const scan = async (input: BlumeConfigInput, files: string[]) => {
  const config = blumeConfigSchema.parse(input);
  const root = await mkdtemp(join(tmpdir(), "blume-base-routes-"));
  dirs.push(root);
  const contentRoot = join(root, "docs");
  await Promise.all(
    files.map(async (rel) => {
      const abs = join(contentRoot, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, `---\ntitle: ${rel}\n---\n# ${rel}\n`);
    })
  );
  const collection = resolveDocsCollection(config, contentRoot);
  const { pages } = await discoverContent({
    basePath: config.basePath,
    contentRoot,
    defaultType: config.content.defaultType,
    exclude: collection.exclude,
    i18n: config.i18n,
    include: collection.include,
  });
  const graph = buildContentGraph(pages, {
    basePath: config.basePath,
    folderMeta: new Map(),
    i18n: config.i18n,
    navigation: config.navigation,
  });
  // SAFETY: buildManifest reads only contentRoot and root from the context.
  const context = { contentRoot, root } as ProjectContext;
  return { graph, manifest: buildManifest({ config, context, graph }) };
};

describe(mountBasePath, () => {
  it("prepends the base even to a route that already starts with it", () => {
    expect(mountBasePath("/docs", "/docs/guide")).toBe("/docs/docs/guide");
    expect(mountBasePath("/docs", "/guide")).toBe("/docs/guide");
    expect(mountBasePath("/docs", "/")).toBe("/docs");
    expect(mountBasePath("", "/docs/guide")).toBe("/docs/guide");
  });
});

describe("content routes under a basePath", () => {
  it("publishes a folder named like the base beneath it, not on top of the root pages", async () => {
    const { graph } = await scan({ basePath: "/docs" }, [
      "docs/guide.md",
      "docs/index.md",
      "docs/intro.md",
      "guide.md",
      "index.md",
      "intro.md",
    ]);
    expect(graph.pages.map((page) => page.route).toSorted()).toStrictEqual([
      "/docs",
      "/docs/docs",
      "/docs/docs/guide",
      "/docs/docs/intro",
      "/docs/guide",
      "/docs/intro",
    ]);
    expect(
      graph.diagnostics.filter((d) => d.code === "BLUME_DUPLICATE_ROUTE")
    ).toStrictEqual([]);
  });

  it("mounts fallback copies the same way in navigation and the manifest", async () => {
    const { graph, manifest } = await scan(
      {
        basePath: "/docs",
        i18n: {
          defaultLocale: "en",
          fallbackLocale: "fr",
          locales: [
            { code: "en", label: "English" },
            { code: "fr", label: "Français" },
          ],
        },
      },
      ["fr/docs/guide.md"]
    );
    // The French page lives at /docs/fr/docs/guide; its English fallback copy
    // sits in the hidden default locale, where the logical `/docs/guide`
    // still gets the base in front of it.
    const english = graph.navigationByLocale.en?.sidebar[0];
    const child = english?.kind === "group" ? english.children[0] : undefined;
    expect(child?.route).toBe("/docs/docs/guide");
    expect(manifest.routes.map((route) => route.path).toSorted()).toStrictEqual(
      ["/docs/docs/guide", "/docs/fr/docs/guide"]
    );
  });
});
