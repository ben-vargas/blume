import { describe, expect, it } from "bun:test";

import { readCappedBody, readCappedText } from "../src/core/request-body.ts";

const post = (body?: BodyInit, headers?: HeadersInit): Request =>
  new Request("http://docs.local/api", { body, headers, method: "POST" });

/** A chunked body: `count` chunks of `chunk`, with no declared length. */
const streamed = (chunk: string, count: number) => {
  let sent = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
    pull(controller) {
      if (sent === count) {
        controller.close();
        return;
      }
      sent += 1;
      controller.enqueue(new TextEncoder().encode(chunk));
    },
  });
  // SAFETY: Bun's RequestInit types omit `duplex`, which a streamed request
  // body needs.
  const init = { body: stream, duplex: "half", method: "POST" } as RequestInit;
  return {
    get cancelled() {
      return cancelled;
    },
    request: new Request("http://docs.local/api", init),
  };
};

describe("readCappedBody", () => {
  it("reads a body within the cap", async () => {
    const bytes = await readCappedBody(post("hello"), 5);
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });

  it("refuses a declared length over the cap without reading", async () => {
    const request = post("hello", { "content-length": "5" });
    expect(await readCappedBody(request, 4)).toBeUndefined();
    expect(request.bodyUsed).toBe(false);
  });

  it("treats a request with no body as empty", async () => {
    const bytes = await readCappedBody(post(), 4);
    expect(bytes?.byteLength).toBe(0);
  });

  it("joins a chunked body within the cap", async () => {
    const body = streamed("abc", 3);
    const bytes = await readCappedBody(body.request, 9);
    expect(new TextDecoder().decode(bytes)).toBe("abcabcabc");
  });

  it("cancels a chunked body once it passes the cap", async () => {
    const body = streamed("abc", 100);
    expect(await readCappedBody(body.request, 8)).toBeUndefined();
    expect(body.cancelled).toBe(true);
  });
});

describe("readCappedText", () => {
  it("decodes a body within the cap as UTF-8", async () => {
    expect(await readCappedText(post('{"é":1}'), 64)).toBe('{"é":1}');
  });

  it("is undefined over the cap", async () => {
    expect(await readCappedText(post("toolong"), 3)).toBeUndefined();
  });
});
