import { describe, expect, it } from "bun:test";

import {
  DEFAULT_TRANSLATE_TIMEOUT_MS,
  translateAgentArgs,
} from "../src/translate/agents.ts";

describe("translateAgentArgs", () => {
  it("builds the claude argv: headless JSON, no MCP, no tools, one turn", () => {
    expect(translateAgentArgs("claude", "/work/message-0.txt")).toEqual([
      "-p",
      "--output-format",
      "json",
      "--strict-mcp-config",
      "--disallowedTools",
      "Bash,Read,Glob,Grep,Write,Edit,NotebookEdit,WebFetch,WebSearch,Task",
      "--max-turns",
      "1",
    ]);
  });

  it("builds the codex argv: read-only sandbox, lockdown, last-message file, stdin prompt", () => {
    // Same lockdown as an eval run: `--sandbox read-only` alone still leaves
    // a shell that can read any file the user can.
    expect(translateAgentArgs("codex", "/work/message-3.txt")).toEqual([
      "exec",
      "--skip-git-repo-check",
      "--ignore-user-config",
      "--ephemeral",
      "--sandbox",
      "read-only",
      "-c",
      "features.shell_tool=false",
      "-c",
      "features.unified_exec=false",
      "-c",
      "tools.view_image=false",
      "-c",
      'shell_environment_policy.inherit="none"',
      "--output-last-message",
      "/work/message-3.txt",
      "-",
    ]);
  });

  it("defaults the per-file timeout to ten minutes", () => {
    expect(DEFAULT_TRANSLATE_TIMEOUT_MS).toBe(600_000);
  });
});
