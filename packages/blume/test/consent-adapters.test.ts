import { describe, expect, it } from "bun:test";

import { ETHYCA_BRIDGE } from "../src/consent/ethyca.ts";
import { consentHead } from "../src/consent/head.ts";
import { ethyca, native, osano } from "../src/consent/index.ts";
import { OSANO_BRIDGE } from "../src/consent/osano.ts";
import { EN_UI } from "../src/core/i18n-ui.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";
import { UI_PACKS } from "../src/core/ui-packs/index.ts";

describe("consent adapters", () => {
  it("returns plain descriptors with no secrets or dependencies", () => {
    expect(native()).toStrictEqual({
      kind: "native",
      options: {},
      requiredSecrets: [],
      runtimeDeps: [],
    });
    expect(native({ policy: "/privacy" }).options).toStrictEqual({
      policy: "/privacy",
    });
    expect(osano({ configId: "c", customerId: "a" }).kind).toBe("osano");
    expect(ethyca({ privacyCenter: "https://privacy.example.com" }).kind).toBe(
      "ethyca"
    );
  });

  it("validates as blume.config consent, and resolves to null when unset", () => {
    expect(blumeConfigSchema.parse({}).consent).toBeNull();
    expect(
      blumeConfigSchema.parse({ consent: native() }).consent
    ).toStrictEqual(native());
  });

  it("points a value that isn't an adapter at blume/consent", () => {
    for (const consent of [true, "native", [native()], { kind: "cookiebot" }]) {
      const result = blumeConfigSchema.safeParse({ consent });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain(
        'imported from "blume/consent"'
      );
    }
  });

  it("keeps an adapter's own option errors", () => {
    const missing = blumeConfigSchema.safeParse({
      consent: { ...osano({ configId: "c", customerId: "a" }), options: {} },
    });
    expect(missing.error?.issues[0]?.path).toStrictEqual([
      "consent",
      "options",
      "configId",
    ]);
    const insecure = blumeConfigSchema.safeParse({
      consent: ethyca({ privacyCenter: "ftp://privacy.example.com" }),
    });
    expect(insecure.success).toBe(false);
  });
});

describe(consentHead, () => {
  it("has no tags for the native banner", () => {
    expect(consentHead(native())).toStrictEqual([]);
  });

  it("loads Osano synchronously, then bridges it", () => {
    expect(
      consentHead(osano({ configId: "cfg/1", customerId: "Az0 9" }))
    ).toStrictEqual([
      {
        attributes: { src: "https://cmp.osano.com/Az0%209/cfg%2F1/osano.js" },
        content: null,
      },
      { attributes: {}, content: OSANO_BRIDGE },
    ]);
  });

  it("loads fides.js from the privacy center, then bridges it", () => {
    expect(
      consentHead(ethyca({ privacyCenter: "https://privacy.example.com/" }))
    ).toStrictEqual([
      {
        attributes: { src: "https://privacy.example.com/fides.js" },
        content: null,
      },
      { attributes: { "data-notice": "analytics" }, content: ETHYCA_BRIDGE },
    ]);
    const [loader, bridge] = consentHead(
      ethyca({
        notice: "measurement",
        privacyCenter: "https://example.com/privacy",
        propertyId: "FDS-A1 B2",
      })
    );
    expect(loader?.attributes.src).toBe(
      "https://example.com/privacy/fides.js?property_id=FDS-A1+B2"
    );
    expect(bridge?.attributes["data-notice"]).toBe("measurement");
  });
});

describe("consent UI strings", () => {
  const KEYS = [
    "accept",
    "decline",
    "label",
    "message",
    "policy",
    "settings",
  ] as const;

  it("translates every banner label in every shipped pack", () => {
    expect(Object.keys(EN_UI.consent)).toStrictEqual([...KEYS]);
    for (const [code, pack] of Object.entries(UI_PACKS)) {
      for (const key of KEYS) {
        expect(
          pack.consent?.[key],
          `pack "${code}" misses consent.${key}`
        ).toBeTruthy();
      }
    }
  });
});
