"use client";

import type { ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { DEPLOY_MARKS } from "./brand-marks";
import {
  BentoBackdrop,
  BrandTile,
  Chip,
  riseStyle,
  Tray,
  TwoTone,
} from "./primitives";
import { BEAT, bars, beats } from "./tempo";
import {
  ACCENT,
  CLAMP,
  EASE_OUT,
  INK,
  MONO,
  MUTED,
  MUTED_INK,
  SANS,
} from "./theme";

// The rest of the adapter surface as the homepage's bento: search, hosting,
// API references, and Ask AI, each a card of the factories its subpath
// exports. They pop in on sixteenths, then one per card is picked on the
// third bar's beats — the same picks the opening's config made — to say a
// swap is one line.

export const ADAPTERS_BARS = 4;
const DURATION = bars(ADAPTERS_BARS);

// Each card's chips pop on sixteenths, a card an eighth after the last; the
// picks land one per beat through the third bar.
const CHIP_POP = beats(1.5);
const cardPopAt = (cardIndex: number): number =>
  CHIP_POP + beats(cardIndex * 0.5);
const chipPopAt = (cardIndex: number, i: number): number =>
  cardPopAt(cardIndex) + Math.round((i * BEAT) / 4);
const PICK_AT = bars(2);
const pickAt = (cardIndex: number): number => PICK_AT + beats(cardIndex);

interface Card {
  title: string;
  body: string;
  path: string;
  factories: string[];
  picked: string;
}

const CARDS: Card[] = [
  {
    body: "Seven engines, from keyless local indexes to hosted search.",
    factories: [
      "orama",
      "flexsearch",
      "pagefind",
      "algolia",
      "oramaCloud",
      "typesense",
      "mixedbread",
    ],
    path: "blume/search",
    picked: "pagefind",
    title: "Search.",
  },
  {
    body: "Name a host and the build targets it, or leave it out to stay static.",
    factories: DEPLOY_MARKS.map((mark) => mark.factory),
    path: "blume/deploy",
    picked: "vercel",
    title: "Deployment.",
  },
  {
    body: "Native OpenAPI, AsyncAPI, and GraphQL pages, or an embedded Scalar reference.",
    factories: ["openapi", "asyncapi", "graphql", "scalar"],
    path: "blume/reference",
    picked: "openapi",
    title: "API references.",
  },
  {
    body: "Any gateway or OpenAI-compatible endpoint behind the in-page assistant.",
    factories: [
      "gateway",
      "openrouter",
      "llmgateway",
      "inkeep",
      "openaiCompatible",
    ],
    path: "blume/ai",
    picked: "openrouter",
    title: "Ask AI.",
  },
];

const usePop = (delay: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    config: { damping: 12, mass: 0.6, stiffness: 200 },
    fps,
    frame: frame - delay,
  });
  return {
    opacity: interpolate(s, [0, 0.3], [0, 1], CLAMP),
    transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
  };
};

const pickProgress = (frame: number, cardIndex: number): number =>
  interpolate(frame, [pickAt(cardIndex) - 2, pickAt(cardIndex) + 6], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

const PoppingChip = ({
  label,
  delay,
  selected,
}: {
  label: string;
  delay: number;
  selected: number;
}) => (
  <span style={{ display: "inline-block", ...usePop(delay) }}>
    <Chip label={`${label}()`} selected={selected} />
  </span>
);

const DeployTile = ({
  svg,
  factory,
  delay,
  selected,
}: {
  svg: string;
  factory: string;
  delay: number;
  selected: number;
}) => (
  <div
    style={{
      alignItems: "center",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      ...usePop(delay),
    }}
  >
    <BrandTile
      size={52}
      style={{
        boxShadow: `0 0 0 ${selected * 2}px ${ACCENT}, 0 8px 20px -8px rgb(28 40 64 / 0.18), 0 0 0 1px rgb(10 10 10 / 0.05)`,
      }}
      svg={svg}
    />
    <span
      style={{
        color: `color-mix(in oklab, ${ACCENT} ${selected * 100}%, ${MUTED_INK})`,
        fontFamily: MONO,
        fontSize: 12,
      }}
    >
      {factory}()
    </span>
  </div>
);

const BentoCard = ({
  card,
  index,
  children,
}: {
  card: Card;
  index: number;
  children: ReactNode;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        background: MUTED,
        borderRadius: 20,
        display: "flex",
        flexDirection: "column",
        isolation: "isolate",
        overflow: "hidden",
        padding: "0 24px 20px",
        position: "relative",
        ...riseStyle(frame, 12 + index * 5, 20, 18),
      }}
    >
      <BentoBackdrop style={{ zIndex: -1 }} />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {children}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.45 }}>
        <div
          style={{
            alignItems: "baseline",
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ color: INK, fontSize: 15, fontWeight: 500 }}>
            {card.title}
          </span>
          <span style={{ color: MUTED_INK, fontFamily: MONO, fontSize: 12 }}>
            {card.path}
          </span>
        </div>
        <div style={{ color: MUTED_INK, maxWidth: 440 }}>{card.body}</div>
      </div>
    </div>
  );
};

export const AdaptersScene = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, DURATION], [1, 1.025]);
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        flexDirection: "column",
        gap: 30,
        justifyContent: "center",
      }}
    >
      <TwoTone
        align="center"
        delay={2}
        fontSize={40}
        tagline="Same shape. Swap one line."
        title="Search, hosting, references, and Ask AI."
      />
      <Tray
        innerStyle={{
          backgroundColor: "transparent",
          display: "grid",
          gap: 8,
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
        }}
        style={{
          height: 470,
          transform: `scale(${drift})`,
          width: 1088,
        }}
      >
        {CARDS.map((card, cardIndex) => {
          const picked = pickProgress(frame, cardIndex);
          if (card.path === "blume/deploy") {
            return (
              <BentoCard card={card} index={cardIndex} key={card.path}>
                <div style={{ display: "flex", gap: 28 }}>
                  {DEPLOY_MARKS.map((mark, i) => (
                    <DeployTile
                      delay={chipPopAt(cardIndex, i)}
                      factory={mark.factory}
                      key={mark.factory}
                      selected={mark.factory === card.picked ? picked : 0}
                      svg={mark.svg}
                    />
                  ))}
                </div>
              </BentoCard>
            );
          }
          return (
            <BentoCard card={card} index={cardIndex} key={card.path}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                  maxWidth: 440,
                }}
              >
                {card.factories.map((factory, i) => (
                  <PoppingChip
                    delay={chipPopAt(cardIndex, i)}
                    key={factory}
                    label={factory}
                    selected={factory === card.picked ? picked : 0}
                  />
                ))}
              </div>
            </BentoCard>
          );
        })}
      </Tray>
    </AbsoluteFill>
  );
};
