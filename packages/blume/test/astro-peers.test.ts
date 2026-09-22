import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";

import { join } from "pathe";

const PACKAGE_ROOT = join(import.meta.dir, "..");
const NODE_MODULES = join(PACKAGE_ROOT, "node_modules");

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  version: string;
}

const readManifest = async (dir: string): Promise<Manifest | null> => {
  try {
    // SAFETY: every package.json under node_modules is a package manifest.
    return JSON.parse(
      await readFile(join(dir, "package.json"), "utf-8")
    ) as Manifest;
  } catch {
    return null;
  }
};

// A fresh `blume init` project installs exactly Blume's dependency graph, so a
// dependency whose `peerDependencies.astro` excludes the Astro Blume ships
// surfaces as an "incorrect peer dependency" warning on the user's very first
// install (and npm quietly nests a second Astro to satisfy it). Every direct
// dependency that declares an Astro peer has to accept the installed version.
describe("astro peer ranges", () => {
  it("every direct dependency accepts the Astro version Blume installs", async () => {
    const blume = await readManifest(PACKAGE_ROOT);
    const astro = await readManifest(join(NODE_MODULES, "astro"));
    expect(blume).not.toBeNull();
    expect(astro).not.toBeNull();
    if (!(blume && astro)) {
      return;
    }

    const names = Object.keys({
      ...blume.dependencies,
      ...blume.devDependencies,
    });
    const manifests = await Promise.all(
      names.map(async (name) => ({
        manifest: await readManifest(join(NODE_MODULES, name)),
        name,
      }))
    );
    const checked: string[] = [];
    const rejected: string[] = [];
    for (const { manifest, name } of manifests) {
      const range = manifest?.peerDependencies?.astro;
      if (!(manifest && range)) {
        continue;
      }
      checked.push(name);
      if (!Bun.semver.satisfies(astro.version, range)) {
        rejected.push(`${name}@${manifest.version} wants astro ${range}`);
      }
    }

    // The Astro integrations Blume always ships declare a peer, so an empty
    // list means the walk looked in the wrong place, not that all is well.
    expect(checked).toContain("@astrojs/mdx");
    expect(checked).toContain("@scalar/astro");
    expect(rejected).toEqual([]);
  });
});
