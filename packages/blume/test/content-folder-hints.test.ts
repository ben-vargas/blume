import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { BlumeError } from "../src/core/diagnostics.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import { filesystemSource } from "../src/core/sources/filesystem.ts";
import type { PageRecord } from "../src/core/types.ts";
import { versionsDiagnostics } from "../src/core/versions.ts";

// SAFETY: the version diagnostic reads only `source.ref` from a page record.
const pageWithRef = (ref: string): PageRecord =>
  ({ source: { name: "filesystem", ref } }) as PageRecord;

describe("the unconfigured-version warning", () => {
  const { versions } = blumeConfigSchema.parse({
    versions: { archived: [{ id: "v1.0" }], current: { label: "v2.0" } },
  });
  if (!versions) {
    throw new Error("expected versions");
  }

  it("ignores a root file whose name looks like a version", () => {
    expect(
      versionsDiagnostics(
        [pageWithRef("v3-migration.md"), pageWithRef("v2.md")],
        versions
      )
    ).toStrictEqual([]);
  });

  it("still flags a version-shaped folder", () => {
    expect(
      versionsDiagnostics([pageWithRef("v3/guide.md")], versions).map(
        (diagnostic) => diagnostic.code
      )
    ).toStrictEqual(["BLUME_VERSIONS_UNCONFIGURED_VERSION"]);
  });
});

describe("the missing content root hint", () => {
  it("names both places a root can be set", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "blume-root-hint-"));
    try {
      const source = filesystemSource({
        exclude: [],
        include: ["**/*.md"],
        name: "filesystem",
        projectRoot,
        root: "content",
      });
      let caught: BlumeError | undefined;
      try {
        source.validate?.();
      } catch (error) {
        caught = error instanceof BlumeError ? error : undefined;
      }
      expect(caught?.diagnostic.suggestion).toBe(
        `Create a "content" folder with at least one .md or .mdx file, or point Blume at your docs folder: content.root in blume.config.ts, or the filesystem() source's root when you list content.sources.`
      );
    } finally {
      await rm(projectRoot, { force: true, recursive: true });
    }
  });
});
