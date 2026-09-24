import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import {
  emptyLedger,
  hashSource,
  pruneLedger,
  stampLedger,
} from "../src/translate/ledger.ts";
import { discoverTranslatableMeta } from "../src/translate/meta.ts";
import {
  computeWorkList,
  scanForTranslation,
} from "../src/translate/work-list.ts";
import type { MetaWorkItem, WorkItem } from "../src/translate/work-list.ts";

/**
 * What a translation run covers: archived-version snapshots are frozen (their
 * folder meta included), and drafts are content like any other — a draft
 * translation is still a translation, and a draft source still has one.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const fixture = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-translate-scope-"));
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

const config = (versions: string) => `export default {
  title: "Test",
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", label: "English" },
      { code: "fr", label: "French" },
    ],
  },${versions}
};
`;

const metaItems = (items: WorkItem[]): MetaWorkItem[] =>
  items.filter((item): item is MetaWorkItem => item.kind === "meta");

describe("archived-version folder meta", () => {
  it("is never translated, like the snapshot's pages", async () => {
    const root = await fixture({
      "blume.config.ts": config(`
  versions: {
    archived: [{ id: "v1" }],
    current: { label: "v2" },
  },`),
      "docs/guides/install.mdx": "---\ntitle: Install\n---\n# Install\n",
      "docs/guides/meta.ts": 'export default { title: "Guides" };\n',
      "docs/index.mdx": "---\ntitle: Home\n---\n# Home\n",
      // `blume version v1` copies the tree, meta included.
      "docs/v1/guides/install.mdx": "---\ntitle: Install\n---\n# Install\n",
      "docs/v1/guides/meta.ts": 'export default { title: "Guides" };\n',
      "docs/v1/index.mdx": "---\ntitle: Home\n---\n# Home\n",
    });
    const project = await scanForTranslation(root);

    const { metas } = await discoverTranslatableMeta(project);
    expect(metas.map((meta) => meta.sourceRel)).toEqual([
      "docs/guides/meta.ts",
    ]);

    const workList = await computeWorkList(project, emptyLedger());
    expect(
      metaItems(workList.items).flatMap((item) =>
        item.entries.map((entry) => entry.targetPath)
      )
    ).toEqual([join(root, "docs/fr/guides/meta.ts")]);
  });
});

describe("drafts", () => {
  const SOURCE = "---\ntitle: Install\n---\n# Install\n";

  it("adopts a hand-written translation marked draft instead of overwriting it", async () => {
    const root = await fixture({
      "blume.config.ts": config(""),
      "docs/fr/install.mdx":
        "---\ntitle: Installation\ndraft: true\n---\n# Installation\n",
      "docs/index.mdx": "---\ntitle: Home\n---\n# Home\n",
      "docs/install.mdx": SOURCE,
    });
    const workList = await computeWorkList(
      await scanForTranslation(root),
      emptyLedger()
    );
    expect(
      workList.items.some(
        (item) => item.kind === "page" && item.sourceRel === "docs/install.mdx"
      )
    ).toBe(false);
    expect(workList.untracked).toContainEqual({
      hash: hashSource(SOURCE),
      kind: "page",
      locale: "fr",
      sourceRel: "docs/install.mdx",
    });
  });

  it("keeps a draft source's stamps, so its outdated translations stay stale", async () => {
    const root = await fixture({
      "blume.config.ts": config(""),
      "docs/fr/install.mdx": "---\ntitle: Installation\n---\n# Installation\n",
      "docs/index.mdx": "---\ntitle: Home\n---\n# Home\n",
      "docs/install.mdx": `---\ntitle: Install\ndraft: true\n---\n# Install\n\nEdited.\n`,
    });
    const ledger = emptyLedger();
    stampLedger(ledger, "docs/install.mdx", "fr", hashSource(SOURCE));

    const workList = await computeWorkList(
      await scanForTranslation(root),
      ledger
    );
    expect(workList.knownSources.has("docs/install.mdx")).toBe(true);
    expect(
      pruneLedger(ledger, workList.knownSources, new Set(["fr"])).files[
        "docs/install.mdx"
      ]
    ).toEqual({ fr: hashSource(SOURCE) });
    expect(
      workList.items.flatMap((item) =>
        item.kind === "page" ? [[item.sourceRel, item.status]] : []
      )
    ).toContainEqual(["docs/install.mdx", "stale"]);
  });
});
