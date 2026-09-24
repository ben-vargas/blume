import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { dirname, join } from "pathe";

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const makeProject = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-doctor-command-"));
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

const doctor = async (
  root: string,
  ...args: string[]
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  const proc = Bun.spawn([process.execPath, CLI, "doctor", ...args], {
    cwd: root,
    env: { ...process.env, CONSOLA_LEVEL: "3" },
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    proc.exited,
    new Response(proc.stderr).text(),
    new Response(proc.stdout).text(),
  ]);
  return { exitCode, stderr, stdout };
};

const HOME = { "docs/index.mdx": "---\ntitle: Home\n---\n# Home\n" };

describe("blume doctor", () => {
  it("reports no problems for a healthy project", async () => {
    const root = await makeProject(HOME);
    const { exitCode, stderr, stdout } = await doctor(root);
    expect(exitCode).toBe(0);
    expect(`${stdout}${stderr}`).toContain("No problems found.");
  });

  it("plans components.ts and reports an override it can't plan, with its line", async () => {
    const root = await makeProject({
      ...HOME,
      "components.ts": `import Callout from "./components/Callout.astro";

export default {
  mdx: { Callout },
};
`,
    });
    const { exitCode, stderr } = await doctor(root);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("BLUME_COMPONENTS_INVALID");
    expect(stderr).toContain("components.ts:");
    expect(stderr).not.toContain("No problems found.");
  });

  it("includes components.ts issues in --json", async () => {
    const root = await makeProject({
      ...HOME,
      "components.ts": "export default { mdx: { Callout: () => null } };\n",
    });
    const { exitCode, stdout } = await doctor(root, "--json");
    expect(exitCode).toBe(1);
    const report = JSON.parse(stdout);
    expect(
      report.diagnostics.map((diagnostic: { code: string }) => diagnostic.code)
    ).toContain("BLUME_COMPONENTS_INVALID");
  });

  it("warns about a version-shaped folder when versioning isn't configured", async () => {
    const root = await makeProject({
      ...HOME,
      "docs/v1.0/index.mdx": "---\ntitle: Old\n---\n# Old\n",
    });
    const { exitCode, stderr } = await doctor(root);
    expect(exitCode).toBe(0);
    expect(stderr).toContain("BLUME_VERSIONS_UNCONFIGURED_VERSION");
    expect(stderr).toContain('Folder "v1.0/" looks like a version snapshot');
  });
});
