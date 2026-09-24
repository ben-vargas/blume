"use client";

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import {
  CodeWindow,
  FullTile,
  riseStyle,
  Tray,
  TwoTone,
  typingSchedule,
} from "./primitives";
import type { LineBand } from "./primitives";
import { SOURCE_TILES } from "./source-tiles";
import { BEAT, bars, beats } from "./tempo";
import {
  ACCENT,
  BORDER,
  CLAMP,
  EASE_IN_OUT,
  INK,
  MUTED_INK,
  SANS,
  WHITE,
} from "./theme";

// "Content from anywhere", now with three headless CMSs. The homepage's
// section, animated: the dock pops in on sixteenths, the config types the new
// adapters in while each one's tile joins the dock and its row joins the
// list, then a pointer sweeps the dock across the third bar and it magnifies
// under it the way the page's does.

export const SOURCES_BARS = 4;

const SOURCE = `import { defineConfig } from "blume";
import { contentful, payload, strapi } from "blume/sources";

export default defineConfig({
  content: {
    sources: [
      contentful({ space: "acme", contentType: "page" }),
      payload({ url: "https://cms.acme.dev", collection: "guides" }),
      strapi({ url: "https://api.acme.dev", contentType: "posts" }),
    ],
  },
});`;

const TYPING = { linePause: 2, speed: 5, start: beats(2) };
const SCHEDULE = typingSchedule(SOURCE, TYPING);
const lineStart = (line: number): number => SCHEDULE.starts[line] ?? 0;
const TYPED_AT = Math.max(...SCHEDULE.ends);

const CMS_LINES = [6, 7, 8];
const BANDS: LineBand[] = CMS_LINES.map((line, i) => ({
  from: lineStart(line),
  line,
  to: lineStart(CMS_LINES[i + 1] ?? 9),
}));

const ROWS = [
  { body: "Rich text, assets, and the Preview API.", title: "Contentful." },
  { body: "Lexical content, uploads, and drafts.", title: "Payload." },
  { body: "Blocks, media, and drafts.", title: "Strapi." },
  { body: "Each one reads the CMS's REST API.", title: "No SDKs." },
];
const rowAt = (i: number): number =>
  i < CMS_LINES.length ? lineStart(CMS_LINES[i] ?? 0) : TYPED_AT + 4;

// The existing sources dock first; each new CMS tile lands as its line types.
const NEW_FROM = SOURCE_TILES.findIndex((tile) => tile.isNew);
const tileAt = (i: number): number =>
  i < NEW_FROM
    ? beats(1) + Math.round((i * BEAT) / 4)
    : lineStart(CMS_LINES[i - NEW_FROM] ?? 0) + 2;

// Dock magnification, as on the page: each tile grows with a quarter cosine
// of its distance from the pointer, measured to its resting center.
const TILE = 44;
const STEP = 50;
const BOOST = 0.6;
const RANGE = 120;
const SWEEP_FROM = bars(2.5);
const SWEEP_TO = bars(3.25);
const RELEASE = 12;

const magnification = (frame: number, index: number): number => {
  const middle = (SOURCE_TILES.length - 1) / 2;
  const span = middle * STEP + 20;
  const pointer = interpolate(frame, [SWEEP_FROM, SWEEP_TO], [-span, span], {
    ...CLAMP,
    easing: EASE_IN_OUT,
  });
  const engaged =
    interpolate(frame, [SWEEP_FROM - 8, SWEEP_FROM], [0, 1], CLAMP) *
    interpolate(frame, [SWEEP_TO, SWEEP_TO + RELEASE], [1, 0], CLAMP);
  const distance = Math.abs(pointer - (index - middle) * STEP);
  const target =
    BOOST * Math.cos(Math.min(distance / RANGE, 1) * (Math.PI / 2));
  return 1 + target * engaged;
};

export const SourcesScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 40,
        padding: "0 96px",
      }}
    >
      <div style={{ fontFamily: SANS, width: 440 }}>
        <TwoTone
          delay={2}
          fontSize={36}
          tagline="Now with Contentful, Payload, and Strapi."
          title="Content from anywhere."
        />
        <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 36 }}>
          {ROWS.map((row, i) => (
            <div
              key={row.title}
              style={{
                borderBottom: `1px solid ${BORDER}`,
                fontSize: 17,
                lineHeight: 1.45,
                padding: "13px 0",
                ...riseStyle(frame, rowAt(i), 14, 8),
              }}
            >
              <span style={{ color: INK, fontWeight: 500 }}>{row.title}</span>{" "}
              <span style={{ color: MUTED_INK }}>{row.body}</span>
            </div>
          ))}
        </div>
      </div>
      <Tray
        innerStyle={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 30,
          justifyContent: "center",
        }}
        style={{ height: 540, width: 648, ...riseStyle(frame, 8, 22, 24) }}
        tone="sky"
      >
        <CodeWindow
          bands={BANDS}
          caretUntil={TYPED_AT + 30}
          code={SOURCE}
          fontSize={12}
          lineHeight={21}
          rows={14}
          title="blume.config.ts"
          typing={TYPING}
          width={560}
        />
        <div
          style={{
            alignItems: "flex-end",
            display: "flex",
            gap: STEP - TILE,
            height: TILE * (1 + BOOST),
          }}
        >
          {SOURCE_TILES.map((tile, i) => {
            const s = spring({
              config: { damping: 12, mass: 0.6, stiffness: 200 },
              fps,
              frame: frame - tileAt(i),
            });
            const size = TILE * magnification(frame, i);
            return (
              <div
                key={tile.name}
                style={{
                  opacity: interpolate(s, [0, 0.3], [0, 1], CLAMP),
                  position: "relative",
                  transform: `scale(${interpolate(s, [0, 1], [0.4, 1])})`,
                  transformOrigin: "bottom center",
                }}
              >
                <FullTile size={size} svg={tile.svg} />
                {tile.isNew && (
                  <span
                    style={{
                      background: ACCENT,
                      borderRadius: 999,
                      boxShadow: `0 0 0 2px ${WHITE}`,
                      height: 9,
                      position: "absolute",
                      right: -2,
                      top: -2,
                      width: 9,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Tray>
    </AbsoluteFill>
  );
};
