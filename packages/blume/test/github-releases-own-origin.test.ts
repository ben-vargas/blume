import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";

import { blumeConfigSchema } from "../src/core/schema.ts";
import { githubReleasesSource } from "../src/core/sources/github-releases.ts";
import { resolveSources } from "../src/core/sources/resolve.ts";
import type { ProjectContext } from "../src/core/types.ts";
import { filesystem } from "../src/sources/filesystem.ts";
import { githubReleases } from "../src/sources/github-releases.ts";
import { cleanupTempDirs, ctxFor, tempDir } from "./cms-fixtures.ts";

afterAll(cleanupTempDirs);

const release = (body: string) => ({
  body,
  created_at: "2026-06-01T00:00:00Z",
  draft: false,
  html_url: "https://github.com/acme/sdk/releases/tag/v2.0.0",
  id: 1,
  name: "v2.0.0",
  prerelease: false,
  published_at: "2026-06-24T00:00:00Z",
  tag_name: "v2.0.0",
});

/** A fetch answering the releases endpoint with one release of `body`. */
const releasesFetch = (body: string): typeof fetch =>
  Object.assign(() => Promise.resolve(Response.json([release(body)])), fetch);

const loadBody = async (body: string, site?: string): Promise<string> => {
  const source = githubReleasesSource(
    {
      fetchImpl: releasesFetch(body),
      name: "changelog",
      owner: "acme",
      repo: "sdk",
      site,
    },
    ctxFor(await tempDir("own-origin"))
  );
  const { entries } = await source.load();
  return entries[0]?.body.text ?? "";
};

const NOTES = [
  'See the [upgrade guide](https://useblume.dev/docs/upgrading#steps "Up").',
  "A [**bold** label](https://useblume.dev/docs/a?x=1) and [](https://useblume.dev/x).",
  "Autolinks: <https://useblume.dev/docs/b> and https://useblume.dev/docs/c.",
  "Elsewhere: [gh](https://github.com/acme), [http](http://useblume.dev/y), [sub](https://www.useblume.dev/z), `https://useblume.dev/code`.",
  "",
  "[ref]: https://useblume.dev/docs/d 'T'",
].join("\n");

describe("githubReleasesSource: links to the site itself", () => {
  it("points a link to the configured site at its root-relative path", async () => {
    expect(await loadBody(NOTES, "https://useblume.dev/docs")).toBe(
      [
        'See the [upgrade guide](/docs/upgrading#steps "Up").',
        "A [**bold** label](/docs/a?x=1) and [](/x).",
        "Autolinks: [https://useblume.dev/docs/b](/docs/b) and [https://useblume.dev/docs/c](/docs/c).",
        "Elsewhere: [gh](https://github.com/acme), [http](http://useblume.dev/y), [sub](https://www.useblume.dev/z), `https://useblume.dev/code`.",
        "",
        '[ref]: /docs/d "T"',
      ].join("\n")
    );
  });

  it("escapes a title's quotes and backslashes", async () => {
    expect(
      await loadBody(
        String.raw`[a](https://useblume.dev/a 'say "hi" \\ ok')`,
        "https://useblume.dev"
      )
    ).toBe(String.raw`[a](/a "say \"hi\" \\ ok")`);
  });

  it("leaves the notes alone without a web site URL", async () => {
    expect(await loadBody(NOTES)).toBe(NOTES);
    expect(await loadBody(NOTES, "mailto:team@useblume.dev")).toBe(NOTES);
  });
});

describe("resolveSources: github-releases site", () => {
  let fetchSpy: ReturnType<typeof spyOn> | undefined;
  afterEach(() => {
    // Restored per test, so a failing assertion never leaks the stub.
    fetchSpy?.mockRestore();
  });

  it("passes deployment.site to the source", async () => {
    fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      releasesFetch("[docs](https://acme.dev/docs/x)")
    );
    const config = blumeConfigSchema.parse({
      content: {
        sources: [
          filesystem({ root: "docs" }),
          githubReleases({ owner: "acme", prefix: "changelog", repo: "sdk" }),
        ],
      },
      deployment: { site: "https://acme.dev" },
    });
    const root = await tempDir("own-origin-resolve");
    // SAFETY: resolveSources reads only root, contentRoot, and outDir from the
    // project context; the remaining fields are never touched.
    const context = {
      contentRoot: `${root}/docs`,
      outDir: `${root}/.blume`,
      root,
    } as ProjectContext;
    const [, source] = resolveSources(config, context, { mode: "build" });
    const loaded = await source?.load();
    expect(loaded?.entries[0]?.body.text).toBe("[docs](/docs/x)");
  });
});
