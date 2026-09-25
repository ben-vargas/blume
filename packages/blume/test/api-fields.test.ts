import { describe, expect, it } from "bun:test";

import { downlevelComponents } from "../src/ai/component-markdown.ts";
import {
  defaultLabel,
  fieldLabels,
  isOn,
  paramField,
} from "../src/components/content/api-field.ts";
import { BUILTIN_MDX_TAGS } from "../src/core/builtin-tags.ts";

/**
 * `<ParamField>` and `<ResponseField>` (`src/components/content`): Mintlify's
 * API field components, read the way the components render them, and
 * downleveled to Markdown for the `.md` mirrors, `llms-full.txt`, and MCP.
 */

describe(paramField, () => {
  it("names a parameter by its location attribute, else by `name`", () => {
    expect(paramField({ query: "limit" })).toEqual({
      location: "query",
      name: "limit",
    });
    expect(paramField({ body: "city", path: "id" })).toEqual({
      location: "path",
      name: "id",
    });
    expect(paramField({ name: "plain" })).toEqual({ name: "plain" });
  });
});

describe("field props", () => {
  it("reads flags, defaults, and labels the ways MDX passes them", () => {
    expect(isOn(true)).toBe(true);
    expect(isOn("true")).toBe(true);
    expect(isOn("false")).toBe(false);
    expect(isOn()).toBe(false);
    expect(defaultLabel("fast")).toBe("fast");
    expect(defaultLabel(20)).toBe("20");
    expect(defaultLabel({ a: [1] })).toBe('{"a":[1]}');
    expect(defaultLabel("")).toBeNull();
    expect(defaultLabel(null)).toBeNull();
    expect(defaultLabel()).toBeNull();
    expect(fieldLabels("beta")).toEqual(["beta"]);
    expect(fieldLabels(["a", "", "b"])).toEqual(["a", "b"]);
    expect(fieldLabels()).toEqual([]);
  });

  it("are built-in tags, so a page using them passes the component check", () => {
    expect(BUILTIN_MDX_TAGS.has("ParamField")).toBe(true);
    expect(BUILTIN_MDX_TAGS.has("ResponseField")).toBe(true);
  });
});

describe("the Markdown downlevel", () => {
  it("writes each field as a list item, its description and nested fields under it", async () => {
    const source = [
      '<ParamField path="userId" type="string" required>',
      "  The user's ID.",
      "</ParamField>",
      "",
      '<ParamField query="limit" type="integer" default={20} deprecated="true" />',
      "",
      '<ParamField body="address" type="object" default={{ city: "Oslo" }}>',
      '  <Expandable title="properties">',
      '    <ParamField body="city" type="string" required>',
      "      City name.",
      "    </ParamField>",
      "  </Expandable>",
      "</ParamField>",
      "",
      '<ParamField name="plain" default="x" />',
      "",
      '<ResponseField name="id" type="string" pre={["beta"]} post="read-only">',
      "  The object ID.",
      "</ResponseField>",
    ].join("\n");
    expect(await downlevelComponents(source)).toBe(
      [
        "- **`userId`** · path · `string` · required",
        "",
        "  The user's ID.",
        "",
        "- **`limit`** · query · `integer` · deprecated · default `20`",
        "",
        '- **`address`** · body · `object` · default `{"city":"Oslo"}`',
        "",
        "  **properties**",
        "",
        "  - **`city`** · body · `string` · required",
        "",
        "    City name.",
        "",
        "- **`plain`** · default `x`",
        "",
        "- beta · **`id`** · read-only · `string`",
        "",
        "  The object ID.",
      ].join("\n")
    );
  });

  it("leaves a nameless or unreadable field as written", async () => {
    const nameless = '<ResponseField type="string">Text.</ResponseField>';
    expect(await downlevelComponents(nameless)).toBe(nameless);
    const unreadable = "<ParamField query={name}>Text.</ParamField>";
    expect(await downlevelComponents(unreadable)).toBe(unreadable);
  });
});
