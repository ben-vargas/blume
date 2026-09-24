import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import { join } from "pathe";

import { packageRoot } from "../core/package-root.ts";

/** A JSON value, as `JSON.parse` of a manifest can return. */
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** The slice of package.json the rewrite touches; the rest rides along. */
interface PackageManifest {
  [key: string]: JsonValue | undefined;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

/** Package name → the semver range to depend on it at. */
export interface DependencyRanges {
  [name: string]: string;
}

/**
 * The version range Blume itself uses for each package it depends on or
 * accepts as a peer, plus `blume` at the installed version — what an ejected
 * app should pin so it keeps building against the same majors.
 */
export const blumeDependencyRanges = (): DependencyRanges => {
  // SAFETY: blume's own package.json, which declares its version and both
  // dependency maps; nothing else is read.
  const manifest = JSON.parse(
    readFileSync(join(packageRoot(), "package.json"), "utf-8")
  ) as {
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    version: string;
  };
  return {
    ...manifest.peerDependencies,
    ...manifest.dependencies,
    blume: `^${manifest.version}`,
  };
};

/** Whether the manifest already lists `name` in any dependency field. */
const declares = (pkg: PackageManifest, name: string): boolean =>
  [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.optionalDependencies,
    pkg.peerDependencies,
  ].some((field) => field !== undefined && Object.hasOwn(field, name));

/**
 * Point the project's package.json at the ejected app. Its scripts run Astro
 * directly: after an eject the Blume CLI no longer manages the runtime, so
 * scaffolded scripts like `"dev": "blume dev"` would rebuild the removed
 * `.blume` tree instead of serving the ejected app. And every package the
 * ejected app imports by bare name (`dependencies`, from `eject()`) that the
 * project doesn't list yet becomes a dependency at the range Blume itself
 * uses (`ranges`).
 *
 * Returns the names it added, so the caller can ask for an install. A missing
 * or unreadable package.json is left alone.
 */
export const updatePackageScripts = async (
  root: string,
  dependencies: string[] = [],
  ranges: DependencyRanges = blumeDependencyRanges()
): Promise<string[]> => {
  const pkgPath = join(root, "package.json");
  let pkg: PackageManifest;
  try {
    pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  } catch {
    return [];
  }
  const scripts = pkg.scripts ?? {};
  pkg.scripts = {
    ...scripts,
    build: "astro build",
    dev: "astro dev",
    preview: "astro preview",
  };
  const added = dependencies.filter((name) => !declares(pkg, name));
  if (added.length > 0) {
    // Sorted, the way package managers write the field.
    pkg.dependencies = Object.fromEntries(
      Object.entries({
        ...pkg.dependencies,
        ...Object.fromEntries(added.map((name) => [name, ranges[name] ?? "*"])),
      }).toSorted(([a], [b]) => (a < b ? -1 : 1))
    );
  }
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
  return added;
};
