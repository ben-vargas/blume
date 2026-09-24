import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { cutVersion } from "../src/core/version-cut.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const makeProject = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-snapshot-links-"));
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

const config = (hideDefaultLocalePrefix: boolean): string => `export default {
  i18n: {
    defaultLocale: "en",
    hideDefaultLocalePrefix: ${hideDefaultLocalePrefix},
    locales: [
      { code: "en", label: "English" },
      { code: "fr", label: "Français" },
    ],
  },
  versions: { archived: [], current: { label: "v2.0" } },
};
`;

const LINKS = "[Setup](/guides/setup) [Home](/) [Only fr](/guides/fr-only)";

const cut = async (hideDefaultLocalePrefix: boolean) => {
  const root = await makeProject({
    "blume.config.ts": config(hideDefaultLocalePrefix),
    "docs/fr/guides/fr-only.mdx": "---\ntitle: FR\n---\n# FR\n",
    "docs/fr/guides/setup.mdx": `---\ntitle: Setup fr\n---\n# Setup\n\n${LINKS}\n`,
    "docs/guides/setup.mdx": `---\ntitle: Setup\n---\n# Setup\n\n${LINKS} [En](/en/guides/setup)\n`,
    "docs/index.mdx": "---\ntitle: Home\n---\n# Home\n",
  });
  await cutVersion(root, "v1.0");
  const read = (rel: string) => readFile(join(root, rel), "utf-8");
  return {
    english: await read("docs/v1.0/guides/setup.mdx"),
    french: await read("docs/v1.0/fr/guides/setup.mdx"),
  };
};

describe("snapshot links under i18n", () => {
  it("rewrites the unprefixed link form when the default locale shows its prefix", async () => {
    const { english, french } = await cut(false);
    // The unprefixed form maps to the unprefixed snapshot route, which
    // rendering moves into the reader's locale; an explicit `/en/…` link
    // keeps its prefix.
    expect(english).toContain(
      "[Setup](/v1.0/guides/setup) [Home](/v1.0) [Only fr](/v1.0/guides/fr-only) [En](/en/v1.0/guides/setup)"
    );
    expect(french).toContain(
      "[Setup](/v1.0/guides/setup) [Home](/v1.0) [Only fr](/v1.0/guides/fr-only)"
    );
  });

  it("rewrites the same links under a hidden default prefix, a French-only page included", async () => {
    const { english } = await cut(true);
    expect(english).toContain(
      "[Setup](/v1.0/guides/setup) [Home](/v1.0) [Only fr](/v1.0/guides/fr-only)"
    );
  });
});
