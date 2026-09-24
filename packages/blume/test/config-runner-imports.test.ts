import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

import { dirname, join, resolve } from "pathe";
import { z } from "zod";

import { astroConfigTemplate } from "../src/astro/templates.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { ProjectContext } from "../src/core/types.ts";
import { vercel } from "../src/deploy/adapters/index.ts";

/**
 * Guards the modules the generated `astro.config.mjs` loads against dynamic
 * `import()`. Node can't import that config itself when Blume is installed
 * from npm — it refuses to strip types from the TypeScript source under
 * `node_modules` — so Astro evaluates it, and every Blume module it reaches,
 * in a Vite module runner that it closes as soon as the config has loaded.
 * A dynamic `import()` in one of those modules resolves through the closed
 * runner, so it throws "Vite module runner has been closed" from any later
 * hook or plugin call: `search: pagefind()` failed every build that way, and
 * hosted search sync and inline code highlighting failed silently.
 *
 * The repo can't reproduce it end to end — its workspace link puts Blume
 * outside `node_modules`, so Node imports the config natively — hence this
 * static check: load lazily with `nodeRequire` (`core/node-require.ts`), or
 * import statically, instead.
 */

const PACKAGE_ROOT = resolve(import.meta.dir, "..");

/** An `exports` target: a path, or conditions whose `default` is the source. */
const exportTarget = z.union([
  z.string(),
  z.object({ default: z.string() }).transform((target) => target.default),
]);

const { exports: packageExports } = z
  .object({ exports: z.record(z.string(), exportTarget) })
  .parse(JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8")));

/** Resolve a `blume` or `blume/…` specifier through the package exports. */
const resolveBlume = (specifier: string): string => {
  const subpath = `.${specifier.slice("blume".length)}`;
  const direct = packageExports[subpath];
  if (direct) {
    return join(PACKAGE_ROOT, direct);
  }
  for (const [pattern, target] of Object.entries(packageExports)) {
    const prefix = pattern.slice(0, -1);
    if (pattern.endsWith("/*") && subpath.startsWith(prefix)) {
      return join(
        PACKAGE_ROOT,
        target.replace("*", subpath.slice(prefix.length))
      );
    }
  }
  throw new Error(`"${specifier}" matches no export of the blume package.`);
};

const isBlume = (specifier: string): boolean =>
  specifier === "blume" || specifier.startsWith("blume/");

const CODE_FILE = /\.(?:[cm]?[jt]s|tsx)$/u;
const transpilers = {
  ts: new Bun.Transpiler({ loader: "ts" }),
  tsx: new Bun.Transpiler({ loader: "tsx" }),
};

/**
 * Every dynamic `import()` in the static import graph of `entries`, as
 * `file -> specifier`. Only Blume's own modules are walked: other packages
 * are external to the runner, so Node loads them itself. Type-only imports
 * are dropped by the transpiler, so they are never followed.
 */
const dynamicImportsReachableFrom = (entries: string[]): string[] => {
  const seen = new Set<string>();
  const found: string[] = [];
  const visit = (file: string): void => {
    if (seen.has(file) || !CODE_FILE.test(file) || !existsSync(file)) {
      return;
    }
    seen.add(file);
    const transpiler = file.endsWith(".tsx") ? transpilers.tsx : transpilers.ts;
    for (const { kind, path } of transpiler.scanImports(
      readFileSync(file, "utf-8")
    )) {
      if (kind === "dynamic-import") {
        found.push(`${file.slice(PACKAGE_ROOT.length + 1)} -> ${path}`);
      } else if (path.startsWith(".")) {
        visit(resolve(dirname(file), path));
      } else if (isBlume(path)) {
        visit(resolveBlume(path));
      }
    }
  };
  for (const entry of entries) {
    visit(entry);
  }
  return found;
};

describe("modules the generated Astro config loads", () => {
  // SAFETY: astroConfigTemplate reads only root, outDir, and pagesRoot from
  // the context.
  const context = {
    outDir: "/r/.blume",
    pagesRoot: null,
    root: "/r",
  } as ProjectContext;
  const output = astroConfigTemplate({
    askPath: "/r/.blume/src/generated/Ask.astro",
    config: blumeConfigSchema.parse({ deployment: vercel() }),
    contentRoutes: [],
    context,
    examplesPath: "/r/.blume/src/generated/examples.ts",
    examplesThemePath: "/r/.blume/src/generated/examples.css",
    featuresPath: "/r/.blume/src/generated/features.ts",
    // The bridge adds the user-config loader's import, so every Blume module
    // the config can pull in is an entry.
    integrationBridge: { configFile: "../blume.config.ts" },
    needsReact: true,
    pages: [],
    searchClientPath: "/r/.blume/src/generated/search-client.ts",
    themePath: "/r/.blume/src/generated/app.css",
  });
  const entries = [
    ...output.matchAll(/from "(?<specifier>blume(?:\/[^"]*)?)"/gu),
  ].map((match) => match.groups?.specifier ?? "");

  it("imports Blume's runtime through its package exports", () => {
    expect(entries).toContain("blume/astro");
    expect(entries).toContain("blume/markdown");
  });

  it("never loads a module with import(), which fails once the config has loaded", () => {
    expect(dynamicImportsReachableFrom(entries.map(resolveBlume))).toEqual([]);
  });
});
