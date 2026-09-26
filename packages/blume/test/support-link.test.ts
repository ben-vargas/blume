import { describe, expect, it } from "bun:test";

import {
  MAX_TRANSCRIPT_CHARS,
  newThreadId,
  supportHref,
} from "../src/components/islands/support-link.ts";

const context = {
  ai: "AI",
  messages: [
    { content: "How do I deploy?", role: "user" as const },
    { content: "Run blume build & deploy.", role: "assistant" as const },
  ],
  subject: "Question from the docs",
  thread: "0123456789abcdef",
  you: "You",
};

describe(supportHref, () => {
  it("starts an email with the conversation, spaces as %20", () => {
    const href = supportHref("mailto:help@example.com", context);
    expect(href).toBe(
      `mailto:help@example.com?subject=Question%20from%20the%20docs&body=${encodeURIComponent(
        "You: How do I deploy?\n\nAI: Run blume build & deploy.\n\n(0123456789abcdef)"
      )}`
    );
    expect(href).not.toContain("+");
  });

  it("keeps an address's own query, and trims a long conversation from the start", () => {
    const long = {
      ...context,
      messages: [
        { content: "x".repeat(MAX_TRANSCRIPT_CHARS), role: "user" as const },
        { content: "latest", role: "assistant" as const },
      ],
    };
    const href = supportHref(
      "mailto:help@example.com?cc=docs@example.com",
      long
    );
    expect(href).toStartWith(
      "mailto:help@example.com?cc=docs@example.com&subject="
    );
    const body = decodeURIComponent(href.slice(href.indexOf("body=") + 5));
    expect(body.startsWith("…")).toBe(true);
    expect(body).toContain("AI: latest");
  });

  it("adds the thread to a URL or a page on the site", () => {
    expect(
      supportHref("https://example.com/help?topic=docs#form", context)
    ).toBe("https://example.com/help?topic=docs&thread=0123456789abcdef#form");
    expect(supportHref("/support", context)).toBe(
      "/support?thread=0123456789abcdef"
    );
  });
});

describe(newThreadId, () => {
  it("makes a fresh 16-character hex id each time", () => {
    const id = newThreadId();
    expect(id).toMatch(/^[\da-f]{16}$/u);
    expect(newThreadId()).not.toBe(id);
  });
});
