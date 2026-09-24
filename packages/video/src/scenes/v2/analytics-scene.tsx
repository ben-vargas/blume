"use client";

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { ANALYTICS_MARKS } from "./brand-marks";
import { blurFilter, BrandTile, riseStyle, Tray, TwoTone } from "./primitives";
import { BEAT, bars, beats } from "./tempo";
import { CLAMP, EASE_OUT, MONO, MUTED_INK } from "./theme";

// Analytics went from three providers to eighteen. The 1.x trio lands first,
// on eighths, with the counter on 3; from the second bar the fifteen new
// adapters pop in on sixteenths and the counter rolls up with them to 18, and
// on the third bar a wave runs through the full grid.

export const ANALYTICS_BARS = 3;

const COLS = 6;
const TILE = 58;
const CELL_W = 128;
const EXISTING = 3;

// Springs read as "in" a couple of frames after they start, so each pop
// starts that much before its note.
const POP_LEAD = 2;
const popAt = (i: number): number =>
  (i < EXISTING
    ? beats(0.5 + i * 0.5)
    : bars(1) + Math.round(((i - EXISTING) * BEAT) / 4)) - POP_LEAD;
const WAVE_AT = bars(2);

// The counter ticks as each new tile is mostly in.
const TICKS = ANALYTICS_MARKS.slice(EXISTING).map(
  (_, i) => popAt(i + EXISTING) + 3
);

const DIGIT_EM = 0.62;

const Counter = () => {
  const frame = useCurrentFrame();
  let ticked = -1;
  for (const [i, at] of TICKS.entries()) {
    if (frame >= at) {
      ticked = i;
    }
  }
  const value = EXISTING + ticked + 1;
  const prev = value - 1;
  const t =
    ticked < 0
      ? 1
      : interpolate(frame - (TICKS[ticked] ?? 0), [0, 5], [0, 1], {
          ...CLAMP,
          easing: EASE_OUT,
        });
  const widthEm =
    interpolate(t, [0, 1], [String(prev).length, String(value).length]) *
    DIGIT_EM;
  return (
    <span
      style={{
        display: "inline-block",
        fontVariantNumeric: "tabular-nums",
        height: "1.1em",
        overflow: "hidden",
        position: "relative",
        verticalAlign: "top",
        width: `${widthEm}em`,
      }}
    >
      {ticked >= 0 && (
        <span
          style={{
            left: 0,
            opacity: 1 - t,
            position: "absolute",
            top: 0,
            transform: `translateY(${-t * 100}%)`,
          }}
        >
          {prev}
        </span>
      )}
      <span
        style={{
          left: 0,
          opacity: t,
          position: "absolute",
          top: 0,
          transform: `translateY(${(1 - t) * 100}%)`,
        }}
      >
        {value}
      </span>
    </span>
  );
};

export const AnalyticsScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        flexDirection: "column",
        gap: 36,
        justifyContent: "center",
      }}
    >
      <TwoTone
        align="center"
        delay={2}
        fontSize={44}
        tagline="Up from three. Each one a single line."
        title={
          <>
            <Counter /> analytics providers.
          </>
        }
      />
      <Tray
        innerStyle={{
          alignContent: "center",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          padding: "0 28px",
          rowGap: 22,
        }}
        style={{ height: 380, width: 880, ...riseStyle(frame, 8, 22, 24) }}
        tone="sky"
      >
        {ANALYTICS_MARKS.map((mark, i) => {
          const s = spring({
            config: { damping: 12, mass: 0.6, stiffness: 200 },
            fps,
            frame: frame - popAt(i),
          });
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const wave = interpolate(
            frame,
            [WAVE_AT + (col + row) * 3, WAVE_AT + (col + row) * 3 + 16],
            [0, 1],
            CLAMP
          );
          return (
            <div
              key={mark.factory}
              style={{
                alignItems: "center",
                display: "flex",
                // The spring overshoots, so the blur follows the clock.
                filter: blurFilter(
                  interpolate(frame - popAt(i), [0, 5], [6, 0], {
                    ...CLAMP,
                    easing: EASE_OUT,
                  })
                ),
                flexDirection: "column",
                gap: 10,
                opacity: interpolate(s, [0, 0.3], [0, 1], CLAMP),
                transform: `translateY(${-Math.sin(wave * Math.PI) * 7}px) scale(${interpolate(s, [0, 1], [0.5, 1])})`,
                width: CELL_W,
              }}
            >
              <BrandTile size={TILE} svg={mark.svg} />
              <span
                style={{ color: MUTED_INK, fontFamily: MONO, fontSize: 12 }}
              >
                {mark.factory}()
              </span>
            </div>
          );
        })}
      </Tray>
    </AbsoluteFill>
  );
};
