import { describe, expect, it } from "bun:test";

import type { McpData } from "../src/ai/mcp/data.ts";
import { createMcpFetchHandler } from "../src/ai/mcp/server.ts";

/**
 * The hosted MCP endpoint's protocol errors: a malformed `tools/call` is
 * Invalid params (-32602) with a short message, an unknown method stays
 * Method not found, and the request body is read under a size cap before the
 * SDK transport parses it.
 */

const DATA: McpData = {
  base: "",
  documents: [],
  name: "Test Docs",
  navigation: { featured: [], selectors: [], sidebar: [], tabs: [] },
  pages: { "/intro": "# Intro\n" },
  routes: [],
  site: null,
  version: "0.0.0",
};

const handler = createMcpFetchHandler(DATA);

const HEADERS = {
  accept: "application/json, text/event-stream",
  "content-type": "application/json",
};

interface RpcError {
  error?: { code: number; message: string };
  result?: { content?: { text: string }[] };
}

const post = (body: string, headers: Record<string, string> = HEADERS) =>
  handler(
    new Request("https://docs.example.com/mcp", {
      body,
      headers,
      method: "POST",
    })
  );

const call = async (params: Record<string, string | number | null>) => {
  const response = await post(
    JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/call", params })
  );
  const body: RpcError = await response.json();
  return body;
};

describe("MCP tools/call errors", () => {
  it("answers non-object arguments with Invalid params, not a Zod dump", async () => {
    for (const args of ["hi", 5, null]) {
      // oxlint-disable-next-line no-await-in-loop -- one request at a time keeps the assertions ordered
      const body = await call({ arguments: args, name: "search_docs" });
      expect(body.error?.code).toBe(-32_602);
      expect(body.error?.message).toContain("Invalid tools/call params");
      expect(body.error?.message).not.toContain("invalid_type");
    }
  });

  it("answers a missing tool name with Invalid params", async () => {
    const body = await call({});
    expect(body.error?.code).toBe(-32_602);
  });

  it("still runs a well-formed call", async () => {
    const page = await post(
      JSON.stringify({
        id: 2,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: { route: "/intro" }, name: "get_page" },
      })
    );
    const result: RpcError = await page.json();
    expect(result.result?.content?.[0]?.text).toBe("# Intro\n");
  });

  it("keeps an unknown method as Method not found", async () => {
    const response = await post(
      JSON.stringify({ id: 1, jsonrpc: "2.0", method: "bogus/method" })
    );
    const body: RpcError = await response.json();
    expect(body.error?.code).toBe(-32_601);
  });
});

describe("MCP request body cap", () => {
  it("refuses a body over 64 KB with 413 and CORS headers", async () => {
    const response = await post(" ".repeat(70_000));
    expect(response.status).toBe(413);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    const body: RpcError = await response.json();
    expect(body.error?.message).toContain("64 KB");
  });

  it("still reports a malformed body as a parse error", async () => {
    const response = await post("{not json");
    expect(response.status).toBe(400);
    const body: RpcError = await response.json();
    expect(body.error?.code).toBe(-32_700);
  });

  it("passes other methods through to the transport untouched", async () => {
    const response = await handler(
      new Request("https://docs.example.com/mcp", {
        headers: HEADERS,
        method: "HEAD",
      })
    );
    expect(response.status).toBe(405);
  });
});
