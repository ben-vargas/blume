"use client";

import { loadFont as loadIbmPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import type { CSSProperties } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";

import { ADAPTERS_BARS, AdaptersScene } from "@/scenes/v2/adapters-scene";
import { ALSO_BARS, AlsoScene } from "@/scenes/v2/also-scene";
import { ANALYTICS_BARS, AnalyticsScene } from "@/scenes/v2/analytics-scene";
import { DOCTOR_BARS, DoctorScene } from "@/scenes/v2/doctor-scene";
import { FINALE_DURATION, FINALE_LEAD, Finale } from "@/scenes/v2/finale-scene";
import { OPENING_BARS, Opening } from "@/scenes/v2/opening-scene";
import { SceneExit } from "@/scenes/v2/primitives";
import { Soundtrack } from "@/scenes/v2/soundtrack";
import { SOURCES_BARS, SourcesScene } from "@/scenes/v2/sources-scene";
import { bars } from "@/scenes/v2/tempo";
import { WHITE } from "@/scenes/v2/theme";
import { WORD_ROLL_BARS, WordRoll } from "@/scenes/v2/word-roll-scene";

// The Blume 2.0 launch video. Where the earlier cuts ride a gradient photo in
// frosted Geist, this one is staged in the redesigned landing pages' own
// language: the day-sky hero, white sections with two-tone headings, hairline
// trays, github-light code windows, and the CLI page's dark terminal — Inter
// over IBM Plex Mono throughout.

const { fontFamily: INTER } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600"],
});
const { fontFamily: IBM_PLEX_MONO } = loadIbmPlexMono("normal", {
  subsets: ["latin"],
  weights: ["400", "500"],
});

// Wire the faces to the variables the v2 scenes read, and point the remocn
// components' Geist variables at the same faces so borrowed text effects
// match.
// SAFETY: the object holds only `--*` custom properties — valid inline style
// keys that CSSProperties cannot type in this @types/react version.
const FONT_VARS = {
  "--font-geist-mono": IBM_PLEX_MONO,
  "--font-geist-sans": INTER,
  "--font-mono": IBM_PLEX_MONO,
  "--font-sans": INTER,
} as CSSProperties;

// Every scene is authored against this reference stage and scaled uniformly
// to the composition (720p → 1080p is an exact 1.5×).
const REF_W = 1280;
const REF_H = 720;

// The white scenes play back to back, each whole bars long on the
// soundtrack's grid (scenes/v2/tempo.ts) and placed at its absolute bar so
// rounding never accumulates: every cut lands on a downbeat. Each lifts out
// over its last frames as the next rises in; the finale's sky panel starts
// scrolling up while the rattle is still fading, so it reads as the page
// continuing.
const SCENES = [
  { Component: Opening, bars: OPENING_BARS, id: "opening" },
  { Component: WordRoll, bars: WORD_ROLL_BARS, id: "word-roll" },
  { Component: AnalyticsScene, bars: ANALYTICS_BARS, id: "analytics" },
  { Component: SourcesScene, bars: SOURCES_BARS, id: "sources" },
  { Component: AdaptersScene, bars: ADAPTERS_BARS, id: "adapters" },
  { Component: DoctorScene, bars: DOCTOR_BARS, id: "doctor" },
  { Component: AlsoScene, bars: ALSO_BARS, id: "also" },
];

const PLACED: { from: number; duration: number }[] = [];
let barAt = 0;
for (const scene of SCENES) {
  PLACED.push({
    duration: bars(barAt + scene.bars) - bars(barAt),
    from: bars(barAt),
  });
  barAt += scene.bars;
}
const FINALE_FROM = bars(barAt) - FINALE_LEAD;

export const V2_LAUNCH_VIDEO_DURATION = FINALE_FROM + FINALE_DURATION;

export const V2LaunchVideo = () => {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill style={{ ...FONT_VARS, background: WHITE }}>
      <div
        style={{
          height: REF_H,
          overflow: "hidden",
          position: "relative",
          transform: `scale(${width / REF_W})`,
          transformOrigin: "top left",
          width: REF_W,
        }}
      >
        {SCENES.map(({ Component, id }, i) => {
          const { duration, from } = PLACED[i] ?? { duration: 0, from: 0 };
          return (
            <Sequence
              durationInFrames={duration}
              from={from}
              key={id}
              layout="none"
              name={id}
            >
              <SceneExit duration={duration}>
                <Component />
              </SceneExit>
            </Sequence>
          );
        })}
        <Sequence
          durationInFrames={FINALE_DURATION}
          from={FINALE_FROM}
          layout="none"
          name="finale"
        >
          <Finale />
        </Sequence>
      </div>
      <Soundtrack />
    </AbsoluteFill>
  );
};
