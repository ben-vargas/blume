import { afterAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { readAgentOutput, runAgentHeadless } from "../src/eval/agents.ts";
import { writeExecutable } from "./process-fixture.ts";

/**
 * An agent CLI that exits before reading its prompt — it rejected a flag, an
 * outdated version — closes stdin while Blume is still writing to it. That
 * EPIPE must surface as the agent's own failure, not crash the whole run.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

describe("an agent that exits before reading its prompt", () => {
  it("reports the agent's exit code and stderr", async () => {
    const dir = await mkdtemp(join(tmpdir(), "blume-eval-stdin-"));
    dirs.push(dir);
    const bin = await writeExecutable(
      dir,
      "early-exit",
      "process.stderr.write(\"error: unexpected argument '--ephemeral'\\n\"); process.exit(2);"
    );

    // Far past any pipe buffer, so the write is still in flight at exit.
    const result = await runAgentHeadless(bin, [], {
      cwd: dir,
      prompt: "x".repeat(8 * 1024 * 1024),
      timeoutMs: 30_000,
    });
    expect(result.code).toBe(2);
    expect(result.timedOut).toBe(false);
    expect(result.stderr).toContain("unexpected argument '--ephemeral'");

    const output = await readAgentOutput("codex", result, join(dir, "none"));
    expect(output).toEqual({
      detail: "error: unexpected argument '--ephemeral'",
      isError: true,
      text: "",
    });
  });
});
