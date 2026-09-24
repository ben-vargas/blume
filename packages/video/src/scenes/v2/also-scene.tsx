"use client";

import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { SharedAxisY } from "@/components/remocn/shared-axis-y";

import { riseStyle } from "./primitives";
import { bars } from "./tempo";
import { BORDER, INK, MUTED_INK, SANS, WHITE } from "./theme";

// The smaller 2.0 changes as a rattle under an "Also in 2.0" label, one line
// per bar over the second breakdown: the first line rises in word by word,
// then each swap walks down the list in hard per-word cuts, started early
// enough that its first new word lands on the downbeat.

const LINES = [
  "A simpler config.",
  "Old keys name their replacements.",
  "blume init installs for you.",
  "External links in new tabs.",
];

const FONT_SIZE = 56;
const LINE_Y = 26;

export const ALSO_BARS = LINES.length;
const DURATION = bars(ALSO_BARS);

// SharedAxisY clears the old words (a 4-frame step, 2 apart), waits a frame,
// then steps the new words in over 5 frames each: its first new word shows
// this many frames after the swap starts.
const swapLead = (from: string): number =>
  4 + (from.split(" ").length - 1) * 2 + 1 + 5;
const SWAP_AT = LINES.map((line, i) =>
  i === 0 ? 0 : bars(i) - swapLead(LINES[i - 1] ?? "")
);
const swapEnd = (i: number): number => SWAP_AT[i + 1] ?? DURATION;

const Label = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${LINE_Y - 76}px)`,
      }}
    >
      <span
        style={{
          background: WHITE,
          borderRadius: 999,
          boxShadow: `0 0 0 1px ${BORDER}`,
          color: MUTED_INK,
          fontFamily: SANS,
          fontSize: 15,
          padding: "6px 14px",
          ...riseStyle(frame, 0),
        }}
      >
        Also in 2.0
      </span>
    </AbsoluteFill>
  );
};

const FirstLine = () => {
  const frame = useCurrentFrame();
  const [first = ""] = LINES;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <span
        style={{
          color: INK,
          fontFamily: SANS,
          fontSize: FONT_SIZE,
          fontWeight: 500,
          letterSpacing: "-0.03em",
        }}
      >
        {first.split(" ").map((word, i) => (
          <span
            key={word}
            style={{
              display: "inline-block",
              marginRight: "0.25em",
              ...riseStyle(frame, 4 + i * 3, 14, 10),
            }}
          >
            {word}
          </span>
        ))}
      </span>
    </AbsoluteFill>
  );
};

export const AlsoScene = () => (
  <AbsoluteFill>
    <Label />
    <AbsoluteFill style={{ transform: `translateY(${LINE_Y}px)` }}>
      <Sequence durationInFrames={swapEnd(0)} layout="none">
        <FirstLine />
      </Sequence>
      {LINES.slice(1).map((line, i) => (
        <Sequence
          durationInFrames={swapEnd(i + 1) - (SWAP_AT[i + 1] ?? 0)}
          from={SWAP_AT[i + 1] ?? 0}
          key={line}
          layout="none"
        >
          <SharedAxisY
            color={INK}
            fontSize={FONT_SIZE}
            fontWeight={500}
            fromText={LINES[i] ?? ""}
            toText={line}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  </AbsoluteFill>
);
