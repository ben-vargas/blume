import { describe, expect, it } from "bun:test";

import { parse } from "node-html-parser";

import { htmlTree } from "../src/narration/build.ts";
import {
  alignBlocks,
  extractNarration,
  isNarratable,
  isNarrationCues,
  isNarrationManifest,
  NARRATION_MIN_CHARS,
  narrationCharsPerSecond,
  narrationLength,
  narrationMinutes,
  segmentNarration,
} from "../src/narration/script.ts";
import type { NarrationCues } from "../src/narration/script.ts";

/**
 * Tests for narration's reading script (`src/narration/script.ts`): what the
 * walker reads from a page, how it splits it into sentences, and how the
 * player lines a build's manifest up with the live page.
 */

const CUES: NarrationCues = {
  danger: "Danger.",
  info: "Info.",
  note: "Note.",
  section: "Expandable section.",
  step: "Step {n}.",
  success: "Success.",
  tab: "{title} tab.",
  tip: "Tip.",
  warning: "Warning.",
};

const extract = (html: string, cues: NarrationCues = CUES) =>
  extractNarration(
    parse(`<article>${html}</article>`).firstChild ?? parse(""),
    htmlTree,
    cues
  );

/** The reading order as text: blocks as-is, cues in brackets. */
const script = (html: string, cues: NarrationCues = CUES): string[] => {
  const result = extract(html, cues);
  return result.items.map((item) =>
    item.kind === "cue"
      ? `[${item.text}]`
      : (result.blocks[item.block]?.text ?? "")
  );
};

describe(extractNarration, () => {
  it("reads blocks in order and runs inline elements into their block", () => {
    expect(
      script(
        "<h1>Install</h1><p>Run <code>blume build</code>, then <strong>deploy</strong>.</p><ul><li>One</li><li>Two</li></ul>"
      )
    ).toEqual(["Install", "Run blume build, then deploy.", "One", "Two"]);
  });

  it("collapses whitespace and treats a line break as a space", () => {
    expect(script("<p>  Hello\n   there<br>friend  </p>")).toEqual([
      "Hello there friend",
    ]);
  });

  it("skips code, tables, media, hidden text, and marked elements", () => {
    expect(
      script(
        [
          "<p>Before.</p>",
          "<pre><code>const x = 1;</code></pre>",
          "<table><tr><td>cell</td></tr></table>",
          '<img alt="pic"><svg><text>icon</text></svg>',
          '<div aria-hidden="true">hidden</div>',
          '<p>Visible<span class="sr-only"> (opens in a new tab)</span>.</p>',
          '<span class="katex">x^2</span>',
          '<div data-blume-narration="skip">Type table</div>',
          "<p>After.</p>",
        ].join("")
      )
    ).toEqual(["Before.", "Visible.", "After."]);
  });

  it("keeps a block together across a skipped inline element", () => {
    expect(script("<p>Press <svg></svg> to copy.</p>")).toEqual([
      "Press to copy.",
    ]);
  });

  it("announces callouts, numbered steps, tabs, and collapsible sections", () => {
    expect(
      script(
        [
          '<aside data-blume-callout="warning"><p>Back up first.</p></aside>',
          '<aside data-blume-callout="custom"><p>Unknown kinds read as notes.</p></aside>',
          "<div>",
          "<div data-blume-step><p>Install</p></div>",
          "<p>Between steps.</p>",
          "<div data-blume-step><p>Ship</p></div>",
          "</div>",
          '<div data-blume-tab-panel data-title="macOS"><p>Use Homebrew.</p></div>',
          "<div data-blume-tab-panel><p>Untitled tab.</p></div>",
          "<details><summary>Offline?</summary><p>Yes.</p></details>",
        ].join("")
      )
    ).toEqual([
      "[Warning.]",
      "Back up first.",
      "[Note.]",
      "Unknown kinds read as notes.",
      "[Step 1.]",
      "Install",
      "Between steps.",
      "[Step 2.]",
      "Ship",
      "[macOS tab.]",
      "Use Homebrew.",
      "Untitled tab.",
      "[Expandable section.]",
      "Offline?",
      "Yes.",
    ]);
  });

  it("drops a cue whose element has nothing to read", () => {
    expect(
      script(
        '<div data-blume-tab-panel data-title="npm"><pre>npm i</pre></div><p>Done.</p>'
      )
    ).toEqual(["Done."]);
  });

  it("silences an empty cue", () => {
    expect(
      script('<aside data-blume-callout="tip"><p>Quiet.</p></aside>', {
        ...CUES,
        tip: "",
      })
    ).toEqual(["Quiet."]);
  });

  it("maps every character back to its text node and offset", () => {
    const result = extract("<p>Hi <b>big</b>  world</p>");
    const [block] = result.blocks;
    expect(block?.text).toBe("Hi big world");
    // "b" of "big" is the first character of the second text node.
    expect(block?.nodeOf[3]).toBe(1);
    expect(block?.offsetOf[3]).toBe(0);
    // A collapsed run of spaces maps to the character after it.
    expect(block?.nodeOf[6]).toBe(2);
    expect(block?.offsetOf[6]).toBe(2);
    expect(block?.nodes).toHaveLength(3);
  });

  it("walks a parsed document's untagged root", () => {
    const result = extractNarration(parse("<p>Root.</p>"), htmlTree, CUES);
    expect(result.blocks.map((block) => block.text)).toEqual(["Root."]);
  });
});

describe(segmentNarration, () => {
  it("splits blocks into trimmed sentences and passes cues through", () => {
    const result = extract(
      '<aside data-blume-callout="note"><p>One. Two!</p></aside>'
    );
    expect(segmentNarration(result, "en")).toEqual([
      { block: null, end: 0, start: 0, text: "Note." },
      { block: 0, end: 4, start: 0, text: "One." },
      { block: 0, end: 9, start: 5, text: "Two!" },
    ]);
  });

  it("keeps a terminator with no space after it inside its sentence", () => {
    const result = extract(
      "<p>A link ending in <code>?install=windows</code> opens it. Next one.</p>"
    );
    expect(segmentNarration(result, "en").map((s) => s.text)).toEqual([
      "A link ending in ?install=windows opens it.",
      "Next one.",
    ]);
  });

  it("breaks a long sentence at a clause, then a space, then hard", () => {
    const clause = extract(
      "<p>The first part runs on for a while, and the second part keeps going too.</p>"
    );
    expect(segmentNarration(clause, "en", 40).map((s) => s.text)).toEqual([
      "The first part runs on for a while,",
      "and the second part keeps going too.",
    ]);
    const spaces = extract(
      "<p>words without any clause marks keep running along the line here</p>"
    );
    expect(segmentNarration(spaces, "en", 30).map((s) => s.text)).toEqual([
      "words without any clause",
      "marks keep running along the",
      "line here",
    ]);
    const hard = extract(`<p>${"x".repeat(25)}</p>`);
    expect(segmentNarration(hard, "en", 10).map((s) => s.text)).toEqual([
      "x".repeat(10),
      "x".repeat(10),
      "x".repeat(5),
    ]);
  });

  it("uses the language's own sentence ends", () => {
    const result = extract("<p>最初の文です。次の文です。</p>");
    expect(segmentNarration(result, "ja").map((s) => s.text)).toEqual([
      "最初の文です。",
      "次の文です。",
    ]);
  });
});

describe("narration length", () => {
  it("counts spoken characters and needs enough to narrate", () => {
    const short = extract("<p>Too short.</p>");
    expect(narrationLength(short)).toBe(10);
    expect(isNarratable(short)).toBe(false);
    const long = extract(
      `<p>${"word ".repeat(NARRATION_MIN_CHARS / 5 + 1)}</p>`
    );
    expect(isNarratable(long)).toBe(true);
  });

  it("estimates minutes from the language's reading rate", () => {
    expect(narrationCharsPerSecond("en-US")).toBe(15);
    expect(narrationCharsPerSecond("zh_TW")).toBe(7);
    expect(narrationMinutes(10, "en")).toBe(1);
    expect(narrationMinutes(15 * 60 * 3, "en")).toBe(3);
    expect(narrationMinutes(7 * 60 * 2, "ja")).toBe(2);
  });
});

describe(alignBlocks, () => {
  it("matches blocks by text in order, skipping extras and missing ones", () => {
    expect(
      alignBlocks(["A", "B", "missing", "C"], ["A", "extra", "B", "C"])
    ).toEqual([0, 2, -1, 3]);
  });

  it("pairs repeated text in order", () => {
    expect(alignBlocks(["Same", "Same"], ["Same", "Same"])).toEqual([0, 1]);
  });
});

describe(isNarrationCues, () => {
  it("accepts a full set of string cues only", () => {
    expect(isNarrationCues(CUES)).toBe(true);
    expect(isNarrationCues(null)).toBe(false);
    expect(isNarrationCues("cues")).toBe(false);
    expect(isNarrationCues({ ...CUES, tip: 1 })).toBe(false);
    const { warning: _warning, ...partial } = CUES;
    expect(isNarrationCues(partial)).toBe(false);
  });
});

describe(isNarrationManifest, () => {
  const valid = {
    blocks: ["Hello there."],
    segments: [
      { audio: "a.mp3", text: "Note." },
      { audio: "b.mp3", block: 0, end: 12, start: 0 },
    ],
    version: 1,
  };

  it("accepts cues and sentences", () => {
    expect(isNarrationManifest(valid)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isNarrationManifest(null)).toBe(false);
    expect(isNarrationManifest([])).toBe(false);
    expect(isNarrationManifest({ ...valid, version: 2 })).toBe(false);
    expect(isNarrationManifest({ ...valid, blocks: "Hello" })).toBe(false);
    expect(isNarrationManifest({ ...valid, blocks: [1] })).toBe(false);
    expect(isNarrationManifest({ ...valid, segments: {} })).toBe(false);
    expect(isNarrationManifest({ ...valid, segments: [null] })).toBe(false);
    expect(isNarrationManifest({ ...valid, segments: [{ text: "x" }] })).toBe(
      false
    );
    expect(
      isNarrationManifest({
        ...valid,
        segments: [{ audio: "a.mp3", block: 0, end: 1.5, start: 0 }],
      })
    ).toBe(false);
    expect(
      isNarrationManifest({ ...valid, segments: [{ audio: "a.mp3" }] })
    ).toBe(false);
  });
});
