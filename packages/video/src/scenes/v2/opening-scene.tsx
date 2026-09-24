"use client";

import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import {
  CodeWindow,
  GlassInstallBox,
  GlassMarkTile,
  riseStyle,
  Tray,
  TwoTone,
  typingSchedule,
} from "./primitives";
import type { LineBand } from "./primitives";
import { bars, beats } from "./tempo";
import {
  ACCENT,
  BORDER,
  CLAMP,
  EASE_IN_OUT,
  HERO_SKY,
  INK,
  MONO,
  MUTED_INK,
  SANS,
  WHITE,
} from "./theme";

// The opening, staged as the landing page itself: the sky hero with the
// homepage's headline under the 2.0 release badge, then the camera scrolls
// down the page onto a split section where the whole adapter surface types
// itself into one blume.config.ts, each import lighting its row in the list
// beside it — the last row, Deployment, stays lit once the file is done.

// Two bars of hero, then five of config; the scroll between them is centered
// on the third bar's downbeat.
export const OPENING_BARS = 7;
const OPENING_DURATION = bars(OPENING_BARS);
const STAGE_H = 720;
const SCROLL_FROM = bars(2) - beats(1);
const SCROLL_TO = bars(2) + beats(1);
const CONFIG_HOLD = OPENING_DURATION - SCROLL_FROM;

// ─── Hero ───────────────────────────────────────────────────────────────────

const Hero = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        padding: "0 112px",
      }}
    >
      <div style={{ color: WHITE, fontFamily: SANS, width: 760 }}>
        <div
          style={{
            color: "rgb(255 255 255 / 0.7)",
            fontSize: 15,
            ...riseStyle(frame, 2),
          }}
        >
          Latest update, v2.0.0
        </div>
        <div style={{ marginTop: 22 }}>
          <TwoTone
            delay={6}
            fontSize={66}
            inverse
            tagline="for humans and agents"
            title="The best docs framework"
          />
        </div>
        <p
          style={{
            color: "rgb(255 255 255 / 0.8)",
            fontSize: 20,
            lineHeight: 1.5,
            margin: "28px 0 0",
            maxWidth: 540,
            ...riseStyle(frame, 20),
          }}
        >
          Analytics, content, search, hosting, API references, and Ask AI — each
          one a typed import in your config.
        </p>
        <div style={{ marginTop: 32, ...riseStyle(frame, 28) }}>
          <GlassInstallBox command="npx blume init" typeFrom={40} />
        </div>
      </div>
      <GlassMarkTile delay={10} size={220} />
    </AbsoluteFill>
  );
};

// ─── Config ─────────────────────────────────────────────────────────────────

const CONFIG_SOURCE = `import { defineConfig } from "blume";
import { plausible, posthog } from "blume/analytics";
import { contentful, filesystem } from "blume/sources";
import { pagefind } from "blume/search";
import { openapi } from "blume/reference";
import { openrouter } from "blume/ai";
import { vercel } from "blume/deploy";

export default defineConfig({
  analytics: [
    posthog({ key: "phc_…" }),
    plausible({ domain: "docs.acme.dev" }),
  ],
  content: {
    sources: [
      filesystem({ root: "docs" }),
      contentful({ space: "acme", contentType: "page" }),
    ],
  },
  search: pagefind(),
  reference: [openapi({ spec: "./openapi.yaml" })],
  ai: {
    ask: {
      enabled: true,
      provider: openrouter({ model: "openai/gpt-5.5" }),
    },
  },
  deployment: vercel(),
});`;

// Each row lights while its import types, and again while its key does.
const ROWS = [
  { importLine: 1, keyLine: 9, label: "Analytics", path: "blume/analytics" },
  { importLine: 2, keyLine: 13, label: "Content", path: "blume/sources" },
  { importLine: 3, keyLine: 19, label: "Search", path: "blume/search" },
  {
    importLine: 4,
    keyLine: 20,
    label: "API references",
    path: "blume/reference",
  },
  { importLine: 5, keyLine: 21, label: "Ask AI", path: "blume/ai" },
  { importLine: 6, keyLine: 27, label: "Deployment", path: "blume/deploy" },
];
const IMPORTS_END_LINE = 7;

const TYPING = { linePause: 2, speed: 5, start: 40 };
const SCHEDULE = typingSchedule(CONFIG_SOURCE, TYPING);
const lineStart = (line: number): number => SCHEDULE.starts[line] ?? 0;

// Where each row is live, as the code lines it washes: its import until the
// next import starts typing, then its key until the next key does. The last
// key has no next, so Deployment stays live past the end of the scene.
const ROW_BANDS: LineBand[][] = ROWS.map((row, i) => {
  const next = ROWS[i + 1];
  return [
    {
      from: lineStart(row.importLine),
      line: row.importLine,
      to: lineStart(next ? next.importLine : IMPORTS_END_LINE),
    },
    {
      from: lineStart(row.keyLine),
      line: row.keyLine,
      to: next ? lineStart(next.keyLine) : CONFIG_HOLD + 10,
    },
  ];
});

const BANDS: LineBand[] = [];
for (const bands of ROW_BANDS) {
  BANDS.push(...bands);
}

const liveness = (frame: number, bands: LineBand[]): number => {
  let live = 0;
  for (const band of bands) {
    const on = interpolate(frame, [band.from, band.from + 5], [0, 1], CLAMP);
    const off = interpolate(frame, [band.to, band.to + 5], [1, 0], CLAMP);
    live = Math.max(live, Math.min(on, off));
  }
  return live;
};

const ConfigSection = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 36,
        padding: "0 96px",
      }}
    >
      <div style={{ fontFamily: SANS, width: 440 }}>
        <TwoTone
          delay={12}
          fontSize={36}
          tagline="Six kinds, one config."
          title="Everything is an import."
        />
        <div style={{ marginTop: 36 }}>
          {ROWS.map((row, i) => {
            const live = liveness(frame, ROW_BANDS[i] ?? []);
            return (
              <div
                key={row.label}
                style={{
                  alignItems: "baseline",
                  borderLeft: `2px solid color-mix(in oklab, ${INK} ${live * 100}%, ${BORDER})`,
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "9px 0 9px 18px",
                  ...riseStyle(frame, 22 + i * 3),
                }}
              >
                <span
                  style={{
                    color: `color-mix(in oklab, ${INK} ${live * 100}%, ${MUTED_INK})`,
                    fontSize: 18,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    color: `color-mix(in oklab, ${ACCENT} ${live * 100}%, ${MUTED_INK})`,
                    fontFamily: MONO,
                    fontSize: 13,
                    opacity: 0.55 + live * 0.45,
                  }}
                >
                  {row.path}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <Tray
        innerStyle={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
        }}
        style={{ height: 560, width: 620, ...riseStyle(frame, 16, 22, 24) }}
        tone="sky"
      >
        <CodeWindow
          bands={BANDS}
          caretUntil={CONFIG_HOLD}
          code={CONFIG_SOURCE}
          rows={19}
          title="blume.config.ts"
          typing={TYPING}
          width={540}
        />
      </Tray>
    </AbsoluteFill>
  );
};

// ─── Composite ──────────────────────────────────────────────────────────────

export const Opening = () => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [SCROLL_FROM, SCROLL_TO], [0, STAGE_H], {
    ...CLAMP,
    easing: EASE_IN_OUT,
  });
  return (
    <AbsoluteFill style={{ background: WHITE, overflow: "hidden" }}>
      <div
        style={{
          height: STAGE_H * 2,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
          transform: `translateY(${-scroll}px)`,
        }}
      >
        {/* The sky runs past the fold, so the config section rises out of
            its fade the way the product preview does on the page. */}
        <div
          style={{
            backgroundImage: HERO_SKY,
            height: 1100,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />
        <div style={{ height: STAGE_H, position: "relative" }}>
          <Hero />
        </div>
        <div style={{ height: STAGE_H, position: "relative" }}>
          <Sequence from={SCROLL_FROM} layout="none">
            <ConfigSection />
          </Sequence>
        </div>
      </div>
    </AbsoluteFill>
  );
};
