"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { BLUME_DOTS } from "@/scenes/blume-logo";

import {
  ACCENT,
  BENTO_DOTS,
  BORDER,
  CLAMP,
  EASE_OUT,
  INK,
  MONO,
  MUTED,
  MUTED_INK,
  RAISED_SHADOW,
  SANS,
  TERM_CMD,
  TERM_DIM,
  TERM_INFO,
  TERM_OK,
  TERM_OUT,
  TERM_PROMPT,
  TERMINAL_BG,
  TERMINAL_SHADOW,
  TRAY_SKY_COLOR,
  TRAY_SKY_IMAGE,
  WHITE,
} from "./theme";

// ─── Motion ─────────────────────────────────────────────────────────────────

/**
 * A blur filter that's gone entirely at rest. Chrome rasterizes a filtered
 * element at its own scale before the stage's 1.5× scale-up, so even a
 * sub-pixel blur renders visibly softer than no filter at all — a value that
 * hovers around zero (or dips negative, which is invalid CSS and drops the
 * filter) flickers between soft and crisp. Drive it from a clamped, monotonic
 * progress, never from a spring that overshoots.
 */
export const blurFilter = (px: number): string =>
  px > 0.05 ? `blur(${px}px)` : "none";

// The landing pages' reveal: rise a few pixels out of a soft blur.
export const riseStyle = (
  frame: number,
  delay: number,
  duration = 18,
  distance = 14
): CSSProperties => {
  const t = interpolate(frame - delay, [0, duration], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  return {
    filter: blurFilter((1 - t) * 8),
    opacity: t,
    transform: `translateY(${(1 - t) * distance}px)`,
  };
};

export const Rise = ({
  children,
  delay = 0,
  duration = 18,
  distance = 14,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ ...style, ...riseStyle(frame, delay, duration, distance) }}>
      {children}
    </div>
  );
};

// Fades a scene out over its last `exit` frames — lift, blur, fade — so the
// next scene's reveal reads as a continuation rather than a hard cut.
export const SceneExit = ({
  children,
  duration,
  exit = 10,
}: {
  children: ReactNode;
  duration: number;
  exit?: number;
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [duration - exit, duration], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  return (
    <AbsoluteFill
      style={{
        filter: blurFilter(t * 6),
        opacity: 1 - t,
        transform: `translateY(${t * -10}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ─── Type ───────────────────────────────────────────────────────────────────

// A heading in the pages' two-tone voice: a statement, then a muted follow-up
// on its own line. `inverse` is the white take for the sky.
export const TwoTone = ({
  title,
  tagline,
  fontSize = 44,
  align = "left",
  inverse = false,
  delay = 0,
  stagger = 6,
}: {
  title: ReactNode;
  tagline: ReactNode;
  fontSize?: number;
  align?: "left" | "center";
  inverse?: boolean;
  delay?: number;
  stagger?: number;
}) => {
  const frame = useCurrentFrame();
  return (
    <h2
      style={{
        fontFamily: SANS,
        fontSize,
        fontWeight: 500,
        letterSpacing: "-0.035em",
        lineHeight: 1.1,
        margin: 0,
        textAlign: align,
      }}
    >
      <span
        style={{
          color: inverse ? WHITE : INK,
          display: "block",
          ...riseStyle(frame, delay),
        }}
      >
        {title}
      </span>
      <span
        style={{
          color: inverse ? "rgb(255 255 255 / 0.7)" : MUTED_INK,
          display: "block",
          ...riseStyle(frame, delay + stagger),
        }}
      >
        {tagline}
      </span>
    </h2>
  );
};

// Inline code inside prose: mono, a touch smaller, in ink.
export const Code = ({ children }: { children: ReactNode }) => (
  <code
    style={{
      color: INK,
      fontFamily: MONO,
      fontSize: "0.9em",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </code>
);

// ─── Surfaces ───────────────────────────────────────────────────────────────

// The pages' one container language: an outer tray (hairline ring, 8px
// padding) holding an inner surface with a concentric radius.
export const Tray = ({
  children,
  tone = "muted",
  style,
  innerStyle,
}: {
  children: ReactNode;
  tone?: "muted" | "sky";
  style?: CSSProperties;
  innerStyle?: CSSProperties;
}) => (
  <div
    style={{
      background: WHITE,
      borderRadius: 28,
      boxShadow: `0 0 0 1px ${BORDER}`,
      boxSizing: "border-box",
      display: "flex",
      padding: 8,
      ...style,
    }}
  >
    <div
      style={{
        backgroundColor: tone === "sky" ? TRAY_SKY_COLOR : MUTED,
        backgroundImage: tone === "sky" ? TRAY_SKY_IMAGE : undefined,
        borderRadius: 20,
        flex: 1,
        overflow: "hidden",
        position: "relative",
        ...innerStyle,
      }}
    >
      {children}
    </div>
  </div>
);

// A bento card's dot grid and sky glow, fading out from the middle.
export const BentoBackdrop = ({ style }: { style?: CSSProperties }) => (
  <div
    style={{
      backgroundImage: BENTO_DOTS,
      backgroundSize: "16px 16px, 100% 100%",
      inset: 0,
      maskImage: "radial-gradient(70% 80% at 50% 50%, black 20%, transparent)",
      position: "absolute",
      ...style,
    }}
  />
);

// ─── Code window ────────────────────────────────────────────────────────────

// github-light, as Shiki paints the pages' code windows.
const TS_KEYWORD = "#d73a49";
const TS_CONSTANT = "#005cc5";
const TS_FUNCTION = "#6f42c1";
const TS_STRING = "#032f62";
const TS_TEXT = "#24292e";
const TS_COMMENT = "#6a737d";

const KEYWORDS = new Set([
  "as",
  "await",
  "const",
  "default",
  "export",
  "from",
  "import",
  "new",
  "return",
]);
const CONSTANTS = new Set(["false", "null", "true", "undefined"]);

interface Seg {
  color: string;
  text: string;
}

const tokenColor = (line: string, match: RegExpExecArray): string => {
  const [text, comment, str, num, ident] = match;
  if (comment) {
    return TS_COMMENT;
  }
  if (str) {
    return TS_STRING;
  }
  if (num) {
    return TS_CONSTANT;
  }
  if (!ident) {
    return TS_TEXT;
  }
  if (KEYWORDS.has(text)) {
    return TS_KEYWORD;
  }
  if (CONSTANTS.has(text)) {
    return TS_CONSTANT;
  }
  return line.charAt(match.index + text.length) === "(" ? TS_FUNCTION : TS_TEXT;
};

export const highlightTs = (line: string): Seg[] => {
  const segs: Seg[] = [];
  // Comment, string, number, identifier, then any run of everything else.
  // The groups are read by position (the typed lib predates `groups`).
  const re =
    /(?<comment>\/\/.*$)|(?<str>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(?<num>\b\d[\w.]*)|(?<ident>[A-Za-z_$][\w$]*)|\s+|[^\s\w$"']+/gu;
  let match = re.exec(line);
  while (match !== null) {
    segs.push({ color: tokenColor(line, match), text: match[0] });
    match = re.exec(line);
  }
  return segs;
};

const leadingSpace = (line: string): number =>
  /^\s*/u.exec(line)?.[0].length ?? 0;

// Cut a highlighted line down to its first `count` characters.
const sliceSegs = (segs: Seg[], count: number): Seg[] => {
  const out: Seg[] = [];
  let left = count;
  for (const seg of segs) {
    if (left <= 0) {
      break;
    }
    out.push({ color: seg.color, text: seg.text.slice(0, left) });
    left -= seg.text.length;
  }
  return out;
};

export interface TypingOptions {
  /** Frame the first character lands on. */
  start: number;
  /** Characters typed per frame. */
  speed: number;
  /** Extra frames held at the end of each line. */
  linePause?: number;
}

/**
 * The frame each line of `code` starts and finishes typing. Indentation lands
 * with the line's first character, and a blank line only costs its pause, so
 * scenes can sync other beats (a list row, a highlight) to a given line.
 */
export interface TypingSchedule {
  starts: number[];
  ends: number[];
}

export const typingSchedule = (
  code: string,
  { start, speed, linePause = 3 }: TypingOptions
): TypingSchedule => {
  const starts: number[] = [];
  const ends: number[] = [];
  let at = start;
  for (const line of code.split("\n")) {
    const body = line.length - leadingSpace(line);
    starts.push(at);
    at += body / speed;
    ends.push(at);
    at += linePause;
  }
  return { ends, starts };
};

/** Characters of each line visible at `frame` under `schedule`. */
const visibleChars = (
  lines: string[],
  schedule: TypingSchedule,
  frame: number
): number[] =>
  lines.map((line, i) => {
    const indent = leadingSpace(line);
    const startAt = schedule.starts[i] ?? 0;
    const endAt = schedule.ends[i] ?? 0;
    if (frame < startAt) {
      return 0;
    }
    if (frame >= endAt) {
      return line.length;
    }
    const typed = Math.floor(
      ((frame - startAt) / Math.max(endAt - startAt, 1)) *
        (line.length - indent)
    );
    return indent + typed;
  });

/** Index of the line holding the caret: the last one that has started. */
const caretLineAt = (schedule: TypingSchedule, frame: number): number => {
  let caret = 0;
  for (const [i, at] of schedule.starts.entries()) {
    if (frame >= at) {
      caret = i;
    }
  }
  return caret;
};

export interface LineBand {
  line: number;
  from: number;
  to: number;
}

const NO_BANDS: LineBand[] = [];

// How lit a line's band is: eased in over its first frames, out over its last.
const bandOpacity = (
  bands: LineBand[],
  line: number,
  frame: number
): number => {
  let lit = 0;
  for (const band of bands) {
    if (band.line === line) {
      const on = interpolate(frame, [band.from, band.from + 6], [0, 1], {
        ...CLAMP,
        easing: EASE_OUT,
      });
      const off = interpolate(frame, [band.to - 6, band.to], [1, 0], CLAMP);
      lit = Math.max(lit, Math.min(on, off));
    }
  }
  return lit;
};

const FILE_CODE_ICON = (
  <>
    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="m5 12-3 3 3 3" />
    <path d="m9 18 3-3-3-3" />
  </>
);

/**
 * The pages' raised code window — a file-name strip over github-light code —
 * typing itself out. The body scrolls to keep the caret in view once it runs
 * past `rows`, and `bands` wash single lines in accent while they're live.
 */
export const CodeWindow = ({
  title,
  code,
  typing,
  rows,
  fontSize = 13,
  lineHeight = 22,
  width,
  bands = NO_BANDS,
  caretUntil,
  style,
}: {
  title: string;
  code: string;
  typing: TypingOptions;
  rows: number;
  fontSize?: number;
  lineHeight?: number;
  width: number;
  bands?: LineBand[];
  /** Frame the caret stops blinking and hides; defaults to never. */
  caretUntil?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const lines = code.split("\n");
  const schedule = typingSchedule(code, typing);
  const visible = visibleChars(lines, schedule, frame);
  const highlighted = lines.map(highlightTs);

  // Keep the caret three rows off the bottom edge, eased over the last few
  // frames so the scroll glides instead of stepping a row at a time.
  const scrollFor = (f: number): number =>
    Math.max(0, caretLineAt(schedule, f) - (rows - 3)) * lineHeight;
  const smoothing = 6;
  let scroll = 0;
  for (let k = 0; k < smoothing; k += 1) {
    scroll += scrollFor(frame - k);
  }
  scroll /= smoothing;

  const caretLine = caretLineAt(schedule, frame);
  const typingNow =
    frame >= (schedule.starts[caretLine] ?? 0) &&
    frame < (schedule.ends[caretLine] ?? 0);
  const blinkOn = typingNow || Math.floor(frame / 16) % 2 === 0;
  const showCaret =
    frame >= typing.start && (caretUntil === undefined || frame < caretUntil);

  const padY = 16;
  return (
    <div
      style={{
        background: WHITE,
        borderRadius: 16,
        boxShadow: `${RAISED_SHADOW}, 0 0 0 1px rgb(10 10 10 / 0.05)`,
        overflow: "hidden",
        width,
        ...style,
      }}
    >
      <div
        style={{
          alignItems: "center",
          borderBottom: `1px solid ${BORDER}`,
          color: MUTED_INK,
          display: "flex",
          fontFamily: MONO,
          fontSize: 12,
          gap: 8,
          padding: "10px 16px",
        }}
      >
        <svg
          fill="none"
          height={14}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
          width={14}
        >
          {FILE_CODE_ICON}
        </svg>
        {title}
      </div>
      <div
        style={{
          height: rows * lineHeight + padY * 2,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize,
            left: 0,
            lineHeight: `${lineHeight}px`,
            padding: `${padY}px 0`,
            position: "absolute",
            right: 0,
            top: 0,
            transform: `translateY(${-scroll}px)`,
            whiteSpace: "pre",
          }}
        >
          {lines.map((line, i) => {
            const lit = bandOpacity(bands, i, frame);
            const isCaretLine = i === caretLine && showCaret;
            return (
              <div
                // oxlint-disable-next-line react-doctor/no-array-index-as-key -- a static listing whose blank lines repeat; the index is the stable key
                key={i}
                style={{
                  height: lineHeight,
                  padding: "0 20px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    background: `color-mix(in oklab, ${ACCENT} 12%, transparent)`,
                    boxShadow: `inset 2px 0 0 ${ACCENT}`,
                    inset: 0,
                    opacity: lit,
                    position: "absolute",
                  }}
                />
                <span style={{ position: "relative" }}>
                  {sliceSegs(highlighted[i] ?? [], visible[i] ?? 0).map(
                    (seg, j) => (
                      // oxlint-disable-next-line react-doctor/no-array-index-as-key -- token order within a fixed line
                      <span key={j} style={{ color: seg.color }}>
                        {seg.text}
                      </span>
                    )
                  )}
                  {isCaretLine && (
                    <span
                      style={{
                        background: ACCENT,
                        display: "inline-block",
                        height: lineHeight - 6,
                        marginLeft: 1,
                        opacity: blinkOn ? 1 : 0,
                        transform: "translateY(3px)",
                        verticalAlign: "top",
                        width: 2,
                      }}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Terminal ───────────────────────────────────────────────────────────────

export type TermTone = "cmd" | "dim" | "info" | "ok" | "out" | "prompt";

const TERM_COLORS: Record<TermTone, string> = {
  cmd: TERM_CMD,
  dim: TERM_DIM,
  info: TERM_INFO,
  ok: TERM_OK,
  out: TERM_OUT,
  prompt: TERM_PROMPT,
};

export interface TermLine {
  segs: { tone: TermTone; text: string }[];
  /** Frame the line appears (or starts typing, for a command). */
  at: number;
  /** Type the line's last segment out at this many characters per frame. */
  typeSpeed?: number;
}

/**
 * The CLI page's solid terminal: traffic lights over a dark body. Output lines
 * rise in at their frame; a command line types its last segment out, with a
 * block caret riding the end of the newest line.
 */
export const Terminal = ({
  lines,
  width,
  height,
  fontSize = 13,
  lineHeight = 24,
  style,
}: {
  lines: TermLine[];
  width: number;
  height: number;
  fontSize?: number;
  lineHeight?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const shown = lines.filter((line) => frame >= line.at);
  const last = shown.length - 1;
  return (
    <div
      style={{
        background: TERMINAL_BG,
        borderRadius: 16,
        boxShadow: `${TERMINAL_SHADOW}, inset 0 0 0 1px rgb(255 255 255 / 0.1)`,
        display: "flex",
        flexDirection: "column",
        height,
        overflow: "hidden",
        width,
        ...style,
      }}
    >
      <div
        style={{
          borderBottom: "1px solid rgb(255 255 255 / 0.1)",
          display: "flex",
          gap: 6,
          padding: "12px 16px",
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
          <span
            key={color}
            style={{
              background: color,
              borderRadius: 999,
              height: 10,
              width: 10,
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize,
          lineHeight: `${lineHeight}px`,
          padding: "16px 20px",
          whiteSpace: "pre",
        }}
      >
        {shown.map((line, i) => {
          const local = frame - line.at;
          const typed = line.typeSpeed
            ? Math.floor(local * line.typeSpeed)
            : Number.POSITIVE_INFINITY;
          const lastIndex = line.segs.length - 1;
          const rise = line.typeSpeed
            ? {}
            : {
                opacity: interpolate(local, [0, 6], [0, 1], CLAMP),
                transform: `translateY(${interpolate(local, [0, 6], [4, 0], CLAMP)}px)`,
              };
          return (
            <div
              // oxlint-disable-next-line react-doctor/no-array-index-as-key -- a fixed transcript; lines never reorder
              key={i}
              style={{ minHeight: lineHeight, ...rise }}
            >
              {line.segs.map((seg, j) => (
                <span
                  // oxlint-disable-next-line react-doctor/no-array-index-as-key -- segment order within a fixed line
                  key={j}
                  style={{ color: TERM_COLORS[seg.tone] }}
                >
                  {j === lastIndex ? seg.text.slice(0, typed) : seg.text}
                </span>
              ))}
              {i === last && (
                <span
                  style={{
                    background: "#d4d4d8",
                    display: "inline-block",
                    height: 16,
                    marginLeft: 2,
                    opacity:
                      line.typeSpeed || Math.floor(frame / 16) % 2 === 0
                        ? 1
                        : 0,
                    transform: "translateY(3px)",
                    width: 8,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Tiles and chips ────────────────────────────────────────────────────────

// A white brand tile: the mark centered with breathing room, on the pages'
// raised surface.
export const BrandTile = ({
  svg,
  size,
  inset = 0.24,
  style,
}: {
  svg: string;
  size: number;
  inset?: number;
  style?: CSSProperties;
}) => (
  <div
    style={{
      background: WHITE,
      borderRadius: size * 0.26,
      boxShadow: `0 1px 2px rgb(28 40 64 / 0.06), 0 8px 20px -8px rgb(28 40 64 / 0.18), 0 0 0 1px rgb(10 10 10 / 0.05)`,
      boxSizing: "border-box",
      height: size,
      padding: size * inset,
      width: size,
      ...style,
    }}
  >
    <div
      // Trusted, build-time SVG strings from brand-marks.ts.
      // oxlint-disable-next-line react/no-danger -- static brand marks, no user input
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ height: "100%", width: "100%" }}
    />
  </div>
);

// A full-bleed tile whose SVG carries its own background (the sources dock).
export const FullTile = ({
  svg,
  size,
  style,
}: {
  svg: string;
  size: number;
  style?: CSSProperties;
}) => (
  <div
    style={{
      borderRadius: size * 0.24,
      boxShadow: `0 1px 2px rgb(28 40 64 / 0.08), 0 0 0 1px rgb(10 10 10 / 0.06)`,
      height: size,
      overflow: "hidden",
      width: size,
      ...style,
    }}
  >
    <div
      // oxlint-disable-next-line react/no-danger -- static brand tiles, no user input
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ height: "100%", width: "100%" }}
    />
  </div>
);

// A factory call as a mono pill. `selected` (0–1) fades in the accent state.
export const Chip = ({
  label,
  selected = 0,
  fontSize = 13,
  style,
}: {
  label: string;
  selected?: number;
  fontSize?: number;
  style?: CSSProperties;
}) => (
  <span
    style={{
      background: `color-mix(in oklab, ${ACCENT} ${selected * 10}%, ${WHITE})`,
      borderRadius: 999,
      boxShadow: `0 0 0 ${1 + selected * 0.5}px color-mix(in oklab, ${ACCENT} ${selected * 100}%, ${BORDER}), 0 1px 2px rgb(28 40 64 / 0.06)`,
      color: `color-mix(in oklab, ${ACCENT} ${selected * 100}%, ${INK})`,
      display: "inline-block",
      fontFamily: MONO,
      fontSize,
      lineHeight: 1,
      padding: "8px 12px",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {label}
  </span>
);

// ─── Sky pieces ─────────────────────────────────────────────────────────────

const COPY_ICON = (
  <>
    <rect height="14" rx="2" ry="2" width="14" x="8" y="8" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </>
);

// The hero's glass install box, typing its command from `typeFrom`.
export const GlassInstallBox = ({
  command,
  typeFrom = 0,
  speed = 0.8,
  width = 300,
}: {
  command: string;
  typeFrom?: number;
  speed?: number;
  width?: number;
}) => {
  const frame = useCurrentFrame();
  const typed = Math.max(0, Math.floor((frame - typeFrom) * speed));
  const done = typed >= command.length;
  const caretOn = !done || Math.floor(frame / 16) % 2 === 0;
  return (
    <div
      style={{
        alignItems: "center",
        background: "rgb(255 255 255 / 0.1)",
        borderRadius: 10,
        boxShadow:
          "0 1px 2px rgb(0 0 0 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 0 0 1px rgb(255 255 255 / 0.28)",
        boxSizing: "border-box",
        color: WHITE,
        display: "flex",
        fontFamily: MONO,
        fontSize: 14,
        gap: 12,
        padding: "8px 8px 8px 16px",
        width,
      }}
    >
      <span style={{ color: "rgb(255 255 255 / 0.6)" }}>$</span>
      <span style={{ flex: 1 }}>
        {command.slice(0, typed)}
        <span
          style={{
            background: "rgb(255 255 255 / 0.85)",
            display: "inline-block",
            height: 16,
            marginLeft: 1,
            opacity: caretOn ? 1 : 0,
            transform: "translateY(3px)",
            width: 2,
          }}
        />
      </span>
      <span
        style={{
          alignItems: "center",
          color: "rgb(255 255 255 / 0.7)",
          display: "inline-flex",
          height: 32,
          justifyContent: "center",
          width: 32,
        }}
      >
        <svg
          fill="none"
          height={16}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
          width={16}
        >
          {COPY_ICON}
        </svg>
      </span>
    </div>
  );
};

// The install CTA's frosted tile: the Blume mark's petals pop in one by one
// (center first, then the ring clockwise) and the tile drifts gently.
export const GlassMarkTile = ({
  size = 240,
  delay = 0,
}: {
  size?: number;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;
  const drift = Math.sin(Math.max(0, local - 30) / 34) * 5;
  const markHeight = size * 0.44;
  return (
    <div
      style={{
        ...riseStyle(frame, delay, 24, 24),
        alignItems: "center",
        backdropFilter: "blur(24px)",
        background: "rgb(255 255 255 / 0.1)",
        borderRadius: size * 0.19,
        boxShadow:
          "inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 0 0 1px rgb(255 255 255 / 0.14), 0 40px 80px -20px rgb(3 8 22 / 0.45)",
        display: "flex",
        height: size,
        justifyContent: "center",
        translate: `0 ${drift}px`,
        width: size,
      }}
    >
      <svg
        fill="none"
        height={markHeight}
        style={{ overflow: "visible" }}
        viewBox="0 0 288 320"
        width={markHeight * (288 / 320)}
      >
        {BLUME_DOTS.map((dot) => {
          const s = spring({
            config: { damping: 11, mass: 0.6, stiffness: 190 },
            fps,
            frame: local - 8 - dot.order * 2.2,
          });
          return (
            <path
              d={dot.d}
              fill={WHITE}
              key={dot.order}
              style={{
                opacity: interpolate(s, [0, 0.2], [0, 1], CLAMP),
                transform: `scale(${interpolate(s, [0, 1], [0.2, 1])})`,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
          );
        })}
      </svg>
    </div>
  );
};
