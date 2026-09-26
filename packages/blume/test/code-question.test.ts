import { describe, expect, it } from "bun:test";

import {
  MAX_ATTACHED_CODE,
  splitCode,
  withCode,
} from "../src/components/islands/code-question.ts";

describe(withCode, () => {
  it("folds the code into the question as a fenced block", () => {
    expect(
      withCode("What does this do?", {
        language: "ts",
        source: "listen(3000);\n\n",
        title: "server.ts",
      })
    ).toBe("What does this do?\n\n```ts\nlisten(3000);\n```");
  });

  it("fences past any backticks in the code, and caps a long block", () => {
    const markdown = "Use ```ts fences``` or ````four````.";
    expect(withCode("Q", { language: "md", source: markdown })).toBe(
      `Q\n\n\`\`\`\`\`md\n${markdown}\n\`\`\`\`\``
    );
    const long = withCode("Q", {
      language: "",
      source: "x".repeat(MAX_ATTACHED_CODE + 10),
    });
    expect(long).toBe(
      `Q\n\n\`\`\`\n${"x".repeat(MAX_ATTACHED_CODE)}\n…\n\`\`\``
    );
  });
});

describe(splitCode, () => {
  it("splits a question with code back into the words and the block", () => {
    const content = withCode("Why?", {
      language: "py",
      source: "print(1)\n```",
    });
    expect(splitCode(content)).toStrictEqual({
      code: { language: "py", source: "print(1)\n```" },
      text: "Why?",
    });
  });

  it("leaves a plain question whole", () => {
    expect(splitCode("How do I deploy?")).toStrictEqual({
      text: "How do I deploy?",
    });
    // A fence that isn't the message's tail stays text.
    expect(splitCode("```ts\nx\n```\n\nthen what?").code).toBeUndefined();
  });
});
