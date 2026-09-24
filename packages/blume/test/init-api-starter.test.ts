import { describe, expect, it } from "bun:test";

import stringWidth from "string-width";

import { DEFAULT_THRESHOLDS } from "../src/audit/types.ts";
import { buildConfig, buildPlan } from "../src/cli/init/scaffold.ts";
import type { InitAnswers } from "../src/cli/init/scaffold.ts";
import { STARTER_OPENAPI_JSON } from "../src/cli/init/starter-spec.ts";
import { extractOperations } from "../src/openapi/model.ts";
import type { ApiDocument, ApiSpecData } from "../src/openapi/model.ts";
import { operationMdx, overviewMdx } from "../src/openapi/render-mdx.ts";

const answers = (overrides: Partial<InitAnswers> = {}): InitAnswers => ({
  contentDir: "docs",
  directory: ".",
  packageManager: "npm",
  sources: ["filesystem"],
  template: "api",
  title: "My Docs",
  ...overrides,
});

/** The starter spec as the build models it, mounted where the config puts it. */
const starterSpec = (): ApiSpecData => {
  const document: ApiDocument = JSON.parse(STARTER_OPENAPI_JSON);
  const { operations, tags } = extractOperations(document, "/api");
  return {
    codeSamples: [],
    description: document.info?.description ?? "",
    document,
    expandSchemas: false,
    kind: "openapi",
    label: "Pet Store",
    operations: Object.fromEntries(operations.map((op) => [op.key, op])),
    playground: { enabled: true, proxy: false },
    route: "/api",
    slug: "pet-store",
    tags,
    title: document.info?.title ?? "",
    version: document.info?.version ?? "",
  };
};

describe("the api starter", () => {
  it("writes its spec beside the config and points openapi() at it", () => {
    const plan = buildPlan("/proj", answers());
    const spec = plan.find((file) => file.path === "/proj/openapi.json");
    expect(spec?.content).toBe(STARTER_OPENAPI_JSON);
    const config = buildConfig(answers());
    expect(config).toContain('spec: "./openapi.json"');
    expect(config).not.toContain("https://");
  });

  it("writes the spec even when no local content source is selected", () => {
    const paths = buildPlan("/proj", answers({ sources: ["notion"] })).map(
      (file) => file.path
    );
    expect(paths).toContain("/proj/openapi.json");
    expect(paths).not.toContain("/proj/docs/index.mdx");
  });

  it("leaves the other starters without a spec", () => {
    const paths = buildPlan("/proj", answers({ template: "docs" })).map(
      (file) => file.path
    );
    expect(paths).not.toContain("/proj/openapi.json");
  });

  it("gives every generated page a description blume audit accepts", () => {
    const { descriptionMax, descriptionMin } = DEFAULT_THRESHOLDS;
    const spec = starterSpec();
    const pages = [
      overviewMdx(spec),
      ...Object.values(spec.operations).map((op) => operationMdx(spec, op)),
    ];
    expect(pages).toHaveLength(6);
    for (const page of pages) {
      const width = stringWidth(page.data.seo.description);
      expect(width).toBeGreaterThanOrEqual(descriptionMin);
      expect(width).toBeLessThanOrEqual(descriptionMax);
    }
  });
});
