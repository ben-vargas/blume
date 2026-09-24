import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { discoverFolderMeta } from "../src/core/meta.ts";
import { scanProject } from "../src/core/project-graph.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const makeTree = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-meta-scope-"));
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

const meta = (title: string): string =>
  `export default { title: "${title}" };\n`;

/** Application code that happens to be named `meta.ts`. */
const APP_META = "export default { runtime: 'edge' };\n";

describe("folder meta discovery scope", () => {
  it("skips meta files under the source's excluded folders", async () => {
    const root = await makeTree({
      "guides/meta.ts": meta("Guides"),
      "src/lib/meta.ts": APP_META,
    });
    const { diagnostics, meta: found } = await discoverFolderMeta([
      { exclude: ["src/**"], include: ["**/*.{md,mdx}"], root },
    ]);
    expect(diagnostics).toStrictEqual([]);
    expect([...found.keys()]).toStrictEqual(["guides"]);
  });

  it("reads only the folders an include glob reaches, and their ancestors", async () => {
    const root = await makeTree({
      "docs/guides/meta.ts": meta("Guides"),
      "docs/meta.ts": meta("Docs"),
      "meta.ts": meta("Root"),
      "src/lib/meta.ts": APP_META,
    });
    const { diagnostics, meta: found } = await discoverFolderMeta([
      // A negated glob narrows what the source reads; it reaches nothing.
      { exclude: [], include: ["./docs/guides/**/*.md", "!src/**"], root },
    ]);
    expect(diagnostics).toStrictEqual([]);
    expect([...found.keys()].toSorted()).toStrictEqual([
      "",
      "docs",
      "docs/guides",
    ]);
  });

  it("reads every folder when an include glob's first segment is a pattern", async () => {
    const root = await makeTree({
      "notes/meta.ts": meta("Notes"),
      "src/lib/meta.ts": meta("Lib"),
    });
    const { meta: found } = await discoverFolderMeta([
      { include: ["{docs,notes}/*.mdx"], root },
    ]);
    expect([...found.keys()].toSorted()).toStrictEqual(["notes", "src/lib"]);
  });

  it("stops a project-rooted scan from importing application code", async () => {
    const root = await makeTree({
      "blume.config.ts":
        'export default { content: { root: ".", exclude: ["src/**"] } };\n',
      "guides/intro.md": "# Intro\n",
      "guides/meta.ts": meta("Handbook"),
      "src/lib/meta.ts": APP_META,
    });
    const project = await scanProject(root);
    expect(
      project.diagnostics.filter((d) => d.code.startsWith("BLUME_META"))
    ).toStrictEqual([]);
    expect(project.graph.navigation.sidebar[0]?.label).toBe("Handbook");
  });
});

describe("folder meta under a lowercase locale folder", () => {
  it("keys pt-br/ meta under the configured pt-BR code", async () => {
    const root = await makeTree({
      "guides/meta.ts": meta("Guides"),
      "pt-br/guides/meta.ts": meta("Guias"),
    });
    const { meta: found } = await discoverFolderMeta(root, {
      localeDirs: ["pt-BR"],
    });
    expect(found.get("pt-BR/guides")?.title).toBe("Guias");
    expect(found.get("guides")?.title).toBe("Guides");
  });

  it("labels the pt-BR sidebar from it", async () => {
    const root = await makeTree({
      "blume.config.ts": `export default {
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", label: "English" },
      { code: "pt-BR", label: "Português" },
    ],
  },
};
`,
      "docs/guides/intro.md": "# Intro\n",
      "docs/guides/meta.ts": meta("Guides"),
      "docs/pt-br/guides/intro.md": "# Introdução\n",
      "docs/pt-br/guides/meta.ts": meta("Guias"),
    });
    const project = await scanProject(root);
    expect(project.graph.navigationByLocale["pt-BR"]?.sidebar[0]?.label).toBe(
      "Guias"
    );
    expect(project.graph.navigationByLocale.en?.sidebar[0]?.label).toBe(
      "Guides"
    );
  });
});
