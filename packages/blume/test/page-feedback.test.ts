import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import type { TrackProps } from "../src/components/layout/analytics-client.ts";
import {
  COMMENT_MAX_LENGTH,
  initFeedback,
} from "../src/components/layout/page-feedback.ts";

// A hand-rolled DOM for the rating (see fake-dom.ts for why not happy-dom):
// just the elements `initFeedback` reads, found by their data attributes.

/** The slice of a submit event the module uses. */
interface FakeEvent {
  defaultPrevented: boolean;
  preventDefault: () => void;
}

type Listener = (event: FakeEvent) => void;

/** `element.classList`, as far as the module uses it. */
interface FakeClassList {
  add: (name: string) => void;
  remove: (name: string) => void;
}

/** `element.dataset`, as far as the module reads it. */
interface FakeDataset {
  feedbackValue?: string;
}

class FakeEl {
  classes: Set<string>;
  focused = false;
  hidden = false;
  listeners = new Map<string, Listener[]>();
  value = "";
  readonly children: FakeEl[] = [];
  readonly attrs: Record<string, string>;

  constructor(attrs: Record<string, string> = {}, classes: string[] = []) {
    this.attrs = attrs;
    this.classes = new Set(classes);
  }

  get classList(): FakeClassList {
    return {
      add: (name) => {
        this.classes.add(name);
      },
      remove: (name) => {
        this.classes.delete(name);
      },
    };
  }

  get dataset(): FakeDataset {
    return { feedbackValue: this.attrs["data-feedback-value"] };
  }

  append(...children: FakeEl[]): FakeEl {
    this.children.push(...children);
    return this;
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  fire(type: string): boolean {
    const event: FakeEvent = {
      defaultPrevented: false,
      preventDefault: () => {
        event.defaultPrevented = true;
      },
    };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
    return event.defaultPrevented;
  }

  focus(): void {
    this.focused = true;
  }

  descendants(): FakeEl[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  querySelectorAll(selector: string): FakeEl[] {
    const name = selector === "textarea" ? "textarea" : selector.slice(1, -1);
    return this.descendants().filter((node) => name in node.attrs);
  }

  querySelector(selector: string): FakeEl | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

/** One analytics event, as the `blume:track` CustomEvent carries it. */
interface Sent {
  event: string;
  props: TrackProps;
}

let sent: Sent[] = [];
let page = new FakeEl();

/** The widget's markup: the rating, the thanks line, and maybe the form. */
const widget = (comments: boolean) => {
  const yes = new FakeEl({ "data-feedback-value": "yes" });
  const no = new FakeEl({ "data-feedback-value": "no" });
  const actions = new FakeEl({ "data-feedback-actions": "" }).append(yes, no);
  const thanks = new FakeEl({ "data-feedback-thanks": "" }, ["hidden"]);
  const textarea = new FakeEl({ textarea: "" });
  const form = new FakeEl({ "data-feedback-form": "" }).append(textarea);
  form.hidden = true;
  const root = new FakeEl({ "data-blume-page-feedback": "" }).append(
    actions,
    thanks,
    ...(comments ? [form] : [])
  );
  page = new FakeEl().append(root);
  return { actions, form, no, textarea, thanks, yes };
};

beforeEach(() => {
  sent = [];
  page = new FakeEl();
  Object.assign(globalThis, {
    document: {
      querySelector: (selector: string) => page.querySelector(selector),
      title: "Install - Docs",
    },
    location: { pathname: "/docs/install" },
    window: {
      dispatchEvent: (event: CustomEvent<Sent>) => {
        sent.push(event.detail);
        return true;
      },
    },
  });
});

afterEach(() => {
  for (const name of ["document", "location", "window"]) {
    Reflect.deleteProperty(globalThis, name);
  }
});

describe(initFeedback, () => {
  it("does nothing on a page without the rating", () => {
    initFeedback();
    expect(sent).toStrictEqual([]);
  });

  it("sends the rating and thanks the reader", () => {
    const { actions, thanks, yes } = widget(false);
    initFeedback();
    yes.fire("click");
    expect(sent).toStrictEqual([
      {
        event: "feedback",
        props: {
          helpful: "yes",
          path: "/docs/install",
          title: "Install - Docs",
        },
      },
    ]);
    expect(actions.classes.has("hidden")).toBe(true);
    expect(thanks.classes.has("hidden")).toBe(false);
    expect(thanks.focused).toBe(true);
  });

  it("offers the comment box after the rating, and sends a comment with it", () => {
    const { form, no, textarea, thanks } = widget(true);
    initFeedback();
    no.fire("click");
    expect(form.hidden).toBe(false);
    expect(thanks.classes.has("hidden")).toBe(false);

    textarea.value = "  The install steps skip Windows.  ";
    thanks.focused = false;
    expect(form.fire("submit")).toBe(true);
    expect(sent.at(-1)).toStrictEqual({
      event: "feedback_comment",
      props: {
        comment: "The install steps skip Windows.",
        helpful: "no",
        path: "/docs/install",
        title: "Install - Docs",
      },
    });
    expect(form.hidden).toBe(true);
    expect(thanks.focused).toBe(true);
  });

  it("sends nothing for an empty comment, and caps a long one", () => {
    const { form, textarea, yes } = widget(true);
    initFeedback();
    yes.fire("click");
    textarea.value = "   ";
    form.fire("submit");
    expect(sent.map((entry) => entry.event)).toStrictEqual(["feedback"]);

    textarea.value = "x".repeat(COMMENT_MAX_LENGTH + 10);
    form.fire("submit");
    expect(sent.at(-1)?.props.comment).toHaveLength(COMMENT_MAX_LENGTH);
  });

  it("gets by without a textarea or a thanks line", () => {
    const { form, textarea, thanks, yes } = widget(true);
    form.children.splice(form.children.indexOf(textarea), 1);
    thanks.attrs["data-gone"] = "";
    Reflect.deleteProperty(thanks.attrs, "data-feedback-thanks");
    initFeedback();
    yes.fire("click");
    form.fire("submit");
    expect(sent.map((entry) => entry.event)).toStrictEqual(["feedback"]);
  });
});
