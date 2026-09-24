import { afterEach, describe, expect, it } from "bun:test";

import { syncDrawerInert } from "../src/components/layout/drawer-inert.ts";

// A hand-rolled DOM for the drawer module (see fake-dom.ts for why not
// happy-dom): an element tree with attributes, `inert`, and focus, and a
// selector matcher for exactly the selectors drawer-inert.ts uses — simple
// `tag[attr]` compounds, comma lists, and one descendant combinator.

const SIMPLE = /^(?<tag>[a-z]+)?(?<attrs>(?:\[[^\]]+\])*)$/u;
const ATTR = /\[(?<name>[^\]]+)\]/gu;

const OPEN = "data-blume-nav-open";
const BACKDROP = "data-blume-drawer-backdrop";

interface FakeElement {
  readonly tag: string;
  readonly children: FakeElement[];
  parentElement: FakeElement | null;
  inert: boolean;
  append: (...children: FakeElement[]) => FakeElement;
  hasAttribute: (name: string) => boolean;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  matches: (list: string) => boolean;
  contains: (other: FakeElement) => boolean;
  focus: () => void;
  descendants: () => FakeElement[];
}

interface KeyEvent {
  key?: string;
}

type Handler = (event: KeyEvent) => void;

interface FakeDocument {
  activeElement: FakeElement | null;
  readonly documentElement: FakeElement;
  readonly body: FakeElement;
  addEventListener: (type: string, handler: Handler) => void;
  dispatch: (type: string, event?: KeyEvent) => void;
  querySelectorAll: (selector: string) => FakeElement[];
  querySelector: (selector: string) => FakeElement | null;
  element: (tag: string, attrs?: string[]) => FakeElement;
}

const matchesSimple = (element: FakeElement, selector: string): boolean => {
  const parts = SIMPLE.exec(selector)?.groups;
  if (!parts) {
    throw new Error(`fake DOM can't parse ${selector}`);
  }
  if (parts.tag && parts.tag !== element.tag) {
    return false;
  }
  return [...(parts.attrs ?? "").matchAll(ATTR)].every(({ groups }) =>
    element.hasAttribute(groups?.name ?? "")
  );
};

const fakeDocument = (): FakeDocument => {
  const handlers = new Map<string, Handler[]>();
  let active: FakeElement | null = null;
  const element = (tag: string, attrs: string[] = []): FakeElement => {
    const attributes = new Map(attrs.map((name) => [name, ""]));
    const node: FakeElement = {
      append: (...children) => {
        for (const child of children) {
          child.parentElement = node;
          node.children.push(child);
        }
        return node;
      },
      children: [],
      contains: (other) => {
        for (let at: FakeElement | null = other; at; at = at.parentElement) {
          if (at === node) {
            return true;
          }
        }
        return false;
      },
      descendants: () =>
        node.children.flatMap((child) => [child, ...child.descendants()]),
      focus: () => {
        active = node;
      },
      getAttribute: (name) => attributes.get(name) ?? null,
      hasAttribute: (name) => attributes.has(name),
      inert: false,
      matches: (list) =>
        list
          .split(",")
          .some((selector) => matchesSimple(node, selector.trim())),
      parentElement: null,
      removeAttribute: (name) => {
        attributes.delete(name);
      },
      setAttribute: (name, value) => {
        attributes.set(name, value);
      },
      tag,
    };
    return node;
  };
  const documentElement = element("html");
  const body = element("body");
  documentElement.append(body);
  active = body;
  const querySelectorAll = (selector: string): FakeElement[] => {
    const [ancestor, target] = selector.includes(" ")
      ? selector.split(" ")
      : [undefined, selector];
    return documentElement.descendants().filter((candidate) => {
      if (!candidate.matches(target ?? "")) {
        return false;
      }
      if (ancestor === undefined) {
        return true;
      }
      for (let at = candidate.parentElement; at; at = at.parentElement) {
        if (at.matches(ancestor)) {
          return true;
        }
      }
      return false;
    });
  };
  return {
    get activeElement() {
      return active;
    },
    set activeElement(value) {
      active = value;
    },
    addEventListener: (type, handler) => {
      handlers.set(type, [...(handlers.get(type) ?? []), handler]);
    },
    body,
    dispatch: (type, event = {}) => {
      for (const handler of handlers.get(type) ?? []) {
        handler(event);
      }
    },
    documentElement,
    element,
    querySelector: (selector) => querySelectorAll(selector)[0] ?? null,
    querySelectorAll,
  };
};

/** The pieces of a docs page the drawer module touches, RootLayout-shaped. */
const page = (options: { drawer?: boolean } = {}) => {
  const doc = fakeDocument();
  const el = doc.element;
  const toggle = el("button", ["data-blume-nav-toggle"]);
  const header = el("header", ["data-blume-header"]).append(toggle);
  const drawerLink = el("a");
  const drawer = el("aside", ["data-blume-nav-drawer"]).append(drawerLink);
  const main = el("main");
  const toc = el("aside");
  const sidebarScript = el("script");
  const grid = el("div").append(
    ...(options.drawer === false ? [] : [drawer]),
    sidebarScript,
    main,
    toc
  );
  const banner = el("div");
  // Inert for its own reasons: the drawer must neither mark nor restore it.
  const alreadyInert = el("div", ["inert"]);
  const overlay = el("button", ["data-blume-nav-toggle"]);
  const dialog = el("dialog");
  doc.body.append(banner, header, grid, alreadyInert, overlay, dialog);
  return {
    alreadyInert,
    banner,
    dialog,
    doc,
    drawer,
    drawerLink,
    grid,
    header,
    main,
    overlay,
    sidebarScript,
    toc,
    toggle,
  };
};

/** Wire the browser globals the module reads, and return handles to fire. */
const install = (doc: FakeDocument, desktop = false) => {
  const media = { matches: desktop };
  let onMediaChange: (() => void) | undefined;
  const observers: (() => void)[] = [];
  class FakeMutationObserver {
    readonly onMutate: () => void;
    constructor(onMutate: () => void) {
      this.onMutate = onMutate;
    }
    observe() {
      observers.push(this.onMutate);
    }
  }
  Object.assign(globalThis, {
    MutationObserver: FakeMutationObserver,
    document: doc,
    window: {
      matchMedia: () => ({
        addEventListener: (_type: string, onChange: () => void) => {
          onMediaChange = onChange;
        },
        get matches() {
          return media.matches;
        },
      }),
    },
  });
  syncDrawerInert();
  const setOpen = (open: boolean) => {
    if (open) {
      doc.documentElement.setAttribute(OPEN, "");
    } else {
      doc.documentElement.removeAttribute(OPEN);
    }
    for (const observer of observers) {
      observer();
    }
  };
  const crossBreakpoint = (matches: boolean) => {
    media.matches = matches;
    onMediaChange?.();
  };
  return { crossBreakpoint, setOpen };
};

afterEach(() => {
  for (const name of ["MutationObserver", "document", "window"]) {
    Reflect.deleteProperty(globalThis, name);
  }
});

describe("syncDrawerInert", () => {
  it("keeps the closed drawer out of the tab order below lg", () => {
    const { doc, drawer, toggle } = page();
    install(doc);
    expect(drawer.inert).toBe(true);
    expect(drawer.getAttribute("aria-hidden")).toBe("true");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("makes the page behind the open drawer inert, but not the header or overlay", () => {
    const parts = page();
    const { setOpen } = install(parts.doc);
    setOpen(true);
    expect(parts.drawer.inert).toBe(false);
    expect(parts.drawer.hasAttribute("aria-hidden")).toBe(false);
    expect(parts.toggle.getAttribute("aria-expanded")).toBe("true");
    for (const behind of [parts.main, parts.toc, parts.banner, parts.dialog]) {
      expect(behind.hasAttribute("inert")).toBe(true);
    }
    for (const live of [
      parts.header,
      parts.overlay,
      parts.sidebarScript,
      parts.drawer,
      parts.grid,
    ]) {
      expect(live.hasAttribute("inert")).toBe(false);
    }
    // Inert before the drawer opened: left alone, and left unmarked.
    expect(parts.alreadyInert.hasAttribute(BACKDROP)).toBe(false);
  });

  it("restores the page on close and hands focus back to the toggle", () => {
    const parts = page();
    const { setOpen } = install(parts.doc);
    setOpen(true);
    parts.drawerLink.focus();
    setOpen(false);
    expect(parts.main.hasAttribute("inert")).toBe(false);
    expect(parts.doc.querySelectorAll(`[${BACKDROP}]`)).toEqual([]);
    expect(parts.alreadyInert.hasAttribute("inert")).toBe(true);
    expect(parts.doc.activeElement).toBe(parts.toggle);
    expect(parts.drawer.inert).toBe(true);
  });

  it("returns focus from the overlay's close button, which disappears", () => {
    const parts = page();
    const { setOpen } = install(parts.doc);
    setOpen(true);
    parts.overlay.focus();
    setOpen(false);
    expect(parts.doc.activeElement).toBe(parts.toggle);
  });

  it("leaves focus alone when it isn't in the drawer", () => {
    const parts = page();
    const { setOpen } = install(parts.doc);
    setOpen(true);
    parts.doc.activeElement = parts.doc.body;
    setOpen(false);
    expect(parts.doc.activeElement).toBe(parts.doc.body);
  });

  it("closes on Escape unless a dialog has it", () => {
    const parts = page();
    const { setOpen } = install(parts.doc);
    setOpen(true);
    parts.doc.dispatch("keydown", { key: "Tab" });
    expect(parts.doc.documentElement.hasAttribute(OPEN)).toBe(true);
    parts.dialog.setAttribute("open", "");
    parts.doc.dispatch("keydown", { key: "Escape" });
    expect(parts.doc.documentElement.hasAttribute(OPEN)).toBe(true);
    parts.dialog.removeAttribute("open");
    parts.doc.dispatch("keydown", { key: "Escape" });
    expect(parts.doc.documentElement.hasAttribute(OPEN)).toBe(false);
    expect(parts.main.hasAttribute("inert")).toBe(false);
    expect(parts.doc.activeElement).toBe(parts.toggle);
    expect(parts.toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("ignores Escape while the drawer is closed", () => {
    const parts = page();
    install(parts.doc);
    parts.doc.dispatch("keydown", { key: "Escape" });
    expect(parts.doc.activeElement).toBe(parts.doc.body);
  });

  it("treats the drawer as the static sidebar at lg", () => {
    const parts = page();
    const { crossBreakpoint, setOpen } = install(parts.doc, true);
    expect(parts.drawer.inert).toBe(false);
    setOpen(true);
    expect(parts.main.hasAttribute("inert")).toBe(false);
    expect(parts.toggle.getAttribute("aria-expanded")).toBe("false");
    parts.drawerLink.focus();
    setOpen(false);
    // The toggle is hidden at lg: focus stays where it was.
    expect(parts.doc.activeElement).toBe(parts.drawerLink);
    // Crossing below lg re-syncs through the media listener.
    crossBreakpoint(false);
    expect(parts.drawer.inert).toBe(true);
  });

  it("re-syncs the swapped-in page after a client-router navigation", () => {
    const parts = page();
    install(parts.doc);
    parts.drawer.inert = false;
    parts.doc.dispatch("astro:after-swap");
    expect(parts.drawer.inert).toBe(true);
  });

  it("only clears leftovers on a page without a drawer", () => {
    const parts = page({ drawer: false });
    const { setOpen } = install(parts.doc);
    parts.main.setAttribute("inert", "");
    parts.main.setAttribute(BACKDROP, "");
    setOpen(true);
    expect(parts.main.hasAttribute("inert")).toBe(false);
    expect(parts.toggle.getAttribute("aria-expanded")).toBe("true");
  });
});
