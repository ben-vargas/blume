import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import { CAPTCHA_SCRIPTS, createCaptchaClient } from "../src/captcha/client.ts";
import type { HcaptchaApi, TurnstileApi } from "../src/captcha/client.ts";
import { hcaptcha, turnstile } from "../src/captcha/index.ts";
import { captchaSettings } from "../src/captcha/schema.ts";
import { verifyCaptcha } from "../src/captcha/verify.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";

describe("captcha adapters", () => {
  it("return plain descriptors naming their secret key", () => {
    expect(turnstile({ siteKey: "0x4" })).toStrictEqual({
      kind: "turnstile",
      options: { siteKey: "0x4" },
      requiredSecrets: ["TURNSTILE_SECRET_KEY"],
      runtimeDeps: [],
    });
    expect(hcaptcha({ siteKey: "10000000" }).requiredSecrets).toStrictEqual([
      "HCAPTCHA_SECRET_KEY",
    ]);
  });

  it("validate as ai.assistant.captcha, and hand the browser the site key only", () => {
    const { assistant } = blumeConfigSchema.parse({
      ai: {
        assistant: { captcha: turnstile({ siteKey: "0x4" }), enabled: true },
      },
    }).ai;
    expect(assistant?.captcha).toStrictEqual(turnstile({ siteKey: "0x4" }));
    expect(captchaSettings(hcaptcha({ siteKey: "10000000" }))).toStrictEqual({
      kind: "hcaptcha",
      siteKey: "10000000",
    });
  });

  it("point anything else at blume/captcha, and keep option errors", () => {
    for (const captcha of [true, "turnstile", { kind: "recaptcha" }]) {
      const result = blumeConfigSchema.safeParse({
        ai: { assistant: { captcha, enabled: true } },
      });
      expect(result.error?.issues[0]?.message).toContain('"blume/captcha"');
    }
    const empty = blumeConfigSchema.safeParse({
      ai: { assistant: { captcha: turnstile({ siteKey: "" }), enabled: true } },
    });
    expect(empty.error?.issues[0]?.path).toStrictEqual([
      "ai",
      "assistant",
      "captcha",
      "options",
      "siteKey",
    ]);
  });
});

/** A siteverify stub answering `reply`, recording what it was sent. */
/** What a siteverify stub answers. */
interface SiteverifyReply {
  "error-codes"?: string[];
  success?: boolean;
}

const siteverify = (reply: SiteverifyReply, status = 200) => {
  const calls: { body: URLSearchParams; url: string }[] = [];
  const stub = (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      body: new URLSearchParams(String(init?.body)),
      url: String(url),
    });
    return Promise.resolve(Response.json(reply, { status }));
  };
  // SAFETY: verifyCaptcha only calls `fetch(url, init)`, which the stub serves.
  return { calls, fetch: stub as typeof fetch };
};

/** The route's context for a reader at `address`. */
const reader = (address?: string) => ({
  clientAddress: address,
  request: new Request("https://docs.example.com/api/ask"),
});

describe(verifyCaptcha, () => {
  let warn = spyOn(console, "warn");
  let error = spyOn(console, "error");

  beforeEach(() => {
    warn = spyOn(console, "warn").mockImplementation(() => {});
    error = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it("confirms a Turnstile token with the reader's address", async () => {
    const stub = siteverify({ success: true });
    expect(
      await verifyCaptcha(
        turnstile({ siteKey: "0x4" }),
        "tok",
        reader("1.2.3.4"),
        {
          fetch: stub.fetch,
          secret: "sec",
        }
      )
    ).toBe(true);
    expect(stub.calls[0]?.url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    );
    expect(Object.fromEntries(stub.calls[0]?.body ?? [])).toStrictEqual({
      remoteip: "1.2.3.4",
      response: "tok",
      secret: "sec",
    });
  });

  it("sends hCaptcha its site key, and leaves out an unknown address", async () => {
    const stub = siteverify({ success: true });
    await verifyCaptcha(hcaptcha({ siteKey: "10000000" }), "tok", reader(), {
      fetch: stub.fetch,
      secret: "sec",
    });
    expect(stub.calls[0]?.url).toBe("https://api.hcaptcha.com/siteverify");
    expect(Object.fromEntries(stub.calls[0]?.body ?? [])).toStrictEqual({
      response: "tok",
      secret: "sec",
      sitekey: "10000000",
    });
  });

  it("refuses a missing or oversized token without asking", async () => {
    const stub = siteverify({ success: true });
    const check = (token?: string) =>
      verifyCaptcha(turnstile({ siteKey: "0x4" }), token, reader(), {
        fetch: stub.fetch,
        secret: "sec",
      });
    expect(await check()).toBe(false);
    expect(await check("x".repeat(4097))).toBe(false);
    expect(stub.calls).toHaveLength(0);
  });

  it("refuses, and logs why, when the provider says no or can't be reached", async () => {
    const refused = siteverify({
      "error-codes": ["invalid-input-response"],
      success: false,
    });
    const adapter = turnstile({ siteKey: "0x4" });
    expect(
      await verifyCaptcha(adapter, "tok", reader(), {
        fetch: refused.fetch,
        secret: "s",
      })
    ).toBe(false);
    expect(warn.mock.calls[0]?.[1]).toStrictEqual(["invalid-input-response"]);
    const bare = siteverify({}, 502);
    expect(
      await verifyCaptcha(adapter, "tok", reader(), {
        fetch: bare.fetch,
        secret: "s",
      })
    ).toBe(false);
    expect(warn.mock.calls[1]?.[1]).toBe(502);
    // SAFETY: a fetch that fails the way an unreachable host does.
    const down = ((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.reject(new Error("offline"))) as typeof fetch;
    expect(
      await verifyCaptcha(adapter, "tok", reader(), {
        fetch: down,
        secret: "s",
      })
    ).toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
  });
});

// A hand-rolled DOM for the browser client (see fake-dom.ts for why not
// happy-dom): script tags whose load a test fires, and a body to mount in.

type Listener = () => void;

/** The `data-*` properties the client sets. */
interface FakeDataset {
  blumeCaptcha?: string;
}

class FakeNode {
  className = "";
  isConnected = false;
  src = "";
  async = false;
  readonly attrs = new Map<string, string>();
  readonly children: FakeNode[] = [];
  readonly listeners = new Map<string, Listener[]>();
  readonly tag: string;
  /** `dataset`, writing through to `data-*` attributes. */
  readonly dataset: FakeDataset;

  constructor(tag: string) {
    this.tag = tag;
    this.dataset = new Proxy<FakeDataset>(
      {},
      {
        set: (_target, key, value: string) => {
          this.attrs.set(
            `data-${String(key).replaceAll(/[A-Z]/gu, (char) => `-${char.toLowerCase()}`)}`,
            value
          );
          return true;
        },
      }
    );
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  append(child: FakeNode): void {
    child.isConnected = true;
    this.children.push(child);
  }

  fire(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }
}

let head = new FakeNode("head");
let body = new FakeNode("body");

/** The fake window's provider globals. */
interface ProviderGlobals {
  hcaptcha?: HcaptchaApi;
  turnstile?: TurnstileApi;
}

let providers: ProviderGlobals = {};

beforeEach(() => {
  head = new FakeNode("head");
  body = new FakeNode("body");
  providers = {};
  Object.assign(globalThis, {
    document: {
      body,
      createElement: (tag: string) => new FakeNode(tag),
      head,
    },
    window: providers,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "window");
});

/** Load the script the client appended last, as the browser would. */
const loadScript = (): FakeNode | undefined => {
  const tag = head.children.at(-1);
  tag?.fire("load");
  return tag;
};

/** A Turnstile API that issues numbered tokens, or fails on demand. */
const fakeTurnstile = () => {
  const log: string[] = [];
  let callbacks:
    | { callback: (token: string) => void; fail: () => void }
    | undefined;
  let fail = false;
  const api: TurnstileApi = {
    execute: (widget) => {
      log.push(`execute ${widget}`);
      if (fail) {
        callbacks?.fail();
      } else {
        callbacks?.callback(`token-${log.length}`);
      }
    },
    render: (_container, options) => {
      log.push(
        `render ${options.sitekey} ${options.execution} ${options.appearance}`
      );
      callbacks = {
        callback: options.callback,
        fail: options["error-callback"],
      };
      return `w${log.length}`;
    },
    reset: (widget) => {
      log.push(`reset ${widget}`);
    },
  };
  return {
    api,
    failNext: () => {
      fail = true;
    },
    log,
  };
};

describe(createCaptchaClient, () => {
  it("loads Turnstile with the first question, then reuses one widget", async () => {
    const turnstileApi = fakeTurnstile();
    const token = createCaptchaClient();
    const settings = { kind: "turnstile", siteKey: "1x00" } as const;
    const first = token(settings);
    const [script] = head.children;
    expect(script?.src).toBe(CAPTCHA_SCRIPTS.turnstile);
    expect(script?.async).toBe(true);
    providers.turnstile = turnstileApi.api;
    loadScript();
    expect(await first).toBe("token-2");
    expect(await token(settings)).toBe("token-4");
    // One script, one container, one widget.
    expect(head.children).toHaveLength(1);
    expect(body.children).toHaveLength(1);
    expect(body.children[0]?.attrs.get("data-blume-captcha")).toBe("");
    expect(turnstileApi.log).toStrictEqual([
      "render 1x00 execute interaction-only",
      "execute w1",
      "reset w1",
      "execute w1",
    ]);
  });

  it("rejects when Turnstile fails", async () => {
    const turnstileApi = fakeTurnstile();
    providers.turnstile = turnstileApi.api;
    turnstileApi.failNext();
    const token = createCaptchaClient();
    const pending = token({ kind: "turnstile", siteKey: "1x00" });
    loadScript();
    await expect(pending).rejects.toThrow("The Turnstile check failed.");
  });

  it("runs hCaptcha invisibly, and mounts again after a swap took the container", async () => {
    const calls: string[] = [];
    let issued = 0;
    providers.hcaptcha = {
      execute: (widget) => {
        calls.push(`execute ${widget}`);
        issued += 1;
        return Promise.resolve({ response: `h-${issued}` });
      },
      render: (_container, options) => {
        calls.push(`render ${options.sitekey} ${options.size}`);
        return `h${calls.length}`;
      },
      reset: (widget) => {
        calls.push(`reset ${widget}`);
      },
    };
    const token = createCaptchaClient();
    const settings = { kind: "hcaptcha", siteKey: "10000000" } as const;
    const first = token(settings);
    loadScript();
    expect(await first).toBe("h-1");
    expect(await token(settings)).toBe("h-2");
    // A client-router swap replaces <body>, container and all.
    const [container] = body.children;
    if (container) {
      container.isConnected = false;
    }
    expect(await token(settings)).toBe("h-3");
    expect(body.children).toHaveLength(2);
    expect(calls).toStrictEqual([
      "render 10000000 invisible",
      "execute h1",
      "reset h1",
      "execute h1",
      "render 10000000 invisible",
      "execute h5",
    ]);
  });

  it("tries the script again after it failed to load", async () => {
    const token = createCaptchaClient();
    const settings = { kind: "turnstile", siteKey: "1x00" } as const;
    const first = token(settings);
    head.children[0]?.fire("error");
    await expect(first).rejects.toThrow("The turnstile script didn't load.");
    const second = token(settings);
    expect(head.children).toHaveLength(2);
    loadScript();
    // Loaded, but the provider's global never appeared.
    await expect(second).rejects.toThrow(
      "The turnstile script loaded without its API."
    );
  });
});
