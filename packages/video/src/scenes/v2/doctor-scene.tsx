"use client";

import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Code, riseStyle, Terminal, Tray, TwoTone } from "./primitives";
import type { TermLine } from "./primitives";
import { BEAT, bars, beats } from "./tempo";
import { MUTED_INK, SANS } from "./theme";

// Adapters are plain descriptors, so the CLI can read the whole stack back.
// `blume doctor` against the opening's config: its summary lines are the
// real `logger.info` strings (cli/commands/doctor.ts), one per adapter kind.
// The command types from the second beat, the summary spills out on
// sixteenths, and the all-clear lands on the second bar.

export const DOCTOR_BARS = 4;

const COMMAND_AT = beats(1);
const OUTPUT_AT = beats(3);
const sixteenth = (i: number): number => OUTPUT_AT + Math.round((i * BEAT) / 4);

const info = (text: string, at: number): TermLine => ({
  at,
  segs: [
    { text: "ℹ ", tone: "info" },
    { text, tone: "out" },
  ],
});

const LINES: TermLine[] = [
  {
    at: COMMAND_AT,
    segs: [
      { text: "❯ ", tone: "prompt" },
      { text: "blume doctor", tone: "cmd" },
    ],
    typeSpeed: 0.7,
  },
  info("Pages: 48", sixteenth(0)),
  info("Output: server", sixteenth(1)),
  info("Adapter: vercel", sixteenth(2)),
  info("Search: pagefind", sixteenth(3)),
  info("References: openapi", sixteenth(4)),
  info("Analytics: posthog, plausible", sixteenth(5)),
  info("Sources: filesystem, contentful", sixteenth(6)),
  info("Ask AI: openrouter", sixteenth(7)),
  {
    at: bars(1),
    segs: [
      { text: "✔ ", tone: "ok" },
      { text: "No problems found.", tone: "out" },
    ],
  },
  {
    at: bars(1) + beats(1),
    segs: [
      { text: "❯ ", tone: "prompt" },
      { text: "", tone: "cmd" },
    ],
  },
];

export const DoctorScene = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 48,
        padding: "0 96px",
      }}
    >
      <Tray
        innerStyle={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
        }}
        style={{ height: 460, width: 620, ...riseStyle(frame, 6, 22, 24) }}
        tone="sky"
      >
        <Terminal height={352} lines={LINES} width={520} />
      </Tray>
      <div style={{ fontFamily: SANS, width: 420 }}>
        <TwoTone
          delay={2}
          fontSize={36}
          tagline="So the CLI reads your stack back."
          title="Adapters are plain data."
        />
        <p
          style={{
            color: MUTED_INK,
            fontSize: 18,
            lineHeight: 1.5,
            margin: "28px 0 0",
            ...riseStyle(frame, 14),
          }}
        >
          Each one declares the packages it installs and the secrets it reads,
          so <Code>blume doctor</Code>, the secrets check, and an ejected site
          all agree on what your docs need.
        </p>
      </div>
    </AbsoluteFill>
  );
};
