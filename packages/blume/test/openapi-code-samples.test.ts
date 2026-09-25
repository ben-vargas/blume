import { describe, expect, it } from "bun:test";

import { asyncSampleLanguages } from "../src/components/openapi/async-snippets.ts";
import { customCodeSamples } from "../src/components/openapi/code-samples.ts";

/**
 * Tests for reading a spec's hand-written `x-codeSamples`
 * (`src/components/openapi/code-samples.ts`).
 */

describe(customCodeSamples, () => {
  it("reads x-codeSamples, labelled by the entry or its language", () => {
    expect(
      customCodeSamples({
        "x-codeSamples": [
          { label: "SDK", lang: "TypeScript", source: "await sdk.list();\n" },
          { lang: "javascript", source: "fetch(url);" },
          { lang: "bash", source: "planter list" },
          { lang: "Elixir", source: "Planter.list()" },
          { label: "  ", lang: "go", source: "planter.List()" },
        ],
      })
    ).toEqual([
      { key: "x-0", label: "SDK", lang: "ts", source: "await sdk.list();" },
      { key: "x-1", label: "JavaScript", lang: "js", source: "fetch(url);" },
      { key: "x-2", label: "Shell", lang: "bash", source: "planter list" },
      { key: "x-3", label: "Elixir", lang: "elixir", source: "Planter.list()" },
      { key: "x-4", label: "Go", lang: "go", source: "planter.List()" },
    ]);
  });

  it("falls back to the older x-code-samples spelling", () => {
    expect(
      customCodeSamples({
        "x-code-samples": [{ lang: "python", source: "sdk.list()" }],
      }).map((sample) => sample.label)
    ).toEqual(["Python"]);
  });

  it("keeps shared labels apart by language, then by number", () => {
    const labels = customCodeSamples({
      "x-codeSamples": [
        { label: "List plants", lang: "bash", source: "a" },
        { label: "List plants", lang: "javascript", source: "b" },
        { label: "List plants", lang: "javascript", source: "c" },
        { lang: "ruby", source: "d" },
        { lang: "ruby", source: "e" },
      ],
    }).map((sample) => sample.label);
    expect(labels).toEqual([
      "List plants · Shell",
      "List plants · JavaScript",
      "List plants · JavaScript (2)",
      "Ruby",
      "Ruby (2)",
    ]);
  });

  it("skips malformed entries and a non-array", () => {
    expect(customCodeSamples({})).toEqual([]);
    expect(customCodeSamples({ "x-codeSamples": { lang: "go" } })).toEqual([]);
    expect(
      customCodeSamples({
        "x-codeSamples": [
          null,
          "curl x",
          { lang: "go" },
          { source: "x" },
          { label: 3, lang: "go", source: "x" },
          { lang: "go", source: "ok" },
        ],
      }).map((sample) => sample.source)
    ).toEqual(["ok"]);
  });
});

describe("codeSamples: false", () => {
  it("generates no event samples either", () => {
    expect(asyncSampleLanguages(false, "ws")).toEqual([]);
    expect(asyncSampleLanguages([], "ws").map((tool) => tool.id)).toEqual([
      "wscat",
      "js",
    ]);
  });
});
