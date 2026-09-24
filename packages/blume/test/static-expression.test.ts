import { describe, expect, it } from "bun:test";

import { downlevelComponents } from "../src/ai/component-markdown.ts";
import type { EvaluatedValue } from "../src/ai/component-markdown.ts";
import { readStaticExpression } from "../src/ai/static-expression.ts";

/** The value an expression reads as; fails the test when it isn't static. */
const read = (
  raw: string,
  frontmatter?: Record<string, EvaluatedValue>
): EvaluatedValue => {
  const result = readStaticExpression(raw, frontmatter);
  expect(result.ok, `expected ${raw} to be static`).toBe(true);
  return result.value;
};

/** Whether an expression is rejected as not static. */
const rejected = (
  raw: string,
  frontmatter?: Record<string, EvaluatedValue>
): boolean => !readStaticExpression(raw, frontmatter).ok;

const LS = String.fromCodePoint(0x20_28);

describe("readStaticExpression literals", () => {
  it("reads strings, numbers, booleans, null, and undefined", () => {
    expect(read('"a"')).toBe("a");
    expect(read("'b'")).toBe("b");
    expect(read("`c`")).toBe("c");
    expect(read("42")).toBe(42);
    expect(read("-1")).toBe(-1);
    expect(read("- 2.5")).toBe(-2.5);
    expect(read("- -3")).toBe(3);
    expect(read("0x1F")).toBe(31);
    expect(read("0o17")).toBe(15);
    expect(read("0b101")).toBe(5);
    expect(read("1_000")).toBe(1000);
    expect(read(".5")).toBe(0.5);
    expect(read("5.")).toBe(5);
    expect(read("1e3")).toBe(1000);
    expect(read("0")).toBe(0);
    expect(read("true")).toBe(true);
    expect(read("false")).toBe(false);
    expect(read("null")).toBeNull();
    expect(read("undefined")).toBeUndefined();
    expect(read("  7  ")).toBe(7);
  });

  it("reads nested object and array literals", () => {
    expect(read("{ a: 1, \"b\": [2, 'x'], 3: true, }")).toEqual({
      3: true,
      a: 1,
      b: [2, "x"],
    });
    expect(read("{}")).toEqual({});
    expect(read("[]")).toEqual([]);
    expect(read("[1, [2, { c: null }],]")).toEqual([1, [2, { c: null }]]);
    // Reserved words are fine as keys, as in any object literal.
    expect(read("{ default: 1, type: 'x' }")).toEqual({
      default: 1,
      type: "x",
    });
  });

  it("skips comments and whitespace", () => {
    expect(read("{\n  // The name.\n  name: /* inline */ 'n',\n}\n")).toEqual({
      name: "n",
    });
  });

  it("decodes string escapes the way JavaScript does", () => {
    expect(read(String.raw`"\n\t\r\b\f\v\0"`)).toBe("\n\t\r\b\f\v\0");
    expect(read(String.raw`"\x41\u0042\u{1F600}"`)).toBe("AB\u{1F600}");
    expect(read(String.raw`"\q\'\"\\"`)).toBe("q'\"\\");
    // A line continuation stands for nothing.
    expect(read('"a\\\nb"')).toBe("ab");
    expect(read('"a\\\r\nb"')).toBe("ab");
    expect(read('"a\\\rb"')).toBe("ab");
    expect(read(`"a\\${LS}b"`)).toBe("ab");
  });

  it("reads template literals, their substitutions included", () => {
    // oxlint-disable-next-line no-template-curly-in-string -- JavaScript source under test
    expect(read("`a ${1} ${'b'} ${[1, 2]}`")).toBe("a 1 b 1,2");
    // oxlint-disable-next-line no-template-curly-in-string -- JavaScript source under test
    expect(read("`v${frontmatter.version}`", { version: 2 })).toBe("v2");
    expect(read("`a\r\nb\rc\nd`")).toBe("a\nb\nc\nd");
    expect(read("`\\``")).toBe("`");
    expect(read("`$`")).toBe("$");
  });
});

describe("readStaticExpression front matter", () => {
  const frontmatter = {
    "0": "zero",
    date: new Date("2026-01-01T00:00:00Z"),
    list: ["a", "b"],
    n: 3,
    nested: { deep: { value: "x" } },
    title: "Hello",
    "x-y": "dash",
  } satisfies Record<string, EvaluatedValue>;

  it("resolves dot and bracketed-literal steps", () => {
    expect(read("frontmatter.title", frontmatter)).toBe("Hello");
    expect(read("frontmatter.nested.deep.value", frontmatter)).toBe("x");
    expect(read('frontmatter["x-y"]', frontmatter)).toBe("dash");
    expect(read("frontmatter[0]", frontmatter)).toBe("zero");
    expect(read("frontmatter.list[1]", frontmatter)).toBe("b");
    expect(read("frontmatter . list . length", frontmatter)).toBe(2);
    expect(read("frontmatter.title.length", frontmatter)).toBe(5);
    expect(read("frontmatter.title[0]", frontmatter)).toBe("H");
    expect(read("-frontmatter.n", frontmatter)).toBe(-3);
    expect(read("frontmatter", frontmatter)).toBe(frontmatter);
  });

  it("reads a missing key as undefined, and never an inherited member", () => {
    expect(read("frontmatter.missing", frontmatter)).toBeUndefined();
    expect(read("frontmatter.constructor", frontmatter)).toBeUndefined();
    expect(read("frontmatter.list.map", frontmatter)).toBeUndefined();
    expect(read("frontmatter.title.foo", frontmatter)).toBeUndefined();
    expect(read('frontmatter.list["01"]', frontmatter)).toBeUndefined();
    expect(rejected("frontmatter.list[01]", frontmatter)).toBe(true);
    expect(read("frontmatter.date.getTime", frontmatter)).toBeUndefined();
    expect(read("frontmatter.n.toFixed", frontmatter)).toBeUndefined();
  });

  it("rejects steps that would throw, or aren't literal", () => {
    expect(rejected("frontmatter.missing.deeper", frontmatter)).toBe(true);
    expect(rejected("frontmatter.title")).toBe(true);
    expect(rejected("frontmatter[true]", frontmatter)).toBe(true);
    expect(rejected("frontmatter[frontmatter]", frontmatter)).toBe(true);
    expect(rejected("frontmatter.", frontmatter)).toBe(true);
    expect(rejected("frontmatter[0", frontmatter)).toBe(true);
    expect(rejected('-frontmatter["x-y"]', frontmatter)).toBe(true);
  });
});

describe("readStaticExpression rejects anything that isn't literal data", () => {
  it("rejects calls, names, operators, and spreads", () => {
    for (const raw of [
      "",
      "   ",
      'process.getBuiltinModule("node:child_process").execSync("id")',
      "pageTitle()",
      "imported.props",
      "a ? b : c",
      "1 + 2",
      "--1",
      '-"5"',
      "-[1]",
      "{a}",
      "{...rest}",
      "{[key]: 1}",
      "{a: 1 b: 2}",
      "{a 1}",
      "[1 2]",
      "[,1]",
      "{ __proto__: {} }",
      '{ "__proto__": 1 }',
      // oxlint-disable-next-line no-template-curly-in-string -- JavaScript source under test
      "`${x}`",
      // oxlint-disable-next-line no-template-curly-in-string -- JavaScript source under test
      "`${1`",
      "/* unterminated",
    ]) {
      expect(rejected(raw), raw).toBe(true);
    }
  });

  it("rejects malformed numbers", () => {
    for (const raw of ["1n", "017", "1px", "1.2.3", "0x", "1__0"]) {
      expect(rejected(raw), raw).toBe(true);
    }
  });

  it("rejects malformed strings and escapes", () => {
    for (const raw of [
      '"abc',
      '"a\nb"',
      '"a\rb"',
      "`abc",
      '"\\',
      String.raw`"\1"`,
      String.raw`"\08"`,
      String.raw`"\8"`,
      String.raw`"\x4"`,
      String.raw`"\xZZ"`,
      String.raw`"\x4`,
      String.raw`"\u12"`,
      String.raw`"\u{}"`,
      String.raw`"\u{110000}"`,
      String.raw`"\u{41"`,
      String.raw`"\u{zz}"`,
    ]) {
      expect(rejected(raw), raw).toBe(true);
    }
  });
});

describe("downlevelComponents never runs an attribute expression", () => {
  it("keeps a component whose prop would run code as written", () => {
    const probe = "__blumeStaticExpressionProbe";
    const source = `<Callout title={globalThis.${probe} = "ran"}>\nBody.\n</Callout>\n`;
    expect(downlevelComponents(source)).toBe("> **Info**\n>\n> Body.\n");
    expect(probe in globalThis).toBe(false);
    const card = `<Card title={process.getBuiltinModule("node:fs").writeFileSync("x", "")} href="/a">\n  Body.\n</Card>\n`;
    expect(downlevelComponents(card)).toBe(card);
  });
});
