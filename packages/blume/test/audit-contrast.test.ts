import { describe, expect, it } from "bun:test";

import { contrastChecks } from "../src/audit/checks/contrast.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import type { BlumeConfigInput } from "../src/core/schema.ts";
import type { Diagnostic } from "../src/core/types.ts";
import { context } from "./audit-support.ts";

/** The contrast findings for a theme config, as the audit reports them. */
const audit = async (
  theme: BlumeConfigInput["theme"] = {}
): Promise<Diagnostic[]> =>
  await contrastChecks.run(
    context({
      configFile: "/site/blume.config.ts",
      theme: blumeConfigSchema.parse({ theme }).theme,
    })
  );

/** Each finding's code and message, for compact assertions. */
const messages = (found: Diagnostic[]): string[] =>
  found.map(
    (item) => `${item.code.replace("BLUME_AUDIT_", "")}: ${item.message}`
  );

describe("theme contrast checks", () => {
  it("passes the default theme and every accent preset", async () => {
    expect(await audit()).toStrictEqual([]);
    const presets = await Promise.all(
      ["blue", "green", "orange", "pink", "purple", "red", "teal"].map(
        (accent) => audit({ accent, action: accent })
      )
    );
    expect(presets.flat()).toStrictEqual([]);
  });

  it("flags accent text that's too light for the light page", async () => {
    const [found, ...rest] = await audit({ accent: "#8ab4f8" });
    expect(rest).toStrictEqual([]);
    expect(found).toMatchObject({
      code: "BLUME_AUDIT_THEME_CONTRAST_LOW",
      file: "/site/blume.config.ts",
      message:
        "Accent text on the page in light mode is 2.11:1, under the 4.5:1 WCAG AA asks of body text (`theme.accent`).",
      severity: "warning",
      suggestion:
        "Darken `theme.accent`'s light shade (`theme.accent: { light, dark }`).",
      url: "/",
    });
  });

  it("flags accent text that's too dark for the dark page", async () => {
    expect(
      messages(await audit({ accent: { dark: "#1d4ed8", light: "#1d4ed8" } }))
    ).toStrictEqual([
      "THEME_CONTRAST_LOW: Accent text on the page in dark mode is 3.10:1, under the 4.5:1 WCAG AA asks of body text (`theme.accent`).",
    ]);
  });

  it("flags a fill no label reads on, for the accent and the action", async () => {
    const found = messages(
      await audit({ accent: "#777777", action: "#777777" })
    );
    expect(found).toStrictEqual([
      "THEME_CONTRAST_LOW: Accent text on the page in light mode is 4.48:1, under the 4.5:1 WCAG AA asks of body text (`theme.accent`).",
      "THEME_CONTRAST_LOW: Button labels on the accent in light mode is 4.48:1, under the 4.5:1 WCAG AA asks of body text (`theme.accent`).",
      "THEME_CONTRAST_LOW: The call-to-action label in light mode is 4.48:1, under the 4.5:1 WCAG AA asks of body text (`theme.action`).",
    ]);
  });

  it("checks body text and the accent on a custom background", async () => {
    const found = messages(
      await audit({ background: { dark: "oklch(0.3 0 0)", light: "#999999" } })
    );
    expect(found.every((line) => line.startsWith("THEME_CONTRAST_LOW"))).toBe(
      true
    );
    expect(found.map((line) => line.split(" is ")[0])).toStrictEqual([
      "THEME_CONTRAST_LOW: Secondary text on the page in light mode",
      "THEME_CONTRAST_LOW: Accent text on the page in light mode",
      "THEME_CONTRAST_LOW: Accent text on the page in dark mode",
    ]);
  });

  it("says once when it can't read a color, and skips what it can't measure", async () => {
    expect(messages(await audit({ accent: "var(--brand)" }))).toStrictEqual([
      'THEME_COLOR_UNCHECKED: `theme.accent` is "var(--brand)", which the audit can\'t read as a color, so its contrast went unchecked.',
    ]);
    const background = messages(
      await audit({
        accent: "#8ab4f8",
        action: "color-mix(in oklab, red, blue)",
        background: { light: "color-mix(in oklab, white, red)" },
      })
    );
    expect(background).toStrictEqual([
      'THEME_COLOR_UNCHECKED: `theme.background` is "color-mix(in oklab, white, red)", which the audit can\'t read as a color, so its contrast went unchecked.',
      'THEME_COLOR_UNCHECKED: `theme.action` is "color-mix(in oklab, red, blue)", which the audit can\'t read as a color, so its contrast went unchecked.',
    ]);
  });
});
