import { describe, expect, it } from "bun:test";

import { extractOperations } from "../src/openapi/model.ts";
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
  it("warns that declared webhooks aren't rendered", () => {
    const one = extractOperations(
      document({}, { webhooks: { newPet: { post: {} } } }),
      "/api"
    );
    expect(one.warnings).toStrictEqual([
      'The spec declares a webhook under "webhooks" (newPet); webhooks aren\'t rendered, so they are missing from the reference.',
    ]);
    const two = extractOperations(
      document({}, { webhooks: { a: { post: {} }, b: { post: {} } } }),
      "/api"
    );
    expect(two.warnings[0]).toContain("declares 2 webhooks");
    expect(extractOperations(document({}), "/api").warnings).toStrictEqual([]);
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
