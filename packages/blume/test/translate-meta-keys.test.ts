import { afterAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import type { BlumeProject } from "../src/core/project-graph.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { HeadlessOptions, HeadlessResult } from "../src/eval/agents.ts";
import { emptyLedger } from "../src/translate/ledger.ts";
import type { TranslatableMeta } from "../src/translate/meta.ts";
import { runTranslate } from "../src/translate/run.ts";
import type { MetaWorkItem } from "../src/translate/work-list.ts";

/**
 * Folder titles from two filesystem sources can share a folder name. Each
 * meta file keeps its own key in the batched prompt, so each gets its own
 * translation.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const project = (root: string): BlumeProject =>
  // SAFETY: runTranslate reads only config.i18n and context.root.
  ({
    config: blumeConfigSchema.parse({
      i18n: {
        defaultLocale: "en",
        locales: [
          { code: "en", label: "English" },
          { code: "fr", label: "French" },
        ],
      },
      title: "Test",
    }),
    context: { root },
  }) as BlumeProject;

const metaIn = (
  root: string,
  source: string,
  title: string
): TranslatableMeta => ({
  contentRoot: join(root, source),
  data: { title },
  dir: "guides",
  file: join(root, source, "guides/meta.ts"),
  raw: `export default { title: ${JSON.stringify(title)} };\n`,
  sourceRel: `${source}/guides/meta.ts`,
  title,
});

describe("meta titles from two sources with the same folder", () => {
  it("keys each by its own directory and writes each its own title", async () => {
    const root = await mkdtemp(join(tmpdir(), "blume-translate-meta-keys-"));
    dirs.push(root);
    const metas = [
      metaIn(root, "docs", "Guides"),
      metaIn(root, "api", "API guides"),
    ];
    const item: MetaWorkItem = {
      entries: metas.map((meta) => ({
        meta,
        status: "missing",
        targetPath: join(meta.contentRoot, "fr", meta.dir, "meta.ts"),
      })),
      kind: "meta",
      locale: "fr",
    };
    const prompts: string[] = [];
    const run = (
      _bin: string,
      _args: string[],
      options: HeadlessOptions
    ): Promise<HeadlessResult> => {
      prompts.push(options.prompt);
      return Promise.resolve({
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          is_error: false,
          result: JSON.stringify({
            "api/guides": "Guides de l'API",
            "docs/guides": "Guides",
          }),
        }),
        timedOut: false,
      });
    };

    const result = await runTranslate({
      agent: "claude",
      ledger: emptyLedger(),
      project: project(root),
      run,
      workList: {
        diagnostics: [],
        items: [item],
        knownSources: new Set(),
        targetLocales: ["fr"],
        untracked: [],
        upToDate: 0,
      },
    });

    expect(result.counts.translated).toBe(1);
    expect(prompts[0]).toContain('"docs/guides": "Guides"');
    expect(prompts[0]).toContain('"api/guides": "API guides"');
    expect(
      await readFile(join(root, "api/fr/guides/meta.ts"), "utf-8")
    ).toContain('title: "Guides de l\'API"');
    expect(
      await readFile(join(root, "docs/fr/guides/meta.ts"), "utf-8")
    ).toContain('title: "Guides"');
  });
});
