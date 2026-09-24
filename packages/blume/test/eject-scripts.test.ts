import { afterAll, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import {
  blumeDependencyRanges,
  updatePackageScripts,
} from "../src/cli/eject-scripts.ts";
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
