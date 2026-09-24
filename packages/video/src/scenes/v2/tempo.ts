// The beat grid the 2.0 cut is timed to: Basixx's "Disc Me Bro" (Epidemic
// Sound). Epidemic lists it at 119 BPM, but it's 120 on the nose — its
// sections sit exactly 48.000s (24 bars) apart and every kick, clap, and hat
// lands on a whole or half second. At 30fps that's 15 frames a beat and 60 a
// bar, so the grid never rounds. Every scene lasts whole bars and every
// splice in the edit is on a downbeat, so one grid serves the whole video.

export const FPS = 30;
export const BPM = 120;

/** Frames per beat and per bar at 30fps (15 and 60). */
export const BEAT = (60 / BPM) * FPS;
export const BAR = BEAT * 4;

/** The frame `n` bars (fractional allowed) from a scene's start. */
export const bars = (n: number): number => Math.round(n * BAR);

/** The frame `n` beats (fractional allowed) from a scene's start. */
export const beats = (n: number): number => Math.round(n * BEAT);

// Where the song's bars fall: after a riser, bar 1's downbeat is at 1.000s,
// and every section change (33s, 49s, 81s, 97s) and the final stop (161s)
// lands on a later one.
const SONG_BAR_ONE_SECONDS = 1;

/** The frame in the song file where song bar `bar` starts. */
export const songBarFrame = (bar: number): number =>
  Math.round(SONG_BAR_ONE_SECONDS * FPS + (bar - 1) * BAR);
