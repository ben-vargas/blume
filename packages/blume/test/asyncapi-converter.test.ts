import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";

import * as nodeRequireModule from "../src/core/node-require.ts";
import type { AsyncApiDocument } from "../src/openapi/asyncapi.ts";
import { parseAsyncApiSpec } from "../src/openapi/parse.ts";
import { openApiSource } from "../src/openapi/source.ts";
import { SpecDependencyError } from "../src/openapi/spec-dependency-error.ts";

// `@asyncapi/converter` is an optional peer: only a pre-3.0 spec loads it.
// These cases stand in for a project that never installed it by failing the
// one `require` the converter goes through, the way Node does.

const CONVERTER = "@asyncapi/converter";

const realRequire = nodeRequireModule.nodeRequire;

const moduleNotFound = (name: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`Cannot find module '${name}'`), {
    code: "MODULE_NOT_FOUND",
  });

/** Fail `require` for one specifier with `error`; everything else loads. */
const failRequire = (specifier: string, error: Error) =>
  spyOn(nodeRequireModule, "nodeRequire").mockImplementation(
    // SAFETY: the stand-in forwards every call to Node's own `require`, so it
    // keeps the full `NodeRequire` behavior apart from the one failure.
    ((id: string) => {
      if (id === specifier) {
        throw error;
      }
      return realRequire(id);
    }) as NodeRequire
  );

const SPEC_2: AsyncApiDocument = {
  asyncapi: "2.6.0",
  channels: {
    "user/signedup": {
      subscribe: { message: { name: "Pong", payload: { type: "string" } } },
    },
  },
  info: { title: "Chat", version: "1.0.0" },
};

const SPEC_3: AsyncApiDocument = {
  asyncapi: "3.0.0",
  channels: { c: { address: "c" } },
  info: { title: "Chat", version: "1.0.0" },
  operations: { op: { action: "send", channel: { $ref: "#/channels/c" } } },
};

const dirs: string[] = [];

/** A project dir holding `spec.json` and, optionally, a lockfile. */
const project = async (
  spec: AsyncApiDocument,
  lockfile?: string
): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "blume-asyncapi-converter-"));
  dirs.push(dir);
  await writeFile(join(dir, "spec.json"), JSON.stringify(spec));
  if (lockfile) {
    await writeFile(join(dir, lockfile), "");
  }
  return dir;
};

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

describe("the optional AsyncAPI converter", () => {
  it("names the install command for the project's package manager", async () => {
    const dir = await project(SPEC_2, "pnpm-lock.yaml");
    const spy = failRequire(CONVERTER, moduleNotFound(CONVERTER));
    try {
      const thrown = await parseAsyncApiSpec("spec.json", dir).catch(
        (error: Error) => error
      );
      expect(thrown).toBeInstanceOf(SpecDependencyError);
      // SAFETY: asserted to be a SpecDependencyError just above.
      const error = thrown as SpecDependencyError;
      expect(error.message).toBe(
        `spec.json is AsyncAPI 2.6.0, and converting it to AsyncAPI 3.0 needs "${CONVERTER}", which isn't installed`
      );
      expect(error.suggestion).toBe(
        `Install it with \`pnpm add ${CONVERTER}\`, or convert the spec to AsyncAPI 3.0.`
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("reads a 3.x spec without loading the converter", async () => {
    const dir = await project(SPEC_3);
    const spy = failRequire(CONVERTER, moduleNotFound(CONVERTER));
    try {
      const { document } = await parseAsyncApiSpec("spec.json", dir);
      expect(document.asyncapi).toBe("3.0.0");
      expect(spy).not.toHaveBeenCalledWith(CONVERTER);
    } finally {
      spy.mockRestore();
    }
  });

  it("surfaces a broken converter install as is", async () => {
    const dir = await project(SPEC_2);
    // The converter resolves, but one of its own dependencies doesn't: not
    // the project's missing peer, so no install hint that wouldn't help.
    const broken = moduleNotFound("js-yaml");
    const spy = failRequire(CONVERTER, broken);
    try {
      await expect(parseAsyncApiSpec("spec.json", dir)).rejects.toBe(broken);
    } finally {
      spy.mockRestore();
    }
  });

  it("fails the build with the install command as the suggestion", async () => {
    const dir = await project(SPEC_2, "package-lock.json");
    const spy = failRequire(CONVERTER, moduleNotFound(CONVERTER));
    try {
      const { diagnostics, entries } = await openApiSource(
        [
          {
            basePath: "",
            display: {
              codeSamples: [],
              expandSchemas: false,
              playground: { enabled: true, proxy: false },
            },
            includeInLlms: true,
            includeInSearch: true,
            kind: "asyncapi",
            label: "Events",
            noindex: false,
            route: "/events",
            seoDescriptionSuffix: true,
            slug: "events",
            spec: "spec.json",
          },
        ],
        {
          cacheDir: join(dir, ".blume/cache/openapi"),
          mode: "build",
          projectRoot: dir,
        }
      ).load();
      expect(entries).toHaveLength(0);
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: "BLUME_ASYNCAPI_UNAVAILABLE",
          severity: "error",
          suggestion: `Install it with \`npm install ${CONVERTER}\`, or convert the spec to AsyncAPI 3.0.`,
        })
      );
    } finally {
      spy.mockRestore();
    }
  });
});
