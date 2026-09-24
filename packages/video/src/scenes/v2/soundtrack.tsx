"use client";

import { Html5Audio, interpolate, Sequence, staticFile } from "remotion";

import { bars, songBarFrame } from "./tempo";
import { CLAMP } from "./theme";

// The music edit: runs of whole song bars laid end to end on one beat grid.
// The track is licensed and lives in the gitignored public/music/ — drop it
// there to render with sound.
//
//   video bars 0–35 ← song 17–51, uncut: the first breakdown under the hero
//                     and config, its near-silent bar 24 under the word roll,
//                     the drop (25) on "everything.", the full section
//                     (lifting at 33) under the adapters, the second
//                     breakdown under "Also in 2.0" and the CTA, and the
//                     second drop (49) under the logo
//   video bars 35–  ← song 80–end: the song's last bar and its hard stop
//
// The song's harmony turns over every four bars, so the one splice keeps the
// cycle: bar 51 is the cycle's third chord and bar 80 its fourth, and bar 80
// sounds like bar 52 (what would have followed) within a hair, both in pitch
// and in texture.

export const SOUNDTRACK_SRC = "music/disc-me-bro.mp3";

const EDIT = [
  { from: 17, to: 52 },
  { from: 80, to: null },
];

// Runs overlap by a short crossfade that finishes a frame before the incoming
// downbeat: the outgoing run is silent by its last frame (a run's audio
// carries a hair past its end, and at any volume its own next downbeat would
// double the incoming kick), and the next run is at full volume for its kick.
const XFADE = 2;
const XFADE_LEAD = XFADE + 1;

// A render's AAC track lands ~42ms behind the picture (measured by correlating
// a rendered cut's audio against the source file: every run was off by the
// same amount). Starting each run a frame further into the song brings the
// kicks back to within ~10ms of the cuts.
const LATENCY_FRAMES = 1;
const VOLUME = 0.9;

interface Run {
  /** Video frame the run starts at (its crossfade included). */
  from: number;
  /** Song frames the run plays, before the latency nudge. */
  songFrom: number;
  songTo: number | undefined;
  /** Frames the run lasts, or undefined to play out to the end of the file. */
  frames: number | undefined;
  fadesIn: boolean;
  fadesOut: boolean;
}

const RUNS: Run[] = [];
let editBar = 0;
for (const [i, run] of EDIT.entries()) {
  const lead = i === 0 ? 0 : XFADE_LEAD;
  const length = run.to === null ? null : run.to - run.from;
  RUNS.push({
    fadesIn: i > 0,
    fadesOut: i < EDIT.length - 1,
    frames:
      length === null
        ? undefined
        : bars(editBar + length) - bars(editBar) + lead,
    from: bars(editBar) - lead,
    songFrom: songBarFrame(run.from) - lead,
    songTo: run.to === null ? undefined : songBarFrame(run.to),
  });
  editBar += length ?? 0;
}

export const Soundtrack = () => (
  <>
    {RUNS.map((run) => {
      const { frames } = run;
      return (
        <Sequence
          durationInFrames={frames}
          from={run.from}
          key={run.songFrom}
          layout="none"
          name={`music: song frames ${run.songFrom}–${run.songTo ?? "end"}`}
        >
          <Html5Audio
            src={staticFile(SOUNDTRACK_SRC)}
            trimAfter={
              run.songTo === undefined ? undefined : run.songTo + LATENCY_FRAMES
            }
            trimBefore={run.songFrom + LATENCY_FRAMES}
            volume={(f) => {
              // Equal-power curves: the two sides aren't phase-coherent, so a
              // linear crossfade would sag in the middle.
              const fadeIn = run.fadesIn
                ? Math.sin(
                    (interpolate(f, [0, XFADE], [0, 1], CLAMP) * Math.PI) / 2
                  )
                : 1;
              const fadeOut =
                run.fadesOut && frames !== undefined
                  ? Math.cos(
                      (interpolate(
                        f,
                        [frames - 1 - XFADE, frames - 1],
                        [0, 1],
                        CLAMP
                      ) *
                        Math.PI) /
                        2
                    )
                  : 1;
              return VOLUME * Math.min(fadeIn, fadeOut);
            }}
          />
        </Sequence>
      );
    })}
  </>
);
