import { describe, expect, it } from "bun:test";

import { normalize, upgrade } from "@scalar/openapi-parser";

import {
  declaredExample,
  exampleValue,
  responseExample,
} from "../src/components/openapi/helpers.ts";
import type {
  ParameterLike,
  SchemaLike,
  SpecValue,
} from "../src/components/openapi/helpers.ts";
import { operationModel } from "../src/components/openapi/operation-model.ts";
import {
  buildRequest,
  defaultValues,
} from "../src/components/openapi/request.ts";

/**
 * Author-written examples survive Scalar's upgrade: an OpenAPI 3.0 or Swagger
 * 2.0 `example` on a parameter or media type is moved into
 * `examples.default.value`, so the samples, the playground prefill, and the
 * Response panel read that location as well as a plain `example`.
 */

interface MediaType {
  schema?: SchemaLike;
  example?: SpecValue;
  examples?: SpecValue;
}

interface UpgradedOperation {
  parameters?: ParameterLike[];
  requestBody?: { content: Record<string, MediaType> };
  responses: Record<string, { content?: Record<string, MediaType> }>;
}

interface UpgradedDocument {
  components?: { schemas?: Record<string, SchemaLike> };
  paths: Record<string, { post?: UpgradedOperation }>;
}

/** Upgrade a document the way `parseSpec` does and pull out one operation. */
const upgraded = (spec: SpecValue, path: string) => {
  const { specification } = upgrade(normalize(JSON.stringify(spec)));
  // SAFETY: the fixtures below are OpenAPI documents, which the upgrade keeps
  // in this shape; the view names only the fields these tests read.
  const document = specification as UpgradedDocument;
  const operation = document.paths[path]?.post;
  if (!operation) {
    throw new Error(`fixture has no POST ${path}`);
  }
  return { operation, schemas: document.components?.schemas ?? {} };
};

const SPEC_30 = {
  components: {
    schemas: {
      Pet: {
        properties: {
          age: { type: "integer" },
          id: { readOnly: true, type: "string" },
          name: { type: "string" },
          password: { type: "string", writeOnly: true },
        },
        required: ["id", "name"],
        type: "object",
      },
    },
  },
  info: { title: "Pets", version: "1" },
  openapi: "3.0.3",
  paths: {
    "/pets/{petId}": {
      post: {
        parameters: [
          {
            example: "pet_123",
            in: "path",
            name: "petId",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              example: { age: 3, name: "Rex" },
              schema: { $ref: "#/components/schemas/Pet" },
            },
          },
        },
        responses: {
          "200": {
            content: {
              "application/json": {
                example: { id: "pet_123", name: "Rex" },
                schema: { $ref: "#/components/schemas/Pet" },
              },
            },
            description: "The pet.",
          },
        },
      },
    },
  },
  servers: [{ url: "https://api.test" }],
};

describe("declared examples after the 3.1 upgrade", () => {
  it("reads a 3.0 parameter and body example from examples.default.value", () => {
    const { operation, schemas } = upgraded(SPEC_30, "/pets/{petId}");
    // The upgrade really did move them: the plain `example` is gone.
    expect(operation.parameters?.[0]?.example).toBeUndefined();
    const model = operationModel({
      method: "post",
      parameters: operation.parameters ?? [],
      path: "/pets/{petId}",
      requestBody: operation.requestBody,
      schemas,
      security: { alternatives: [], optional: false },
      servers: [{ url: "https://api.test" }],
    });
    const sample = buildRequest(model, defaultValues(model));
    expect(sample.url).toBe("https://api.test/pets/pet_123");
    expect(sample.bodyValue).toStrictEqual({ age: 3, name: "Rex" });
  });

  it("reads a Swagger 2.0 response example the same way", () => {
    const { operation, schemas } = upgraded(
      {
        info: { title: "Pets", version: "1" },
        paths: {
          "/pets": {
            post: {
              responses: {
                "200": {
                  description: "ok",
                  examples: { "application/json": { id: "p1" } },
                  schema: { type: "object" },
                },
              },
            },
          },
        },
        swagger: "2.0",
      },
      "/pets"
    );
    const media = operation.responses["200"]?.content?.["application/json"];
    expect(responseExample(media ?? {}, schemas)).toStrictEqual({ id: "p1" });
  });

  it("prefers a plain example, then the first inline examples value", () => {
    expect(
      declaredExample({ example: "a", examples: { x: { value: "b" } } })
    ).toBe("a");
    expect(
      declaredExample({
        examples: {
          ref: { $ref: "#/components/examples/Pet" },
          second: { value: "b" },
          third: { value: "c" },
        },
      })
    ).toBe("b");
    // Nothing declared, or nothing usable: the caller falls back to a sample.
    expect(declaredExample({})).toBeUndefined();
    expect(declaredExample({ examples: ["not", "a", "map"] })).toBeUndefined();
    expect(declaredExample({ examples: { only: "junk" } })).toBeUndefined();
  });
});

describe("response samples", () => {
  const schemas = {
    Account: {
      properties: {
        id: { readOnly: true, type: "string" },
        pw: { type: "string", writeOnly: true },
      },
      type: "object",
    },
  } satisfies Record<string, SchemaLike>;
  const account = { $ref: "#/components/schemas/Account" };

  it("keeps readOnly fields and skips writeOnly ones", () => {
    expect(responseExample({ schema: account }, schemas)).toStrictEqual({
      id: "string",
    });
  });

  it("leaves request samples skipping readOnly fields", () => {
    expect(exampleValue(account, schemas)).toStrictEqual({ pw: "string" });
  });
});

describe("flat body fields", () => {
  it("never marks a readOnly property required in a request", () => {
    const model = operationModel({
      method: "post",
      parameters: [],
      path: "/accounts",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              properties: {
                id: { readOnly: true, type: "string" },
                name: { type: "string" },
                slug: { $ref: "#/components/schemas/Slug" },
              },
              required: ["id", "name", "slug"],
              type: "object",
            },
          },
        },
      },
      schemas: { Slug: { readOnly: true, type: "string" } },
      security: { alternatives: [], optional: false },
      servers: [],
    });
    expect(
      model.body?.fields?.map((field) => [field.name, field.required])
    ).toStrictEqual([
      ["id", false],
      ["name", true],
      ["slug", false],
    ]);
  });
});
