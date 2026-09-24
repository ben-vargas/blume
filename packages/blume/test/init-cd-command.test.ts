import { afterAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { cdCommand, nextSteps } from "../src/cli/init/scaffold.ts";
import type { InitAnswers } from "../src/cli/init/scaffold.ts";

/**
 * The `cd` line `init` prints into its next steps (and its install-retry
 * hint) must survive being pasted into a shell: a directory with a space or a
 * shell metacharacter is quoted.
 */

describe("cdCommand", () => {
  it("leaves a plain path bare", () => {
    expect(cdCommand("docs")).toBe("cd docs");
    expect(cdCommand("apps/my-docs_v2.0")).toBe("cd apps/my-docs_v2.0");
    expect(cdCommand("C:/sites/docs")).toBe("cd C:/sites/docs");
  });

  it("quotes a path a shell would split or expand", () => {
    expect(cdCommand("my docs")).toBe('cd "my docs"');
    expect(cdCommand("apps\\docs")).toBe(String.raw`cd "apps\\docs"`);
    expect(cdCommand('say "hi" $HOME `x`')).toBe(
      String.raw`cd "say \"hi\" \$HOME \`x\`"`
    );
  });
});

describe("nextSteps", () => {
  it("quotes the directory in its cd line", () => {
    const answers: InitAnswers = {
      contentDir: "docs",
      directory: "my docs",
      packageManager: "npm",
      sources: ["filesystem"],
      template: "docs",
      title: "My Docs",
    };
    expect(nextSteps(answers, true)).toBe(
      'Next steps:\n\n  cd "my docs"\n  npm install\n  npm run dev\n'
    );
  });
});

describe("blume init into a directory with a space", () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(
      dirs.map((dir) => rm(dir, { force: true, recursive: true }))
    );
  });

  it("prints a cd line that pastes into a shell", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "blume-init-cd-"));
    dirs.push(cwd);
    const env = { ...process.env };
    // `bun test` sets NODE_ENV=test, which lowers consola's log level.
    delete env.NODE_ENV;
    const proc = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "..", "src", "cli", "index.ts"),
        "init",
        "my docs",
        "--yes",
        "--no-install",
        "--package-manager",
        "npm",
      ],
      { cwd, env, stderr: "pipe", stdout: "pipe" }
    );
    const [exitCode, stdout] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('cd "my docs"');
    expect(stdout).not.toContain("cd my docs");
  });
});
