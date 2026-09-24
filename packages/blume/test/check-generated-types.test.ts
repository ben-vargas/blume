import { afterAll, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";

import { dirname, join } from "pathe";

import { packageRoot } from "../src/core/package-root.ts";

/**
 * `blume check` against a project with no tsconfig of its own. Astro then
 * type-checks the generated `.blume` project under its strict tsconfig — every
 * generated page, route, and module — where a project that brings its own
 * tsconfig (like the docs site) usually excludes them. A template that only
 * type-checks loosely (a widened `Intl.DateTimeFormatOptions` literal, a
 * property read off an un-narrowed union) fails here and nowhere else.
 */

const PACKAGE_ROOT = packageRoot();
const CLI = join(PACKAGE_ROOT, "src", "cli", "index.ts");
const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { force: true, recursive: true }))
  );
});

// A local font for every role, so the check never reaches Google Fonts.
const LOCAL_FONT = join(
  PACKAGE_ROOT,
  "node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2"
);
const localFont = { name: "Probe", variants: [{ src: LOCAL_FONT }] };

const SPEC = `openapi: 3.1.0
info:
  title: Probe API
  version: 1.0.0
paths:
  /items/{id}:
    get:
      operationId: getItem
      summary: Get an item
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The item.
`;

// Each file turns on a generated template: the changelog index, the sidebar
// fragments of a drill-in group, the Mermaid loader, an OpenAPI reference,
// the assistant and Mixedbread search routes (server output), and
// `components.ts` / `islands/` hydration wrappers.
const FILES = {
  "blume.config.ts": `import { defineConfig } from "blume";
import { node } from "blume/deploy";
import { openapi } from "blume/reference";
import { mixedbread } from "blume/search";

export default defineConfig({
  ai: { assistant: { enabled: true } },
  deployment: node({ site: "https://docs.example.com" }),
  reference: [openapi({ route: "/api", spec: "./openapi.yaml" })],
  search: mixedbread({ storeId: "docs" }),
  theme: { fonts: ${JSON.stringify({ body: localFont, display: localFont, mono: localFont })} },
  title: "Check probe",
});
`,
  "components.ts": `import { defineComponents } from "blume";
import Clicker from "./components/Clicker.tsx";
import Note from "./components/Note.astro";

export default defineComponents({
  mdx: { Clicker: { client: "visible", component: Clicker }, Note },
});
`,
  "components/Clicker.tsx": `export default function Clicker() {
  return <button type="button">Click</button>;
}
`,
  "components/Note.astro": "<aside><slot /></aside>\n",
  "docs/changelog/v1.mdx":
    "---\ntitle: v1.0.0\ntype: changelog\ndate: 2026-01-15\n---\n\nFirst release.\n",
  "docs/changelog/v2.mdx":
    "---\ntitle: v2.0.0\ntype: changelog\ndate: 2026-09-20\n---\n\nSecond release.\n",
  "docs/guides/index.mdx":
    "---\ntitle: Guides\nsidebar:\n  display: page\n---\n\nGuides.\n",
  "docs/guides/setup.mdx": "---\ntitle: Setup\n---\n\nSet it up.\n",
  "docs/index.mdx": `---
title: Home
---

<Note>Hello.</Note>

<Clicker />

\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`,
  "islands/Counter.tsx": `export default function Counter() {
  return <span>0</span>;
}
`,
  "openapi.yaml": SPEC,
} satisfies Record<string, string>;

it("type-checks every generated file of a project with no tsconfig", async () => {
  // Inside the package, so the fixture resolves React and the SDKs from
  // Blume's own node_modules the way an installed project would.
  const root = await mkdtemp(join(PACKAGE_ROOT, "blume-integrations-check-"));
  roots.push(root);
  await Promise.all(
    Object.entries(FILES).map(async ([relativePath, content]) => {
      const path = join(root, relativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf-8");
    })
  );
  await mkdir(join(root, "node_modules"), { recursive: true });
  await symlink(PACKAGE_ROOT, join(root, "node_modules/blume"), "junction");

  const env = { ...process.env };
  // `bun test` exports NODE_ENV=test, which quiets consola's output.
  delete env.NODE_ENV;
  const proc = Bun.spawn(["bun", CLI, "check"], {
    cwd: root,
    env,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  // Astro colors its diagnostics whatever NO_COLOR says.
  const output = stripVTControlCharacters(`${stdout}${stderr}`);

  // Named in the failure so a regression shows the file and TS code at once.
  expect(output).not.toMatch(/ - (?:error|warning) ts\(/u);
  expect(exitCode).toBe(0);
  expect(output).toContain("No type errors.");
}, 180_000);
