"use client";

import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { BlumeLogo } from "@/scenes/blume-logo";

import {
  blurFilter,
  GlassInstallBox,
  GlassMarkTile,
  riseStyle,
} from "./primitives";
import { bars, beats } from "./tempo";
import {
  CLAMP,
  CTA_SKY,
  EASE_IN_OUT,
  EASE_OUT,
  MONO,
  SANS,
  WHITE,
} from "./theme";

// The close, as the homepage closes: the install CTA's sky panel scrolls up
// into view over the second half of the second breakdown, with the frosted
// Blume tile and the upgrade command typing on the next downbeat. As the music
// drains before the second drop the panel opens out to the full frame, the
// logo's petals pop on the drop, and the URL lands a bar later. Four bars on,
// the song's own ending stops it dead and the logo holds in silence.

/** The finale starts this early, so its panel is already scrolling up as the
 * rattle clears and lands on its first downbeat. */
export const FINALE_LEAD = 8;
const CTA_BARS = 4;
const LOGO_BARS = 4;
const DROP = FINALE_LEAD + bars(CTA_BARS);
const TAIL = 30;
export const FINALE_DURATION = FINALE_LEAD + bars(CTA_BARS + LOGO_BARS) + TAIL;

const PANEL_INSET = 32;
const OPEN_FROM = DROP - beats(2);

const CtaContent = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [OPEN_FROM, DROP - beats(1)], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        filter: blurFilter(out * 8),
        flexDirection: "row",
        justifyContent: "space-between",
        opacity: 1 - out,
        padding: "0 104px",
      }}
    >
      <div style={{ color: WHITE, fontFamily: SANS, width: 700 }}>
        <h2
          style={{
            fontSize: 46,
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
            margin: 0,
            ...riseStyle(frame, 14),
          }}
        >
          Upgrade your docs with Blume.
        </h2>
        <p
          style={{
            color: "rgb(255 255 255 / 0.8)",
            fontSize: 20,
            lineHeight: 1.5,
            margin: "20px 0 0",
            ...riseStyle(frame, 20),
          }}
        >
          Blume 2.0 is out now. Free and open source, forever.
        </p>
        <div style={{ marginTop: 32, ...riseStyle(frame, 26) }}>
          <GlassInstallBox
            command="npm i blume@latest"
            typeFrom={FINALE_LEAD + bars(1)}
          />
        </div>
      </div>
      <GlassMarkTile delay={18} size={240} />
    </AbsoluteFill>
  );
};

const LogoSignOff = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <BlumeLogo color={WHITE} markHeight={96} wordmarkSize={100} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: "translateY(92px)",
        }}
      >
        <span
          style={{
            color: "rgb(255 255 255 / 0.7)",
            fontFamily: MONO,
            fontSize: 18,
            ...riseStyle(frame, bars(1) - 2),
          }}
        >
          useblume.dev
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Finale = () => {
  const frame = useCurrentFrame();
  // Scroll the panel up from below the fold, then open it to full bleed.
  const rise = interpolate(frame, [0, 26], [720, 0], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const open = interpolate(frame, [OPEN_FROM, DROP], [0, 1], {
    ...CLAMP,
    easing: EASE_IN_OUT,
  });
  const inset = PANEL_INSET * (1 - open);
  return (
    <AbsoluteFill>
      <div
        style={{
          backgroundImage: CTA_SKY,
          borderRadius: 28 * (1 - open),
          bottom: inset,
          left: inset,
          overflow: "hidden",
          position: "absolute",
          right: inset,
          top: inset,
          transform: `translateY(${rise}px)`,
        }}
      >
        <Sequence durationInFrames={DROP} layout="none">
          <CtaContent />
        </Sequence>
      </div>
      <Sequence from={DROP} layout="none">
        <LogoSignOff />
      </Sequence>
    </AbsoluteFill>
  );
};
