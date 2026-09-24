"use client";

import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// The Blume mark (apps/docs/public/logo.svg): seven dots — a center plus six around
// it. Each `d` is paired with a bloom `order` so the center pops first and the
// ring sweeps in clockwise. Paths use `currentColor`, so the mark takes its
// color from the svg's `color`.
export const BLUME_DOTS: { d: string; order: number }[] = [
  // center
  {
    d: "M143.797 114.433C168.964 114.433 189.366 134.835 189.366 160.002C189.366 185.169 168.964 205.572 143.797 205.572C118.63 205.572 98.2275 185.169 98.2275 160.002C98.2277 134.835 118.63 114.433 143.797 114.433Z",
    order: 0,
  },
  // top center
  {
    d: "M143.797 1.01514C168.964 1.01514 189.366 21.4172 189.366 46.5845C189.366 71.7519 168.964 92.1548 143.797 92.1548C118.63 92.1547 98.2275 71.7518 98.2275 46.5845C98.2277 21.4173 118.63 1.01525 143.797 1.01514Z",
    order: 1,
  },
  // upper right
  {
    d: "M241.012 57.7251C266.179 57.7251 286.581 78.1271 286.581 103.294C286.581 128.462 266.179 148.865 241.012 148.865C215.844 148.865 195.442 128.462 195.442 103.294C195.443 78.1272 215.845 57.7252 241.012 57.7251Z",
    order: 2,
  },
  // lower right
  {
    d: "M241.012 171.143C266.179 171.143 286.581 191.545 286.581 216.712C286.581 241.879 266.179 262.282 241.012 262.282C215.844 262.282 195.442 241.879 195.442 216.712C195.443 191.545 215.845 171.143 241.012 171.143Z",
    order: 3,
  },
  // bottom center
  {
    d: "M143.797 227.85C168.964 227.85 189.366 248.252 189.366 273.419C189.366 298.587 168.964 318.99 143.797 318.99C118.63 318.99 98.2275 298.587 98.2275 273.419C98.2277 248.252 118.63 227.85 143.797 227.85Z",
    order: 4,
  },
  // lower left
  {
    d: "M46.582 171.143C71.7493 171.143 92.1512 191.545 92.1514 216.712C92.1514 241.879 71.7494 262.282 46.582 262.282C21.4147 262.282 1.0127 241.879 1.0127 216.712C1.01283 191.545 21.4148 171.143 46.582 171.143Z",
    order: 5,
  },
  // upper left
  {
    d: "M46.582 57.7251C71.7493 57.7251 92.1512 78.1271 92.1514 103.294C92.1514 128.462 71.7494 148.865 46.582 148.865C21.4147 148.865 1.0127 128.462 1.0127 103.294C1.01283 78.1272 21.4148 57.7252 46.582 57.7251Z",
    order: 6,
  },
];

export interface BlumeLogoProps {
  color?: string;
  markHeight?: number;
  wordmark?: string;
  /** Wordmark cap height ≈ markHeight, so the two read as the same height. */
  wordmarkSize?: number;
  gap?: number;
  dotStagger?: number;
  wordmarkDelay?: number;
  speed?: number;
}

export const BlumeLogo = ({
  color = "#ffffff",
  markHeight = 118,
  wordmark = "Blume",
  wordmarkSize = 152,
  gap = 30,
  dotStagger = 3,
  wordmarkDelay = 22,
  speed = 1,
}: BlumeLogoProps) => {
  const frame = useCurrentFrame() * speed;
  const { fps } = useVideoConfig();

  const markWidth = markHeight * (288 / 320);

  const wordEasing = Easing.bezier(0.22, 1, 0.36, 1);
  const wl = frame - wordmarkDelay;
  const wordOpacity = interpolate(wl, [0, 20], [0, 1], {
    easing: wordEasing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordX = interpolate(wl, [0, 20], [-14, 0], {
    easing: wordEasing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordBlur = interpolate(wl, [0, 20], [10, 0], {
    easing: wordEasing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const containerStyle = {
    alignItems: "center",
    background: "transparent",
    display: "flex",
    flexDirection: "row",
    gap,
    inset: 0,
    justifyContent: "center",
    position: "absolute",
  } as const;

  const wordmarkStyle = {
    color,
    filter: wordBlur > 0.05 ? `blur(${wordBlur}px)` : "none",
    fontFamily:
      "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: wordmarkSize,
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    opacity: wordOpacity,
    transform: `translateY(-0.01em) translateX(${wordX}px)`,
  } as const;

  return (
    <div style={containerStyle}>
      <svg
        width={markWidth}
        height={markHeight}
        viewBox="0 0 288 320"
        fill="none"
        style={{ color, overflow: "visible" }}
        aria-label={wordmark}
      >
        {BLUME_DOTS.map((dot) => {
          const local = frame - dot.order * dotStagger;
          const s = spring({
            config: { damping: 12, mass: 0.6, stiffness: 200 },
            fps,
            frame: local,
          });
          const scale = interpolate(s, [0, 1], [0, 1]);
          const opacity = interpolate(local, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          // Blur on the clock, not the spring: the spring overshoots past 1,
          // and a blur that dips negative (invalid, so no filter) and back
          // flickers each dot between crisp and soft as it settles.
          const blur = interpolate(local, [0, 5], [7, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <path
              key={dot.order}
              d={dot.d}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={2.02532}
              style={{
                filter: blur > 0.05 ? `blur(${blur}px)` : "none",
                opacity,
                transform: `scale(${scale})`,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
          );
        })}
      </svg>

      <span style={wordmarkStyle}>{wordmark}</span>
    </div>
  );
};
