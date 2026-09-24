import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

import { buildLlmsFiles } from "../src/ai/llms.ts";
import { buildRawMarkdown } from "../src/ai/markdown.ts";
import { relativeLinkRewriter } from "../src/ai/relative-links.ts";
import { scanProject } from "../src/core/project-graph.ts";
import type { BlumeProject } from "../src/core/project-graph.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const scanFixture = async (
  files: Record<string, string>
): Promise<BlumeProject> => {
  const root = await mkdtemp(join(tmpdir(), "blume-agent-links-"));
  dirs.push(root);
  await Promise.all(
    Object.entries(files).map(async ([rel, content]) => {
      const abs = join(root, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content);
    })
  );
  return await scanProject(root);
};

const GUIDES_INDEX = [
  "---",
  "title: Guides",
  "---",
  "",
  "Start with [Install](./install), then [Setup](setup.md#config).",
  "Back [home](../index.md), or [elsewhere](https://example.com/x).",
  "![Diagram](./diagram.png) and `[shown](./install)` stay as written.",
  "",
  "```md",
  "[inside a fence](./install)",
  "```",
  "",
  "[ref]: ./install",
  "[angled]: <./setup.md>",
  "",
].join("\n");

const FILES = {
  "blume.config.ts": 'export default { deployment: { base: "/sub" } };',
  "docs/guides/index.md": GUIDES_INDEX,
  "docs/guides/install.md": "# Install\n",
  "docs/guides/leaf.md": "# Leaf\n\nSee [Install](./install).\n",
  "docs/guides/setup.md": "---\nslug: guides/configure\n---\n# Setup\n",
  "docs/index.md": "# Home\n",
};

describe("relative page links on the agent surfaces", () => {
  it("points each at the route it means in the Markdown mirrors", async () => {
    const project = await scanFixture(FILES);
    const raw = await buildRawMarkdown(project);
    const guides = raw["/guides"]?.mdx ?? "";
    // An index page's links resolve inside its folder; a `.md` link lands on
    // the route that file publishes at, its own `slug` included.
    expect(guides).toContain(
      "Start with [Install](/sub/guides/install), then [Setup](/sub/guides/configure#config)."
    );
    expect(guides).toContain(
      "Back [home](/sub), or [elsewhere](https://example.com/x)."
    );
    expect(guides).toContain(
      "![Diagram](./diagram.png) and `[shown](./install)` stay as written."
    );
    expect(guides).toContain("```md\n[inside a fence](./install)\n```");
    expect(guides).toContain("[ref]: /sub/guides/install");
    expect(guides).toContain("[angled]: </sub/guides/configure>");
    // A leaf page's links resolve against its parent folder.
    expect(raw["/guides/leaf"]?.mdx).toContain(
      "See [Install](/sub/guides/install)."
    );
  });

  it("rewrites them in llms-full.txt", async () => {
    const project = await scanFixture(FILES);
    const { full } = await buildLlmsFiles(project);
    expect(full).toContain("Start with [Install](/sub/guides/install)");
    expect(full).toContain("See [Install](/sub/guides/install).");
  });

  it("leaves a page with no source file as written", async () => {
    const project = await scanFixture(FILES);
    const rewrite = relativeLinkRewriter(project);
    expect(rewrite("[Install](./install)", { route: "/remote" })).toBe(
      "[Install](./install)"
    );
  });
});
