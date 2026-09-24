import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { checkMeta } from "../src/audit/catalog.ts";
import { llmsChecks } from "../src/audit/checks/llms.ts";
import type { AuditContext } from "../src/audit/types.ts";
import { scanProject } from "../src/core/project-graph.ts";
import type { Diagnostic } from "../src/core/types.ts";
import { codes, context, manifestRoute, snapshot } from "./audit-support.ts";

/**
 * `ai: { exclude: true }` keeps a page out of llms.txt, and so do i18n
 * fallback copies — the audit must not then report them as missing from it.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const SITE = "https://x.dev";

// SAFETY: the llms.txt checks run synchronously.
const run = (ctx: AuditContext): string[] =>
  codes(llmsChecks.run(ctx) as Diagnostic[]);

describe("the manifest's ai.exclude flag", () => {
  it("marks exactly the routes whose front matter sets ai.exclude", async () => {
    const root = await mkdtemp(join(tmpdir(), "blume-llms-exclude-"));
    dirs.push(root);
    const files = {
      "blume.config.ts": 'export default { title: "Test" };\n',
      "docs/index.mdx": "---\ntitle: Home\n---\n# Home\n",
      "docs/secret.mdx":
        "---\ntitle: Secret\nai:\n  exclude: true\n---\n# Secret\n",
    };
    await Promise.all(
      Object.entries(files).map(async ([rel, content]) => {
        const abs = join(root, rel);
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, content);
      })
    );

    const project = await scanProject(root, { mode: "build" });
    const flags = Object.fromEntries(
      project.manifest.routes.map((route) => [route.path, route.aiExclude])
    );
    expect(flags).toEqual({ "/": false, "/secret": true });
  });
});

describe("pages missing from llms.txt", () => {
  const llms = {
    entries: [{ line: 3, url: `${SITE}/` }],
    file: "/dist/llms.txt",
  };

  it("skips ai.exclude pages and i18n fallback copies", () => {
    const ctx = context({
      llms,
      pages: [
        snapshot({ route: manifestRoute({ path: "/" }), url: "/" }),
        snapshot({
          route: manifestRoute({ aiExclude: true, path: "/secret" }),
          url: "/secret",
        }),
        snapshot({
          route: manifestRoute({ fallback: true, path: "/fr/guide" }),
          url: "/fr/guide",
        }),
      ],
      site: SITE,
    });
    expect(run(ctx)).toEqual([]);
  });

  it("still reports an unlisted page that isn't excluded", () => {
    const ctx = context({
      llms,
      pages: [
        snapshot({ route: manifestRoute({ path: "/" }), url: "/" }),
        snapshot({ route: manifestRoute({ path: "/guide" }), url: "/guide" }),
      ],
      site: SITE,
    });
    expect(run(ctx)).toEqual(["LLMS_TXT_PAGE_MISSING"]);
  });

  it("points the fix at ai.exclude, the switch that excludes a page", () => {
    expect(checkMeta("BLUME_AUDIT_LLMS_TXT_PAGE_MISSING").fix).toContain(
      "`ai.exclude: true`"
    );
  });
});
