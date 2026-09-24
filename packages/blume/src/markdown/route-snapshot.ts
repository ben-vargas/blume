import { readFileSync, statSync } from "node:fs";

import { resolve } from "pathe";

import { readRuntimeModule } from "../astro/runtime-modules.ts";

/**
 * A reader for the `blume:data` snapshot the Markdown link plugins consult for
 * the site's routes: the text the CLI publishes, or — in an ejected app, with
 * no CLI in the process — the snapshot file eject writes (`dataFile`), re-read
 * only when it changes. Resolves to `undefined` when neither is available.
 */
export const routeSnapshotReader = (
  dataFile?: string
): (() => string | undefined) => {
  const file = dataFile ? resolve(dataFile) : undefined;
  let fileStamp: number | undefined;
  let fileText: string | undefined;

  /** The ejected snapshot file's text, re-read only when it changes. */
  const readDataFile = (path: string): string | undefined => {
    let stamp: number;
    try {
      stamp = statSync(path).mtimeMs;
    } catch {
      return undefined;
    }
    if (stamp !== fileStamp) {
      fileStamp = stamp;
      fileText = readFileSync(path, "utf-8");
    }
    return fileText;
  };

  return () =>
    readRuntimeModule("blume:data") ?? (file ? readDataFile(file) : undefined);
};
