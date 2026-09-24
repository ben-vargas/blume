import { afterAll, describe, expect, it, spyOn } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { EJECTED_CONFIG_HEADER } from "../src/astro/templates.ts";
import { refuseIfEjected } from "../src/cli/eject-scripts.ts";
import type { RuntimeCommand } from "../src/cli/eject-scripts.ts";
import { logger } from "../src/cli/log.ts";

/**
 * Every command that works on the hidden `.blume/` runtime refuses an ejected
 * app, pointing at what the app runs instead: `check` and `sync` would
 * regenerate that runtime, and `preview` would look for its build.
 */

const CLI = join(import.meta.dir, "..", "src", "cli", "index.ts");

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

/** An app `blume eject` wrote, with `lockfile` naming its package manager. */
const ejectedApp = async (lockfile?: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "blume-ejected-refusal-"));
  dirs.push(root);
  await writeFile(
    join(root, "astro.config.mjs"),
    `${EJECTED_CONFIG_HEADER}\nexport default {};\n`
  );
  await writeFile(join(root, "package.json"), '{ "name": "app" }\n');
  if (lockfile) {
    await writeFile(join(root, lockfile), "");
  }
  return root;
};

// consola's log functions carry a `raw` variant; the stub needs one too.
const silentLog = Object.assign(
  (): void => {
    // Keep the refusal out of the test output.
  },
  {
    raw: (): void => {
      // Keep the refusal out of the test output.
    },
  }
);

/** The refusal `refuseIfEjected` logs for `command`, exiting captured. */
const refusal = async (
  root: string,
  command: RuntimeCommand
): Promise<string> => {
  const errorSpy = spyOn(logger, "error").mockImplementation(silentLog);
  const exit = spyOn(process, "exit").mockImplementation(() => {
    throw new Error("exit");
  });
  try {
    await expect(refuseIfEjected(root, command)).rejects.toThrow("exit");
    expect(exit).toHaveBeenCalledWith(1);
    return String(errorSpy.mock.calls[0]?.[0]);
  } finally {
    exit.mockRestore();
    errorSpy.mockRestore();
  }
};

describe("refuseIfEjected", () => {
  it("points check and sync at Astro's own CLI", async () => {
    const root = await ejectedApp("pnpm-lock.yaml");
    expect(await refusal(root, "check")).toContain(
      "Run `pnpm exec astro check` instead."
    );
    expect(await refusal(root, "sync")).toContain(
      "Run `pnpm exec astro sync` instead."
    );
  });

  it("points preview at the app's own preview script", async () => {
    expect(
      await refusal(await ejectedApp("pnpm-lock.yaml"), "preview")
    ).toContain("Run `pnpm preview` instead.");
    expect(
      await refusal(await ejectedApp("package-lock.json"), "preview")
    ).toContain("Run `npm run preview` instead.");
  });
});

const run = async (
  cwd: string,
  args: string[]
): Promise<{ exitCode: number; output: string }> => {
  const env = { ...process.env };
  // `bun test` sets NODE_ENV=test, which lowers consola's log level.
  delete env.NODE_ENV;
  delete env.npm_config_user_agent;
  delete env.BLUME_RUNTIME_DIR;
  const proc = Bun.spawn(["bun", CLI, ...args], {
    cwd,
    env,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, output: `${stdout}${stderr}` };
};

describe("blume check, sync, and preview in an ejected app", () => {
  it.each([
    ["check", /Run `?pnpm exec astro check`? instead\./u],
    ["sync", /Run `?pnpm exec astro sync`? instead\./u],
    ["preview", /Run `?pnpm preview`? instead\./u],
  ])("blume %s refuses and regenerates nothing", async (command, hint) => {
    const root = await ejectedApp("pnpm-lock.yaml");
    const { exitCode, output } = await run(root, [command]);
    expect(exitCode).toBe(1);
    expect(output).toContain("ejected to a standalone Astro app");
    expect(output).toMatch(hint);
    expect(output).not.toContain("No build found");
    expect(existsSync(join(root, ".blume"))).toBe(false);
  });
});
