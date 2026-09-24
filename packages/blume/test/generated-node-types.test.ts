import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { join } from "pathe";

import { contentAssetsEndpointTemplate } from "../src/astro/templates.ts";
import { packageRoot } from "../src/core/package-root.ts";

/**
 * `blume check` type-checks the generated pages with the project's own type
 * roots, and a fresh project installs nothing but Blume. A generated page that
 * imports a Node builtin therefore needs `@types/node` to arrive with Blume
 * itself: as a devDependency it exists only in this repository, where every
 * in-repo type check passes while a user's `blume check` fails on files Blume
 * wrote.
 */
describe("Node types for generated pages", () => {
  it("ships @types/node as a dependency, since generated pages import Node builtins", () => {
    expect(contentAssetsEndpointTemplate("/tmp/staged")).toContain(
      'from "node:fs"'
    );
    const manifest: {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    } = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf-8"));
    expect(manifest.dependencies["@types/node"]).toBeDefined();
    expect(manifest.devDependencies["@types/node"]).toBeUndefined();
  });
});
