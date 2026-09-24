import { afterAll, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { BlumeError } from "../src/core/diagnostics.ts";
import {
  hashSource,
  LEDGER_FILE,
  readLedger,
} from "../src/translate/ledger.ts";

/**
 * The ledger is what `--check` trusts, so it must not silently read as empty
 * over a botched merge, and a CRLF checkout must not look like an edit.
 */

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const withLedger = async (text: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-translate-ledger-"));
  dirs.push(root);
  await writeFile(join(root, LEDGER_FILE), text);
  return root;
};

const CONFLICTED = `{
  "files": {
<<<<<<< HEAD
    "docs/a.mdx": { "fr": "aaaaaaaaaaaaaaaa" }
=======
    "docs/a.mdx": { "fr": "bbbbbbbbbbbbbbbb" }
>>>>>>> origin/main
  },
  "version": 1
}
`;

describe("a ledger with merge-conflict markers", () => {
  it("fails with a clear error instead of reading as empty", async () => {
    const root = await withLedger(CONFLICTED);
    const rejection = await readLedger(root).catch((error: Error) => error);
    expect(rejection).toBeInstanceOf(BlumeError);
    // SAFETY: the assertion above proves the rejection is a BlumeError.
    const { diagnostic } = rejection as BlumeError;
    expect(diagnostic.code).toBe("BLUME_TRANSLATE_LEDGER_CONFLICT");
    expect(diagnostic.file).toBe(join(root, LEDGER_FILE));
    expect(diagnostic.message).toContain("merge-conflict markers");
  });

  it("catches CRLF conflict markers too", async () => {
    const root = await withLedger(CONFLICTED.replaceAll("\n", "\r\n"));
    await expect(readLedger(root)).rejects.toBeInstanceOf(BlumeError);
  });

  it("still reads other unparseable text as empty", async () => {
    const root = await withLedger("{ not json");
    expect(await readLedger(root)).toEqual({ files: {}, version: 1 });
  });
});

describe("hashSource line endings", () => {
  const LF = "---\ntitle: Install\n---\n# Install\n\nRun it.\n";

  it("hashes a CRLF checkout the same as the LF source", () => {
    expect(hashSource(LF.replaceAll("\n", "\r\n"))).toBe(hashSource(LF));
  });

  it("leaves LF hashes exactly as they were", () => {
    expect(hashSource(LF)).toBe(
      createHash("sha256").update(LF).digest("hex").slice(0, 16)
    );
  });
});
