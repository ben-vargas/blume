import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  CLAMPED_PANEL,
  clampPanel,
  clampShift,
  installDropdownClamp,
} from "../src/components/layout/dropdown-clamp.ts";

describe("clampShift", () => {
  it("leaves a panel inside the viewport where it is", () => {
    expect(clampShift(100, 324, 390, false)).toBe(0);
  });

  it("pulls a panel back from either edge", () => {
    // The mobile version menu anchored to a mid-header trigger's end.
    expect(clampShift(-40, 184, 390, false)).toBe(48);
    // Its right-to-left mirror, past the trailing edge.
    expect(clampShift(206, 430, 390, true)).toBe(-48);
  });

  it("pins a panel wider than the viewport to its leading edge", () => {
    expect(clampShift(-100, 400, 390, false)).toBe(108);
    expect(clampShift(-100, 400, 390, true)).toBe(-18);
  });
});

/** A panel with a movable measured box and the inline style the clamp sets. */
const panelAt = (left: number, right: number) => {
  const box = { left, right };
  return {
    box,
    getBoundingClientRect: () => ({ left: box.left, right: box.right }),
    style: { translate: "" },
  };
};

type FakePanel = ReturnType<typeof panelAt>;

/** A `<details>` dropdown that answers the clamped-panel query. */
class FakeDetails {
  open = false;
  panel: FakePanel | null = null;
  querySelector(selector: string): FakePanel | null {
    return selector === CLAMPED_PANEL ? this.panel : null;
  }
}

type Handler = (event: { target: unknown }) => void;
const listeners = new Map<string, Handler>();
let openPanels: FakePanel[] = [];
let rtl = false;
const on = (type: string, handler: Handler) => listeners.set(type, handler);

beforeAll(() => {
  Object.assign(globalThis, {
    HTMLDetailsElement: FakeDetails,
    document: {
      addEventListener: on,
      documentElement: {
        clientWidth: 390,
        getAttribute: () => (rtl ? "rtl" : null),
      },
      querySelectorAll: () => openPanels,
    },
    window: { addEventListener: on },
  });
});

afterAll(() => {
  for (const name of ["HTMLDetailsElement", "document", "window"]) {
    Reflect.deleteProperty(globalThis, name);
  }
});

describe("clampPanel and installDropdownClamp", () => {
  it("shifts a panel by translate, and clears a shift it no longer needs", () => {
    const panel = panelAt(-40, 184);
    clampPanel(panel);
    expect(panel.style.translate).toBe("48px 0");
    panel.box.left = 100;
    panel.box.right = 324;
    clampPanel(panel);
    expect(panel.style.translate).toBe("");
  });

  it("clamps a dropdown's panel when it opens, and again on resize", () => {
    installDropdownClamp();
    // A second call installs nothing new.
    installDropdownClamp();
    const toggle = listeners.get("toggle");
    const resize = listeners.get("resize");

    const details = new FakeDetails();
    details.panel = panelAt(206, 430);
    rtl = true;
    // Closing, a non-dropdown target, and a dropdown without a panel are
    // left alone.
    toggle?.({ target: details });
    expect(details.panel.style.translate).toBe("");
    toggle?.({ target: null });
    details.open = true;
    toggle?.({ target: details });
    expect(details.panel.style.translate).toBe("-48px 0");
    const bare = new FakeDetails();
    bare.open = true;
    toggle?.({ target: bare });

    openPanels = [panelAt(-10, 214)];
    rtl = false;
    resize?.({ target: null });
    expect(openPanels[0]?.style.translate).toBe("18px 0");
  });
});
