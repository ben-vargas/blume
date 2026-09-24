import { describe, expect, it } from "bun:test";

import { buildApiSpec } from "../src/ai/api/spec.ts";

/**
 * The Streamable HTTP transport answers 406 unless a client accepts both
 * `application/json` and `text/event-stream`. OpenAPI ignores an `Accept`
 * header parameter, so the operation lists both response media types —
 * which is what a generated client builds its `Accept` header from — and
 * says so in its description.
 */
describe("the OpenAPI MCP operation", () => {
  const spec = buildApiSpec({
    agentReadability: false,
    base: "",
    llmsTxt: false,
    mcpRoute: "/mcp",
    name: "Acme",
    search: false,
    site: null,
    version: "1.2.3",
  });
  const operation = spec.paths["/mcp"]?.post;

  it("lists both media types the transport requires a client to accept", () => {
    expect(Object.keys(operation?.responses["200"]?.content ?? {})).toEqual([
      "application/json",
      "text/event-stream",
    ]);
    expect(operation?.description).toContain(
      "Accept: application/json, text/event-stream"
    );
  });

  it("documents the 406 a client without that Accept header gets", () => {
    expect(operation?.responses["406"]?.description).toContain("Accept");
  });
});
