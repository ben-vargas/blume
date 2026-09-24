import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";

import { join } from "pathe";

import { packageRoot } from "../src/core/package-root.ts";

/** The inline click script every `Header.astro` renders. */
const clickScript = async (): Promise<string> => {
  const source = await readFile(
    join(packageRoot(), "src", "components", "layout", "Header.astro"),
    "utf-8"
  );
  const script = source.match(/const clickScript = `(?<body>[^`]+)`;/u)?.groups
    ?.body;
  if (script === undefined) {
    throw new Error("Header.astro no longer defines clickScript");
  }
  return script;
};

/** The `<style>` element the theme toggle appends to `<head>`. */
interface StyleStub {
  appendChild: (text: string) => null;
}

type ClickListener = (event: { target: { closest: Closest } }) => void;
type Closest = (
  selector: string
) => { closest: Closest; getAttribute: (name: string) => string | null } | null;

/**
 * Run the script against stand-ins for the handful of globals it touches, and
 * return a clicker plus what it did. `setItem` throws when `blocked`, the way
 * storage does under Safari's "Block All Cookies".
 */
const runClickScript = async (blocked: boolean) => {
  let onClick: ClickListener | undefined;
  const head: StyleStub[] = [];
  const stored = new Map<string, string>();
  const rootAttributes = new Set<string>();
  const root = {
    dataset: { theme: "light" },
    hasAttribute: (name: string) => rootAttributes.has(name),
    setAttribute: (name: string) => {
      rootAttributes.add(name);
    },
    style: { setProperty: () => null },
    toggleAttribute: (name: string) => {
      if (rootAttributes.delete(name)) {
        return false;
      }
      rootAttributes.add(name);
      return true;
    },
  };
  const sandbox = {
    addEventListener: () => null,
    document: {
      addEventListener: (type: string, listener: ClickListener) => {
        if (type === "click") {
          onClick = listener;
        }
      },
      createElement: (): StyleStub => ({ appendChild: () => null }),
      createTextNode: (text: string) => text,
      documentElement: root,
      head: {
        appendChild: (node: StyleStub) => {
          head.push(node);
        },
        removeChild: (node: StyleStub) => {
          head.splice(head.indexOf(node), 1);
        },
      },
      querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 64 }) }),
    },
    localStorage: {
      setItem: (key: string, value: string) => {
        if (blocked) {
          throw new Error("SecurityError: The operation is insecure.");
        }
        stored.set(key, value);
      },
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (frame: () => void) => frame(),
    // Timers run at once: the style tag's removal is what's under test.
    setTimeout: (task: () => void) => task(),
    window: { getComputedStyle: () => ({ opacity: "1" }) },
  };
  runInContext(await clickScript(), createContext(sandbox));
  /** Click something that `closest` resolves to `hit` for one selector. */
  const click = (hit: string, attributes: Record<string, string> = {}) => {
    const element = {
      closest: (selector: string) =>
        selector === hit || selector === "[data-blume-banner]" ? element : null,
      getAttribute: (name: string) => attributes[name] ?? null,
    };
    onClick?.({ target: element });
  };
  return { click, head, root, rootAttributes, stored };
};

describe("Header click script", () => {
  it("flips the theme and drops the transition guard even when storage is blocked", async () => {
    const run = await runClickScript(true);
    expect(() => run.click("[data-blume-theme-toggle]")).not.toThrow();
    expect(run.root.dataset.theme).toBe("dark");
    // The `transition:none` style tag is gone again, not stuck on the page.
    expect(run.head).toEqual([]);
  });

  it("hides the banner even when storage is blocked", async () => {
    const run = await runClickScript(true);
    expect(() =>
      run.click("[data-blume-banner-dismiss]", {
        "data-banner-key": "launch",
      })
    ).not.toThrow();
    expect(run.rootAttributes.has("data-blume-banner-hidden")).toBe(true);
  });

  it("remembers both choices where storage works", async () => {
    const run = await runClickScript(false);
    run.click("[data-blume-theme-toggle]");
    run.click("[data-blume-banner-dismiss]", { "data-banner-key": "launch" });
    expect(Object.fromEntries(run.stored)).toEqual({
      "blume-banner:launch": "1",
      "blume-theme": "dark",
    });
  });

  it("toggles the nav drawer attribute", async () => {
    const run = await runClickScript(false);
    run.click("[data-blume-nav-toggle]");
    expect(run.rootAttributes.has("data-blume-nav-open")).toBe(true);
    run.click("[data-blume-nav-toggle]");
    expect(run.rootAttributes.has("data-blume-nav-open")).toBe(false);
  });
});
