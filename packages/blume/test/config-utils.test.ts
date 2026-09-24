import { describe, expect, it } from "bun:test";

import { defineComponents } from "../src/core/define-components.ts";
import type { ComponentOverrides } from "../src/core/define-components.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import { serverFeatures } from "../src/core/server-features.ts";

describe("serverFeatures", () => {
  it("is empty for a default (fully static) config", () => {
    expect(serverFeatures(blumeConfigSchema.parse({}))).toStrictEqual([]);
  });

  it("lists the assistant when it is enabled", () => {
    const config = blumeConfigSchema.parse({
      ai: { assistant: { enabled: true } },
    });
    expect(serverFeatures(config)).toStrictEqual(["Assistant"]);
  });

  it("ignores the assistant when present but disabled", () => {
    const config = blumeConfigSchema.parse({
      ai: { assistant: { enabled: false } },
    });
    expect(serverFeatures(config)).toStrictEqual([]);
  });

  it("keeps the assistant static when an external endpoint is configured", () => {
    const config = blumeConfigSchema.parse({
      ai: {
        assistant: {
          enabled: true,
          endpoint: "https://api.example.com/v1/docs/ask",
        },
      },
    });
    expect(serverFeatures(config)).toStrictEqual([]);
  });
});

describe("ask retrieval config", () => {
  it("stays undefined when not configured, so generated endpoints keep tracking the built-in defaults", () => {
    const config = blumeConfigSchema.parse({
      ai: { assistant: { enabled: true } },
    });
    expect(config.ai.assistant?.retrieval).toBeUndefined();
  });

  it("carries only the fields the user set", () => {
    const config = blumeConfigSchema.parse({
      ai: { assistant: { enabled: true, retrieval: { maxResults: 3 } } },
    });
    expect(config.ai.assistant?.retrieval).toStrictEqual({ maxResults: 3 });
  });
});

describe("defineComponents", () => {
  it("returns the overrides unchanged (identity helper)", () => {
    const overrides: ComponentOverrides = {
      layout: { Header: "./Header.astro" },
      mdx: { Callout: "./Callout.astro" },
    };
    expect(defineComponents(overrides)).toBe(overrides);
  });
});

describe("toc config", () => {
  it("defaults to enabled, H2–H3", () => {
    expect(blumeConfigSchema.parse({}).toc).toStrictEqual({
      enabled: true,
      maxLevel: 3,
      minLevel: 2,
    });
  });

  it("disables the toc with `false`", () => {
    expect(blumeConfigSchema.parse({ toc: false }).toc.enabled).toBe(false);
  });

  it("narrows the heading range from an object", () => {
    expect(
      blumeConfigSchema.parse({
        toc: { maxHeadingLevel: 4, minHeadingLevel: 2 },
      }).toc
    ).toStrictEqual({ enabled: true, maxLevel: 4, minLevel: 2 });
  });
});
