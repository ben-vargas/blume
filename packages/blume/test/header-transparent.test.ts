import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";

import { join } from "pathe";

import { packageRoot } from "../src/core/package-root.ts";

/** The browser globals the transparent-header script reads. */
interface HeaderSandbox {
  addEventListener: (type: string) => void;
  document: {
    addEventListener: (type: string) => void;
    querySelector: () => {
      toggleAttribute: (name: string, on: boolean) => void;
    };
  };
  scrollY: number;
  window?: HeaderSandbox;
}

/** The inline script `Header.astro` renders on a `transparentHeader` page. */
const transparentScript = async (): Promise<string> => {
  const source = await readFile(
    join(packageRoot(), "src", "components", "layout", "Header.astro"),
    "utf-8"
  );
  const script = source.match(/const transparentScript = `(?<body>[^`]+)`;/u)
    ?.groups?.body;
  if (script === undefined) {
    throw new Error("Header.astro no longer defines transparentScript");
  }
  return script;
};

describe("Header transparentHeader script", () => {
  it("installs its listeners once per real load but syncs on every run", async () => {
    const script = await transparentScript();
    const scrolled: boolean[] = [];
    const windowListeners: string[] = [];
    const documentListeners: string[] = [];
    const bar = {
      toggleAttribute: (_name: string, on: boolean) => {
        scrolled.push(on);
      },
    };
    const sandbox: HeaderSandbox = {
      addEventListener: (type: string) => {
        windowListeners.push(type);
      },
      document: {
        addEventListener: (type: string) => {
          documentListeners.push(type);
        },
        querySelector: () => bar,
      },
      scrollY: 20,
    };
    sandbox.window = sandbox;
    const context = createContext(sandbox);

    // The client router re-runs the inline script on each swap into a
    // transparent-header page: one real load, then two swaps.
    for (const _run of [1, 2, 3]) {
      runInContext(script, context);
    }

    expect(windowListeners).toStrictEqual(["scroll"]);
    expect(documentListeners).toStrictEqual(["astro:after-swap"]);
    // Each run still flags the page it lands on.
    expect(scrolled).toStrictEqual([true, true, true]);
  });
});
