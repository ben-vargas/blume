import { describe, expect, it } from "bun:test";

import { asSentence } from "../src/openapi/sentence.ts";

describe("asSentence", () => {
  it("closes title-like prose with a period", () => {
    expect(asSentence("Get a flag")).toBe("Get a flag.");
  });

  it("leaves prose that already ends a sentence alone", () => {
    for (const text of [
      "Done.",
      "Really?",
      "Stop!",
      "And so on…",
      'He said "done."',
      "(See the guide.)",
      "完了。",
    ]) {
      expect(asSentence(text)).toBe(text);
    }
  });

  it("keeps empty prose empty", () => {
    expect(asSentence("")).toBe("");
  });
});
