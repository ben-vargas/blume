import { afterAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { normalizeEntry } from "../src/core/sources/normalize.ts";
import { obsidianSource } from "../src/core/sources/obsidian.ts";
import type { PageLink } from "../src/core/types.ts";

const dirs: string[] = [];
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { force: true, recursive: true })));
});

/** The links of a one-note vault, as the page record reports them. */
const linksOf = async (note: string): Promise<PageLink[]> => {
  const root = await mkdtemp(join(tmpdir(), "blume-obsidian-lines-"));
  dirs.push(root);
  await writeFile(join(root, "Note.md"), note);
  const source = obsidianSource(
    { name: "vault", vault: "." },
    { cacheDir: join(root, ".cache"), mode: "build", projectRoot: root }
  );
  const { entries } = await source.load();
  const [entry] = entries;
  if (!entry) {
    throw new Error("expected the note");
  }
  const { pages } = normalizeEntry(entry, {
    defaultType: "doc",
    source: { name: source.name, staged: true },
  });
  return pages[0]?.links ?? [];
};

describe("Obsidian link line numbers", () => {
  it("count the note's own frontmatter, not the rewritten one", async () => {
    // The properties Blume drops (`tags`, `aliases`, `publish`, a Dataview
    // field) shrink the staged frontmatter; the link still sits on line 14
    // of the note the author edits.
    const note = [
      "---",
      "title: Note",
      "tags:",
      "  - one",
      "  - two",
      "aliases:",
      "  - Other",
      "publish: true",
      "rating: 5",
      "---",
      "",
      "Intro paragraph.",
      "",
      "A [broken link](/nowhere) here.",
      "",
    ].join("\n");
    const [link] = await linksOf(note);
    expect(link?.target).toBe("/nowhere");
    expect(link?.line).toBe(14);
  });

  it("count the blank lines above the body", async () => {
    const note = ["", "", "See [a page](/somewhere).", ""].join("\n");
    const [link] = await linksOf(note);
    expect(link?.line).toBe(3);
  });
});
