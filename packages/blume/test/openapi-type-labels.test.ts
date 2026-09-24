import { describe, expect, it } from "bun:test";

import { isNullable, typeLabel } from "../src/components/openapi/helpers.ts";

/**
 * Type labels for the shapes the 3.1 upgrade produces: a 3.0 `nullable`
 * `$ref` becomes `anyOf: [$ref, { type: "null" }]`, and 3.1 type arrays can
 * name several types at once.
 */

describe("typeLabel", () => {
  it("labels an upgraded nullable ref by its model and marks it nullable", () => {
    const schema = {
      anyOf: [{ $ref: "#/components/schemas/Pet" }, { type: "null" }],
    };
    expect(typeLabel(schema)).toBe("Pet");
    expect(isNullable(schema)).toBe(true);
    expect(
      isNullable({ oneOf: [{ type: "string" }, { type: ["null"] }] })
    ).toBe(true);
    expect(isNullable({ anyOf: [{ type: "string" }] })).toBe(false);
  });

  it("names a null-only schema null, not any", () => {
    expect(typeLabel({ type: "null" })).toBe("null");
    expect(typeLabel({ anyOf: [{ type: "null" }] })).toBe("null");
    // An empty union still reads as `any`.
    expect(typeLabel({ oneOf: [] })).toBe("any");
  });

  it("lists every type a 3.1 type array names", () => {
    expect(typeLabel({ type: ["string", "integer"] })).toBe("string | integer");
    expect(
      typeLabel({
        items: { type: "string" },
        type: ["array", "null", "string"],
      })
    ).toBe("string[] | string");
    // One non-null type keeps its single-type label, format included.
    expect(typeLabel({ format: "date", type: ["string", "null"] })).toBe(
      "string<date>"
    );
  });
});
