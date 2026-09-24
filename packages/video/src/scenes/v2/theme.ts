import { Easing } from "remotion";

// Design tokens for the 2.0 launch video, lifted from the redesigned landing
// pages (apps/docs/pages/_home): the light theme's ink/muted/border tokens, the
// hero's sky ramp, Inter over IBM Plex Mono, and the pages' ease-out curve.

export const INK = "oklch(0.145 0 0)";
export const MUTED_INK = "oklch(0.53 0 0)";
export const MUTED = "oklch(0.965 0 0)";
export const BORDER = "oklch(0.88 0.006 260 / 0.72)";
export const ACCENT = "rgb(72 120 176)";
export const WHITE = "#ffffff";

// The hero sky, deepest first (Hero.astro's `--sky-1` … `--sky-6`).
export const SKY_1 = "rgb(31 83 144)";
export const SKY_2 = "rgb(38 88 150)";
export const SKY_3 = "rgb(47 95 156)";
export const SKY_4 = "rgb(55 104 163)";
export const SKY_5 = "rgb(72 120 176)";
export const SKY_6 = "rgb(93 137 186)";

// The CLI page's always-dark terminal and its ANSI-ish roles.
export const TERMINAL_BG = "#0d0f12";
export const TERM_PROMPT = "#2dd4bf";
export const TERM_CMD = "#f4f4f5";
export const TERM_OUT = "#a1a1aa";
export const TERM_DIM = "#71717a";
export const TERM_OK = "#34d399";
export const TERM_INFO = "#38bdf8";

// Both faces are wired to these variables by the composition root.
export const SANS = "var(--font-sans), ui-sans-serif, system-ui, sans-serif";
export const MONO =
  "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// The hero: a radial sky, deep blue at the top fading to white by the bottom.
export const HERO_SKY = `radial-gradient(150% 108% at 50% -4%, ${SKY_1} 0%, ${SKY_2} 8%, ${SKY_3} 18%, ${SKY_4} 29%, ${SKY_5} 44%, ${SKY_6} 60%, color-mix(in oklab, ${SKY_6} 55%, ${WHITE}) 70%, color-mix(in oklab, ${SKY_6} 22%, ${WHITE}) 80%, ${WHITE} 88%)`;

// The install CTA: the hero sky on its side, deepest at the top-left.
export const CTA_SKY = `radial-gradient(140% 130% at 100% 100%, ${SKY_6} 0%, ${SKY_5} 30%, ${SKY_3} 62%, ${SKY_1} 100%)`;

// The `sky` tray the feature mocks float on: deepest at the bottom-left,
// washing out to near-white at the top-right.
export const TRAY_SKY_COLOR = `color-mix(in oklab, ${SKY_5} 12%, ${WHITE})`;
export const TRAY_SKY_IMAGE = `radial-gradient(100% 90% at 0% 100%, color-mix(in oklab, ${SKY_5} 50%, transparent), transparent 70%), radial-gradient(80% 70% at 100% 0%, color-mix(in oklab, ${WHITE} 80%, transparent), transparent 70%)`;

// The bento cards' dot grid over a whisper of sky, both fading toward the
// card's edges.
export const BENTO_DOTS = `radial-gradient(color-mix(in oklab, ${INK} 14%, transparent) 1px, transparent 1px), radial-gradient(closest-side, color-mix(in oklab, ${SKY_5} 16%, transparent), transparent)`;

// Raised white surfaces (code windows, tiles) cast this soft navy shadow.
export const RAISED_SHADOW =
  "0 20px 25px -5px rgb(28 40 64 / 0.12), 0 8px 10px -6px rgb(28 40 64 / 0.12)";
export const TERMINAL_SHADOW = "0 40px 80px -24px rgb(28 40 64 / 0.45)";
