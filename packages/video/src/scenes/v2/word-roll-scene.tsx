"use client";

import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { blurFilter, riseStyle } from "./primitives";
import { bars, beats } from "./tempo";
import { CLAMP, EASE_OUT, INK, SANS, SKY_1, SKY_5, SKY_6 } from "./theme";

// A kinetic beat between the config and the adapter scenes: "Bring your own"
// holds while the last word rolls through what you can now plug in. It plays
// over the near-silent bar before the drop — the words land on its beats,
// quickening to eighths — and "everything." punches in on the drop itself.

export const WORD_ROLL_BARS = 2;

const WORDS = [
  "analytics.",
  "CMS.",
  "search.",
  "host.",
  "model.",
  "everything.",
];
// The beat each word lands on; the last is the next bar's downbeat.
const LANDS = [0, beats(1), beats(2), beats(3), beats(3.5), bars(1)];
// Each roll starts a touch early so the word is mostly in on its beat.
const ROLL = 6;
const ROLL_LEAD = 2;
const STARTS = LANDS.map((at) => Math.max(0, at - ROLL_LEAD));
const DROP = bars(1);
const FONT_SIZE = 64;

// A rough advance width for Inter Medium, in ems, so the slot can track each
// word and keep the whole phrase centered as it rolls. Close is enough: the
// slot only has to move with the word, not match it to the pixel.
const NARROW = "fijlrt.";
const WIDE = "mw";
const charEm = (char: string): number => {
  if (NARROW.includes(char)) {
    return 0.3;
  }
  if (WIDE.includes(char)) {
    return 0.82;
  }
  return char === char.toUpperCase() ? 0.66 : 0.55;
};
const emWidth = (word: string): number => {
  let sum = 0;
  for (const char of word) {
    sum += charEm(char);
  }
  // Less the heading's -0.035em tracking.
  return sum * 0.965;
};

// The sky ramp as a text fill, deep to light.
const SKY_TEXT = {
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  backgroundImage: `linear-gradient(90deg, ${SKY_1}, ${SKY_5} 65%, ${SKY_6})`,
} as const;

export const WordRoll = () => {
  const frame = useCurrentFrame();
  // Ease the slot from each word's width to the next's as it rolls in.
  let slotEm = emWidth(WORDS[0] ?? "");
  for (const [i, word] of WORDS.entries()) {
    const t = interpolate(frame - (STARTS[i] ?? 0), [0, ROLL], [0, 1], {
      ...CLAMP,
      easing: EASE_OUT,
    });
    slotEm += (emWidth(word) - slotEm) * t;
  }
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        flexDirection: "row",
        fontFamily: SANS,
        fontSize: FONT_SIZE,
        fontWeight: 500,
        justifyContent: "center",
        letterSpacing: "-0.035em",
      }}
    >
      <span style={{ color: INK, whiteSpace: "pre", ...riseStyle(frame, 0) }}>
        Bring your own{" "}
      </span>
      {/* Tracks the live word's width so the phrase stays centered. */}
      <span
        style={{
          // Clip the roll top and bottom only, so a word wider than the
          // easing slot isn't cut at the side.
          clipPath: "inset(0 -100%)",
          display: "inline-block",
          height: FONT_SIZE * 1.25,
          position: "relative",
          width: `${slotEm}em`,
        }}
      >
        {WORDS.map((word, i) => {
          const start = STARTS[i] ?? 0;
          const next = STARTS[i + 1];
          const enter = interpolate(frame - start, [0, ROLL], [0, 1], {
            ...CLAMP,
            easing: EASE_OUT,
          });
          const leave =
            next === undefined
              ? 0
              : interpolate(frame - next, [0, ROLL], [0, 1], {
                  ...CLAMP,
                  easing: EASE_OUT,
                });
          const offset = (1 - enter) * 0.7 - leave * 0.7;
          // The drop's word lands big and settles.
          const punch =
            next === undefined
              ? interpolate(frame, [DROP, DROP + 12], [1.14, 1], {
                  ...CLAMP,
                  easing: EASE_OUT,
                })
              : 1;
          return (
            <span
              key={word}
              style={{
                ...SKY_TEXT,
                filter: blurFilter((1 - enter + leave) * 6),
                left: 0,
                lineHeight: 1.25,
                opacity: enter * (1 - leave),
                position: "absolute",
                top: 0,
                transform: `translateY(${offset}em) scale(${punch})`,
                transformOrigin: "left center",
                whiteSpace: "pre",
              }}
            >
              {word}
            </span>
          );
        })}
      </span>
    </AbsoluteFill>
  );
};
