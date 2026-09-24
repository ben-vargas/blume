import { describe, expect, it } from "bun:test";

import { buildGraphqlDocument } from "../src/openapi/graphql-build.ts";

/**
 * Subgraph and platform schemas use directives their server defines out of
 * band. Strict SDL validation rejected each as `Unknown directive`, failing
 * the build; the reference now drops them and keeps every other check.
 */

describe("SDL with undeclared directives", () => {
  it("builds an Apollo Federation subgraph", () => {
    const document = buildGraphqlDocument(`
      extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key", "@shareable"])

      type Query {
        product(id: ID!): Product
        legacy: String @deprecated(reason: "Use product.")
      }

      type Product @key(fields: "id") @key(fields: "sku") {
        id: ID!
        sku: String @shareable
      }
    `);
    const query = document.types.Query;
    expect(query?.fields?.map((field) => field.name)).toStrictEqual([
      "product",
      "legacy",
    ]);
    // Built-in directives still apply.
    expect(query?.fields?.[1]?.deprecationReason).toBe("Use product.");
    expect(document.types.Product).toBeDefined();
  });

  it("builds an AppSync schema and keeps a declared custom directive", () => {
    const document = buildGraphqlDocument(`
      directive @audit(level: Int) on FIELD_DEFINITION

      type Query {
        note(id: ID!): Note @aws_api_key @aws_cognito_user_pools
      }

      type Note @aws_iam {
        id: ID!
        body: String @audit(level: 2)
      }
    `);
    expect(
      document.types.Note?.fields?.map((field) => field.name)
    ).toStrictEqual(["id", "body"]);
  });

  it("still rejects a syntax error or an unknown type", () => {
    expect(() => buildGraphqlDocument("type Query {")).toThrow(/Syntax Error/u);
    expect(() =>
      buildGraphqlDocument('type Query { pet: Pet @key(fields: "id") }')
    ).toThrow(/Unknown type "Pet"/u);
  });
});
