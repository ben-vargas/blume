import { describe, expect, it } from "bun:test";

import { extractOperations, operationObject } from "../src/openapi/model.ts";
import type {
  ApiDocument,
  ApiOperationRef,
  ApiSpecData,
} from "../src/openapi/model.ts";
import { operationMdx, overviewMdx } from "../src/openapi/render-mdx.ts";

/**
 * What the OpenAPI extractor and the MDX lowering do with a spec's edges:
 * webhooks it can't render, the author's declared tag order, and code spans
 * inside a description line CommonMark reads as HTML.
 */

const document = (
  paths: ApiDocument["paths"],
  extra: Partial<ApiDocument> = {}
): ApiDocument => ({
  info: { title: "API", version: "1" },
  openapi: "3.1.0",
  paths,
  ...extra,
});

const spec = (
  operations: ApiOperationRef[],
  over: Partial<ApiSpecData> = {}
): ApiSpecData => ({
  codeSamples: [],
  description: "",
  document: document({}),
  expandSchemas: false,
  kind: "openapi",
  label: "API",
  operations: Object.fromEntries(operations.map((op) => [op.key, op])),
  playground: { enabled: false, proxy: false },
  route: "/api",
  slug: "api",
  tags: [],
  title: "API",
  version: "1",
  ...over,
});

describe("webhooks", () => {
  it("files each webhook as a page, under its tag or a Webhooks group", () => {
    const { operations, tags, warnings } = extractOperations(
      document(
        { "/pets": { get: { operationId: "listPets", tags: ["Pets"] } } },
        {
          webhooks: {
            // A null entry and a `$ref` path item are skipped; the ref warns.
            // SAFETY: a parsed YAML spec can hold null where the type expects a
            // path item; the extractor must skip it, so the test feeds one.
            broken: null as never,
            newPet: { post: { summary: "New pet" } },
            petDied: {
              post: { operationId: "petDiedEvent", tags: ["Events"] },
            },
            shared: { $ref: "#/components/pathItems/Shared" },
          },
        }
      ),
      "/api"
    );
    expect(
      operations.map(({ key, path, route, tag, webhook }) => ({
        key,
        path,
        route,
        tag,
        webhook,
      }))
    ).toStrictEqual([
      {
        key: "list-pets",
        path: "/pets",
        route: "/api/pets/list-pets",
        tag: "Pets",
        webhook: undefined,
      },
      {
        key: "new-pet",
        path: "newPet",
        route: "/api/webhooks/new-pet",
        tag: "Webhooks",
        webhook: true,
      },
      {
        key: "pet-died-event",
        path: "petDied",
        route: "/api/events/pet-died-event",
        tag: "Events",
        webhook: true,
      },
    ]);
    expect(tags.map((tag) => tag.name)).toStrictEqual([
      "Pets",
      "Webhooks",
      "Events",
    ]);
    expect(warnings).toStrictEqual([
      'Webhook "shared" is a $ref to a shared path item; referenced path items are not resolved, so it is missing from the reference. Inline the path item under "webhooks" to render it.',
    ]);
  });

  it("resolves a webhook's operation from the webhooks map", () => {
    const doc = document(
      { newPet: { get: { summary: "a path, not the webhook" } } },
      { webhooks: { newPet: { post: { summary: "the webhook" } } } }
    );
    const { operations } = extractOperations(doc, "/api");
    const webhook = operations.find((operation) => operation.webhook);
    if (!webhook) {
      throw new Error("expected a webhook operation");
    }
    expect(
      operationObject(spec(operations, { document: doc }), webhook)?.summary
    ).toBe("the webhook");
  });

  it("describes a webhook as one, for search and for agents", () => {
    const [webhook] = extractOperations(
      document({}, { webhooks: { newPet: { post: {} } } }),
      "/api"
    ).operations;
    if (!webhook) {
      throw new Error("expected a webhook operation");
    }
    const page = operationMdx(spec([webhook]), webhook);
    expect(page.data.seo?.description).toBe(
      "Reference for the POST newPet webhook in the API."
    );
    expect(page.data.search?.tags).toStrictEqual([
      "Webhooks",
      "POST",
      "Webhook",
    ]);
  });
});

describe("tag order", () => {
  it("follows the declared tags, then undeclared tags in first-use order", () => {
    const extracted = extractOperations(
      document(
        {
          "/a": { get: { operationId: "a", tags: ["Zebras"] } },
          "/b": { get: { operationId: "b", tags: ["Stray"] } },
          "/c": { get: { operationId: "c", tags: ["Aardvarks"] } },
          "/d": { get: { operationId: "d" } },
        },
        {
          tags: [
            { name: "Aardvarks" },
            { description: "Striped.", name: "Zebras" },
            { name: "Unused" },
          ],
        }
      ),
      "/api"
    );
    expect(extracted.tags.map((tag) => tag.name)).toStrictEqual([
      "Aardvarks",
      "Zebras",
      "Stray",
      "Operations",
    ]);
    // Slugs and routes still come from first use, unchanged by the order.
    expect(extracted.operations.map((op) => op.route)).toStrictEqual([
      "/api/zebras/a",
      "/api/stray/b",
      "/api/aardvarks/c",
      "/api/operations/d",
    ]);
    const { body } = overviewMdx(
      spec(extracted.operations, { tags: extracted.tags })
    );
    const headings = [...body.matchAll(/^## (?<name>.+)$/gmu)].map(
      (match) => match.groups?.name
    );
    expect(headings).toStrictEqual([
      "Aardvarks",
      "Zebras",
      "Stray",
      "Operations",
    ]);
  });
});

describe("descriptions with HTML lines", () => {
  it("keeps a code span inside an HTML-looking line verbatim", () => {
    const operation: ApiOperationRef = {
      deprecated: false,
      description:
        "<div>Pass `{id}` in the path.</div>\n\n<p>Plain {braces} escape.</p>",
      key: "get-pet",
      method: "get",
      path: "/pets/{id}",
      route: "/api/pets/get-pet",
      summary: "Get a pet",
      tag: "Pets",
      tagSlug: "pets",
    };
    const { body } = operationMdx(spec([operation]), operation);
    expect(body).toContain("&lt;div>Pass `{id}` in the path.&lt;/div>");
    expect(body).toContain("&lt;p>Plain &#123;braces&#125; escape.&lt;/p>");
  });
});
