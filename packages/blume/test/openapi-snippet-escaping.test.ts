import { afterAll, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import type { RequestSample } from "../src/components/openapi/snippets.ts";
import { sampleLanguages } from "../src/components/openapi/snippets.ts";

/**
 * Header values, URLs, and bodies are someone else's strings — an `If-Match`
 * ETag carries its own quotes, a token can hold `$` — so each sample quotes
 * them for its language instead of pasting them between double quotes.
 */

const SAMPLE: RequestSample = {
  body: `{"note":"it's $HOME $(id)"}`,
  headers: {
    Authorization: "Bearer $TOKEN",
    "If-Match": '"33a64df5"',
    "X-Path": String.raw`C:\temp`,
  },
  method: "PUT",
  url: "https://api.example.com/items/1?q=it's",
};

const build = (id: string): string => {
  const [language] = sampleLanguages([id]);
  if (!language) {
    throw new Error(`no ${id} sample language`);
  }
  return language.build(SAMPLE);
};

describe("sample escaping", () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(
      dirs.map((dir) => rm(dir, { force: true, recursive: true }))
    );
  });

  it("single-quotes every curl word so nothing expands", () => {
    expect(build("curl")).toBe(
      [
        String.raw`curl -X PUT 'https://api.example.com/items/1?q=it'\''s'`,
        `  -H 'Authorization: Bearer $TOKEN'`,
        `  -H 'If-Match: "33a64df5"'`,
        String.raw`  -H 'X-Path: C:\temp'`,
        String.raw`  -d '{"note":"it'\''s $HOME $(id)"}'`,
      ].join(" \\\n")
    );
  });

  it("emits JavaScript that parses and carries the values verbatim", async () => {
    const js = build("js");
    expect(js).toContain(String.raw`"If-Match": "\"33a64df5\""`);
    const dir = await mkdtemp(join(tmpdir(), "blume-snippet-"));
    dirs.push(dir);
    const file = join(dir, "sample.mjs");
    await writeFile(file, js);
    const check = spawnSync("node", ["--check", file], { encoding: "utf-8" });
    expect(check.stderr).toBe("");
    expect(check.status).toBe(0);
  });

  it("emits Python string literals with the quotes escaped", () => {
    const python = build("python");
    expect(python).toContain(String.raw`"If-Match": "\"33a64df5\""`);
    expect(python).toContain(String.raw`"X-Path": "C:\\temp"`);
    expect(python).toContain(`"https://api.example.com/items/1?q=it's"`);
  });
});
