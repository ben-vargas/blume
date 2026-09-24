import { describe, expect, it } from "bun:test";

import { resolveDateFormatOptions } from "../src/core/date-format.ts";
import { blumeConfigSchema } from "../src/core/schema.ts";

const DATE = new Date("2026-07-21T00:00:00Z");

/** How a date renders in English under a configured `dateFormat`. */
const render = (dateFormat?: Record<string, string>): string => {
  const config = blumeConfigSchema.parse(dateFormat ? { dateFormat } : {});
  return new Intl.DateTimeFormat(
    "en",
    resolveDateFormatOptions(config.dateFormat)
  ).format(DATE);
};

describe("dateFormat shape", () => {
  it("keeps the long form when only the zone, calendar, or digits change", () => {
    expect(render()).toBe("July 21, 2026");
    expect(render({ timeZone: "Asia/Tokyo" })).toBe("July 21, 2026");
    expect(render({ numberingSystem: "latn" })).toBe("July 21, 2026");
    expect(
      blumeConfigSchema.parse({ dateFormat: { calendar: "japanese" } })
        .dateFormat
    ).toStrictEqual({ calendar: "japanese", dateStyle: "long" });
  });

  it("uses the shape a preset or a component field sets", () => {
    expect(render({ dateStyle: "short", timeZone: "Asia/Tokyo" })).toBe(
      "7/21/26"
    );
    expect(render({ day: "2-digit", month: "2-digit", year: "numeric" })).toBe(
      "07/21/2026"
    );
    expect(render({ weekday: "long" })).toBe("Tuesday");
  });
});
