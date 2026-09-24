import { afterAll, describe, expect, it, spyOn } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import { EJECTED_CONFIG_HEADER } from "../src/astro/templates.ts";
import {
  blumeDependencyRanges,
  isEjectedProject,
  refuseIfEjected,
  updatePackageScripts,
} from "../src/cli/eject-scripts.ts";
import { logger } from "../src/cli/log.ts";
import { packageRoot } from "../src/core/package-root.ts";

const dirs: string[] = [];

const makeRoot = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "blume-eject-scripts-"));
  dirs.push(dir);
  return dir;
};

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

/** The package.json fields these tests write and read back. */
interface TestPackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  scripts?: Record<string, string>;
}

const readPkg = async (root: string): Promise<TestPackageManifest> =>
  JSON.parse(await readFile(join(root, "package.json"), "utf-8"));

describe("updatePackageScripts", () => {
  it("rewrites the Blume scripts to run Astro directly", async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "docs",
        scripts: { build: "blume build", dev: "blume dev" },
      })
    );
    await updatePackageScripts(root);
    const pkg = await readPkg(root);
    expect(pkg.scripts).toEqual({
      build: "astro build",
      dev: "astro dev",
      preview: "astro preview",
    });
  });

  it("preserves unrelated scripts and fields", async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: { blume: "^1.0.0" },
        name: "docs",
        scripts: { dev: "blume dev", lint: "eslint ." },
      })
    );
    await updatePackageScripts(root);
    const pkg = await readPkg(root);
    expect(pkg.dependencies).toEqual({ blume: "^1.0.0" });
    expect(pkg.scripts?.lint).toBe("eslint .");
    expect(pkg.scripts?.dev).toBe("astro dev");
  });

  it("adds a scripts block when the package.json has none", async () => {
    const root = await makeRoot();
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "d" }));
    await updatePackageScripts(root);
    const pkg = await readPkg(root);
    expect(pkg.scripts).toEqual({
      build: "astro build",
      dev: "astro dev",
      preview: "astro preview",
    });
  });

  it("leaves a project without a readable package.json alone", async () => {
    const root = await makeRoot();
    await updatePackageScripts(root);
    expect(existsSync(join(root, "package.json"))).toBe(false);

    await writeFile(join(root, "package.json"), "not json");
    await updatePackageScripts(root);
    expect(await readFile(join(root, "package.json"), "utf-8")).toBe(
      "not json"
    );
  });

  it("adds the packages the ejected app imports, at Blume's ranges", async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: { blume: "^2.0.0", zod: "^4.0.0" },
        devDependencies: { "@tailwindcss/vite": "^4.0.0" },
        name: "docs",
      })
    );
    const added = await updatePackageScripts(
      root,
      ["astro", "@tailwindcss/vite", "blume", "@astrojs/mdx", "left-pad"],
      { "@astrojs/mdx": "^8.0.1", astro: "^7.3.2" }
    );
    // Already-listed packages (in any dependency field) are left as they are.
    expect(added).toEqual(["astro", "@astrojs/mdx", "left-pad"]);
    const pkg = await readPkg(root);
    // Sorted like a package manager writes it; a name Blume has no range for
    // falls back to any version.
    expect(Object.entries(pkg.dependencies ?? {})).toEqual([
      ["@astrojs/mdx", "^8.0.1"],
      ["astro", "^7.3.2"],
      ["blume", "^2.0.0"],
      ["left-pad", "*"],
      ["zod", "^4.0.0"],
    ]);
    expect(pkg.devDependencies).toEqual({ "@tailwindcss/vite": "^4.0.0" });
  });

  it("leaves the dependencies alone when nothing is missing", async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ dependencies: { astro: "^7.0.0" }, name: "docs" })
    );
    expect(await updatePackageScripts(root, ["astro"])).toEqual([]);
    const pkg = await readPkg(root);
    expect(pkg.dependencies).toEqual({ astro: "^7.0.0" });
  });

  it("returns nothing for a project without a package.json", async () => {
    const root = await makeRoot();
    expect(await updatePackageScripts(root, ["astro"])).toEqual([]);
  });
});

describe("blumeDependencyRanges", () => {
  it("reads Blume's own dependency and peer ranges, and pins blume", async () => {
    // SAFETY: blume's own package.json, which declares these maps.
    const manifest = JSON.parse(
      await readFile(join(packageRoot(), "package.json"), "utf-8")
    ) as {
      dependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
      version: string;
    };
    const ranges = blumeDependencyRanges();
    expect(ranges.astro).toBe(manifest.dependencies.astro);
    expect(ranges["@astrojs/cloudflare"]).toBe(
      manifest.peerDependencies["@astrojs/cloudflare"]
    );
    expect(ranges.blume).toBe(`^${manifest.version}`);
  });
});

describe("isEjectedProject", () => {
  it("is false for a Blume project, even one with its own astro.config.mjs", async () => {
    const root = await makeRoot();
    expect(isEjectedProject(root)).toBe(false);
    await writeFile(join(root, "astro.config.mjs"), "export default {};\n");
    expect(isEjectedProject(root)).toBe(false);
  });

  it("recognizes the config eject writes", async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, "astro.config.mjs"),
      `${EJECTED_CONFIG_HEADER}\nexport default {};\n`
    );
    expect(isEjectedProject(root)).toBe(true);
  });

  it("recognizes an app Blume 1 ejected by its config header", async () => {
    const root = await makeRoot();
    // Blume 1 wrote the generated-runtime header into the ejected config.
    await writeFile(
      join(root, "astro.config.mjs"),
      "// Generated by Blume. Do not edit; this file is recreated on each run.\nexport default {};\n"
    );
    expect(isEjectedProject(root)).toBe(true);
  });

  it("is false for a Blume project with its own config and a codegen src/generated", async () => {
    // A user astro.config.mjs beside a codegen folder is not eject's output:
    // only the header marks an ejected app.
    const root = await makeRoot();
    await writeFile(
      join(root, "astro.config.mjs"),
      'import { defineConfig } from "astro/config";\nexport default defineConfig({});\n'
    );
    await mkdir(join(root, "src", "generated"), { recursive: true });
    await writeFile(
      join(root, "src", "generated", "client.ts"),
      "export {};\n"
    );
    expect(isEjectedProject(root)).toBe(false);
  });

  it("does not take a header that appears later in the file", async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, "astro.config.mjs"),
      `export default {};\n${EJECTED_CONFIG_HEADER}\n`
    );
    expect(isEjectedProject(root)).toBe(false);
  });
});

describe("refuseIfEjected", () => {
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

  it("lets a Blume project through", async () => {
    const root = await makeRoot();
    const exit = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    try {
      await refuseIfEjected(root, "dev");
      expect(exit).not.toHaveBeenCalled();
    } finally {
      exit.mockRestore();
    }
  });

  it("points an ejected app at its own script and exits", async () => {
    const root = await makeRoot();
    await writeFile(
      join(root, "astro.config.mjs"),
      `${EJECTED_CONFIG_HEADER}\nexport default {};\n`
    );
    await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    const errorSpy = spyOn(logger, "error").mockImplementation(silentLog);
    const exit = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    try {
      await expect(refuseIfEjected(root, "build")).rejects.toThrow("exit");
      expect(exit).toHaveBeenCalledWith(1);
      expect(String(errorSpy.mock.calls[0]?.[0])).toContain(
        "Run `pnpm build` instead."
      );
    } finally {
      exit.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
