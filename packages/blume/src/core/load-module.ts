import { createJiti } from "jiti";

/**
 * Create a loader for user-authored ESM/TS modules (`blume.config.ts`,
 * `meta.ts`). One jiti instance is reused across every file the returned loader
 * is called with. `moduleCache: false` ensures edits are picked up on each load,
 * which is what makes dev-server regeneration reflect config/meta changes.
 */
// oxlint-disable-next-line anti-slop/no-unknown-returns -- user-authored modules can export anything; callers validate the loaded value at their own boundary
export const createModuleLoader = (): ((file: string) => Promise<unknown>) => {
  const jiti = createJiti(import.meta.url, { moduleCache: false });
  return async (file: string) => {
    const loaded = await jiti.import<{ default?: unknown }>(file);
    return loaded?.default ?? loaded;
  };
};

/**
 * Create a loader for a module whose default export is its whole value
 * (`blume.config.ts`). Unlike {@link createModuleLoader}, it never falls back
 * to the module's namespace: a module with no default export, or one that
 * exports `null`/`undefined`, resolves to `undefined` so the caller can say
 * so, instead of validating `{}` (a bare `defineConfig({…})` call) or
 * `{ config }` (a named export). jiti's default interop is off because it
 * throws on `export default null`.
 */
export const createDefaultExportLoader: typeof createModuleLoader = () => {
  const jiti = createJiti(import.meta.url, {
    interopDefault: false,
    moduleCache: false,
  });
  return async (file: string) => {
    const loaded = await jiti.import<{ default?: unknown }>(file);
    return loaded.default ?? undefined;
  };
};
