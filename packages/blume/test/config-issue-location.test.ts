import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { ConfigValidationError, loadConfig } from "../src/core/config.ts";
import {
  diagnosticsFromIssues,
  locateFrontmatterKey,
} from "../src/core/diagnostics.ts";

/** The 1-based line/column `path` resolves to in `source`, as `line:column`. */
const locate = (
  source: string,
  path: (string | number)[]
): string | undefined => {
  const [diagnostic] = diagnosticsFromIssues([{ message: "x", path }], {
    code: "BLUME_TEST",
    source,
  });
  return diagnostic?.line === undefined
    ? undefined
    : `${diagnostic.line}:${diagnostic.column}`;
};

const REDIRECTS = `export default {
  redirects: [
    { from: "/a", to: "/b", status: 301 },
    { from: "/c", to: "/d", status: 302 },
    { from: "/e", to: "/f", status: 303 },
  ],
  github: { owner: "acme" },
  navigation: { repo: true },
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", label: "English" },
      { code: "ja" },
    ],
  },
};
`;

describe("config issue locations", () => {
  it("follows an array index to its own element", () => {
    expect(locate(REDIRECTS, ["redirects", 2, "status"])).toBe("5:29");
    expect(locate(REDIRECTS, ["redirects", 0])).toBe("3:5");
  });

  it("stops a missing key at its parent instead of a later namesake", () => {
    // `navigation.repo` follows, but `github` holds no `repo`.
    expect(locate(REDIRECTS, ["github", "repo"])).toBe("7:3");
  });

  it("stops a key missing from an element at that element", () => {
    expect(locate(REDIRECTS, ["i18n", "locales", 1, "label"])).toBe("13:7");
  });

  it("stops at the parent when an index or key doesn't fit its value", () => {
    // Past the last element (the trailing comma opens no element).
    expect(locate(REDIRECTS, ["redirects", 3])).toBe("2:3");
    // A key can't be read off an array, nor an index off an object.
    expect(locate(REDIRECTS, ["redirects", "from"])).toBe("2:3");
    expect(locate(REDIRECTS, ["github", 0])).toBe("7:3");
    // A scalar has no children at all.
    expect(locate(REDIRECTS, ["i18n", "defaultLocale", "x"])).toBe("10:5");
  });

  it("reads through an adapter call to its options", () => {
    const source = `import { vercel } from "blume/deploy";

export default defineConfig({
  title: "Docs",
  deployment: vercel({
    output: "server",
    site: "localhost:4321",
  }),
});
`;
    expect(locate(source, ["deployment", "site"])).toBe("7:5");
  });

  it("skips commas and brackets inside strings and comments", () => {
    const source = `export default {
  items: [
    // a, [b
    "c, d", 'e]', \`f,
g\`, /* { , */ "h\\", i",
    { key: 1 },
  ],
  headers: { "Cache-Control": "x", 'X-Other': "y" },
};
`;
    expect(locate(source, ["items", 4, "key"])).toBe("6:7");
    expect(locate(source, ["headers", "X-Other"])).toBe("8:36");
    expect(locate(source, ["headers", "Cache-Control"])).toBe("8:14");
  });

  it("tolerates a literal or string that never closes", () => {
    expect(locate("title: { a: 1", ["title", "b"])).toBe("1:1");
    // An unclosed quote is plain text, so its comma still splits elements.
    expect(locate('items: [ "a, b', ["items", 1])).toBe("1:14");
  });

  it("orders loaded config issues by the lines that set them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "blume-issue-location-"));
    try {
      await writeFile(join(dir, "blume.config.ts"), REDIRECTS);
      const result = await loadConfig(dir).catch((error: Error) => error);
      expect(result).toBeInstanceOf(ConfigValidationError);
      // SAFETY: narrowed by the instanceof assertion above.
      const { issues } = result as ConfigValidationError;
      expect(
        issues.map((issue) => [issue.schemaPath, issue.line, issue.column])
      ).toEqual([
        ["redirects.2.status", 5, 29],
        ["github.repo", 7, 3],
        ["i18n.locales.1.label", 13, 7],
      ]);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});

/** A content file whose front matter block is `body`. */
const frontmatter = (body: string) => `---\n${body}\n---\n\n# Page\n`;

describe("front matter issue locations", () => {
  it("keeps a missing nested key inside its parent's indented lines", () => {
    // A top-level `description` follows, but `seo` holds none.
    const source = frontmatter("seo:\n  title: A\n\ndescription: B");
    expect(locateFrontmatterKey(source, ["seo", "description"])).toEqual({
      column: 1,
      line: 2,
    });
    expect(locateFrontmatterKey(source, ["seo", "title"])).toEqual({
      column: 3,
      line: 3,
    });
  });

  it("stops at a sequence, whose items have no brackets to count", () => {
    const source = frontmatter("tags:\n  - a\n  - b");
    expect(locateFrontmatterKey(source, ["tags", 1])).toEqual({
      column: 1,
      line: 2,
    });
  });

  it("stops at a scalar on the last line", () => {
    expect(locateFrontmatterKey(frontmatter("seo: x"), ["seo", "a"])).toEqual({
      column: 1,
      line: 2,
    });
  });

  it("reads flow collections with URLs and apostrophes as plain text", () => {
    const source = frontmatter(
      "links: [https://a.dev, { x: 1 }]\nseo: { title: It's here, image: 5 }"
    );
    expect(locateFrontmatterKey(source, ["links", 1, "x"])).toEqual({
      column: 26,
      line: 2,
    });
    expect(locateFrontmatterKey(source, ["seo", "image"])).toEqual({
      column: 26,
      line: 3,
    });
  });
});
