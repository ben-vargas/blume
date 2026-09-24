import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { loadEnvFiles } from "../src/cli/env.ts";

/**
 * `NODE_ENV` picks the mode Vite and Astro run in, so the cascading `.env`
 * loader never takes it from a file: a monorepo root `.env` setting it for
 * another app must not turn `blume build` into a development build.
 */

const dirs: string[] = [];
// `bun test` exports NODE_ENV=test; restore it whatever a test did.
const original = process.env.NODE_ENV;

afterEach(async () => {
  if (original === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
  } else {
    process.env.NODE_ENV = original;
  }
  Reflect.deleteProperty(process.env, "BLUME_ENVTEST_BESIDE_NODE_ENV");
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

/** A repo whose root `.env` sets NODE_ENV, with an app folder inside it. */
const monorepo = async (): Promise<string> => {
  const repo = await mkdtemp(join(tmpdir(), "blume-env-node-env-"));
  dirs.push(repo);
  await mkdir(join(repo, ".git"), { recursive: true });
  await mkdir(join(repo, "apps", "docs"), { recursive: true });
  await writeFile(
    join(repo, ".env"),
    "NODE_ENV=development\nBLUME_ENVTEST_BESIDE_NODE_ENV=loaded\n"
  );
  return join(repo, "apps", "docs");
};

describe("loadEnvFiles and NODE_ENV", () => {
  it("never sets NODE_ENV from a file, but loads the rest", async () => {
    const app = await monorepo();
    Reflect.deleteProperty(process.env, "NODE_ENV");

    loadEnvFiles(app);

    expect(process.env.NODE_ENV).toBeUndefined();
    expect(process.env.BLUME_ENVTEST_BESIDE_NODE_ENV).toBe("loaded");
  });

  it("leaves a NODE_ENV the shell set alone", async () => {
    const app = await monorepo();
    process.env.NODE_ENV = "production";

    loadEnvFiles(app);

    expect(process.env.NODE_ENV).toBe("production");
  });
});
