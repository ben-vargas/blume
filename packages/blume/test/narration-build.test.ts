import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";

import { parse, TextNode } from "node-html-parser";
import { dirname, join } from "pathe";

import { gateway } from "../src/ai/ask.ts";
import { scanProject } from "../src/core/project-graph.ts";
import {
  buildNarration,
  clipKey,
  gatewaySpeaker,
  htmlTree,
  narrationCacheDir,
  readPlayerPage,
} from "../src/narration/build.ts";
import { narrationProviderSchema } from "../src/narration/provider.ts";
import type { NarrationCues } from "../src/narration/script.ts";

/**
 * Tests for generated narration (`src/narration/build.ts`): reading built
 * pages, generating and caching a clip per sentence, and writing each page's
 * manifest. A fake speaker stands in for the speech model.
 */

const dirs: string[] = [];
const KEYS = ["AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN", "NARRATION_TEST_KEY"];
const saved = new Map(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
});

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

const CUES: NarrationCues = {
  danger: "Danger.",
  info: "Info.",
  note: "Note.",
  section: "Expandable section.",
  step: "Step {n}.",
  success: "Success.",
  tab: "{title} tab.",
  tip: "Tip.",
  warning: "Warning.",
};

const PROSE =
  "Narration reads this page from top to bottom. Each block is introduced with a short cue, so a listener knows what comes next. " +
  "The build generates one clip per sentence and caches it, so a rebuild only pays for sentences that changed. " +
  "Pages without enough prose to narrate get no player at all.";

/** A built page carrying the generated player, as the page template renders it. */
const page = (options: {
  base?: string;
  body?: string;
  cues?: string;
  lang?: string;
  manifest?: string | null;
  route: string;
}): string => {
  const base = options.base ?? "";
  const manifest =
    options.manifest === undefined
      ? `${base}/blume-narration${options.route}.json`
      : options.manifest;
  const attrs = [
    `data-audio-base="${base}/blume-narration/audio/"`,
    'data-blume-narration="skip"',
    "data-blume-narration-player",
    `data-cues='${options.cues ?? JSON.stringify(CUES)}'`,
    options.lang ? `data-lang="${options.lang}"` : "",
    manifest === null ? "" : `data-manifest="${manifest}"`,
  ].join(" ");
  return `<!doctype html><html><body><main id="blume-content"><article><h1>Title</h1><div ${attrs}><button>Listen</button></div>${
    options.body ?? `<aside data-blume-callout="tip"><p>${PROSE}</p></aside>`
  }</article></main></body></html>`;
};

/** A project on disk whose config enables generated narration, plus its dist. */
const fixture = async (
  config: string,
  pages: Record<string, string>
): Promise<{ dist: string; root: string }> => {
  const root = await mkdtemp(join(tmpdir(), "blume-narration-"));
  dirs.push(root);
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs", "index.md"), "# Home\n", "utf-8");
  await writeFile(join(root, "blume.config.ts"), config, "utf-8");
  const dist = join(root, "dist");
  await Promise.all(
    Object.entries(pages).map(async ([path, html]) => {
      const target = join(dist, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, html, "utf-8");
    })
  );
  return { dist, root };
};

const PROVIDER_CONFIG = `export default {
  narration: {
    provider: {
      kind: "gateway",
      options: { apiKeyEnv: "NARRATION_TEST_KEY", voice: "nova" },
      requiredSecrets: ["NARRATION_TEST_KEY"],
      runtimeDeps: [],
    },
  },
};
`;

interface Log {
  info: string[];
  warn: string[];
}

const logger = (log: Log) => ({
  info: (message: string) => log.info.push(message),
  warn: (message: string) => log.warn.push(message),
});

/** A speaker that records what it was asked to say. */
const recorder = () => {
  const said: string[] = [];
  const speak = async (text: string, lang: string) => {
    said.push(`${lang}:${text}`);
    await Promise.resolve();
    return new TextEncoder().encode(`audio:${text}`);
  };
  return { said, speak };
};

describe("htmlTree", () => {
  it("reads elements, text, and nothing else", () => {
    const root = parse('<p class="a">Hi</p>');
    const [p] = root.childNodes;
    const [text] = p?.childNodes ?? [];
    if (!(p && text)) {
      throw new Error("expected a paragraph with text");
    }
    expect(htmlTree.tag(p)).toBe("p");
    expect(htmlTree.attr(p, "class")).toBe("a");
    expect(htmlTree.attr(p, "missing")).toBeNull();
    expect(htmlTree.text(p)).toBeNull();
    expect(htmlTree.children(p)).toHaveLength(1);
    expect(text).toBeInstanceOf(TextNode);
    expect(htmlTree.tag(text)).toBeNull();
    expect(htmlTree.attr(text, "class")).toBeNull();
    expect(htmlTree.text(text)).toBe("Hi");
    expect(htmlTree.tag(root)).toBeNull();
  });
});

describe(readPlayerPage, () => {
  it("reads the player's settings and the article around it", () => {
    const result = readPlayerPage(page({ lang: "de", route: "/guide" }));
    expect(result?.manifest).toBe("/blume-narration/guide.json");
    expect(result?.audioBase).toBe("/blume-narration/audio/");
    expect(result?.lang).toBe("de");
    expect(result?.cues).toEqual(CUES);
    expect(result?.article.tagName).toBe("ARTICLE");
  });

  it("defaults the language to English", () => {
    expect(readPlayerPage(page({ route: "/guide" }))?.lang).toBe("en");
  });

  it("is null without a generated-audio player", () => {
    expect(readPlayerPage("<article><p>No player.</p></article>")).toBeNull();
    expect(readPlayerPage(page({ manifest: null, route: "/x" }))).toBeNull();
    expect(readPlayerPage(page({ cues: "not json", route: "/x" }))).toBeNull();
    expect(readPlayerPage(page({ cues: "{}", route: "/x" }))).toBeNull();
  });
});

describe(clipKey, () => {
  const provider = narrationProviderSchema.parse(gateway());

  it("follows what the clip sounds like", () => {
    const key = clipKey(provider, "en", "Hello.");
    expect(key).toMatch(/^[0-9a-f]{32}$/u);
    expect(clipKey(provider, "en-US", "Hello.")).toBe(key);
    expect(clipKey(provider, "de", "Hello.")).not.toBe(key);
    expect(clipKey(provider, "en", "Hello!")).not.toBe(key);
    const other = narrationProviderSchema.parse(gateway({ voice: "nova" }));
    expect(clipKey(other, "en", "Hello.")).not.toBe(key);
  });
});

describe(gatewaySpeaker, () => {
  it("asks the gateway's speech model for MP3 in the page's language", async () => {
    process.env.NARRATION_TEST_KEY = "test-key";
    const provider = narrationProviderSchema.parse(
      gateway({
        apiKeyEnv: "NARRATION_TEST_KEY",
        instructions: "Read calmly.",
        model: "openai/tts-1",
        voice: "nova",
      })
    );
    const requests: { body: string; model: string | null; url: string }[] = [];
    const originalFetch = globalThis.fetch;
    const fakeFetch = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ): Promise<Response> => {
      requests.push({
        body: String(init?.body ?? ""),
        model: new Headers(init?.headers).get("ai-model-id"),
        url: String(input),
      });
      await Promise.resolve();
      return Response.json({ audio: Buffer.from("mp3!").toString("base64") });
    };
    // SAFETY: the fake implements the call shape the gateway provider uses;
    // `fetch.preconnect` is never touched.
    globalThis.fetch = fakeFetch as typeof fetch;
    try {
      const audio = await gatewaySpeaker(provider)("Hallo.", "de-AT");
      expect(new TextDecoder().decode(audio)).toBe("mp3!");
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url.endsWith("/speech-model")).toBe(true);
    expect(requests[0]?.model).toBe("openai/tts-1");
    expect(JSON.parse(requests[0]?.body ?? "{}")).toEqual({
      instructions: "Read calmly.",
      language: "de",
      outputFormat: "mp3",
      providerOptions: {},
      text: "Hallo.",
      voice: "nova",
    });
  });
});

describe(narrationCacheDir, () => {
  it("lives under node_modules/.cache when the project has node_modules", async () => {
    const root = await mkdtemp(join(tmpdir(), "blume-narration-cache-"));
    dirs.push(root);
    const context = { outDir: join(root, ".blume"), root };
    expect(narrationCacheDir(context)).toBe(
      join(root, ".blume", ".cache", "narration")
    );
    await mkdir(join(root, "node_modules"));
    expect(narrationCacheDir(context)).toBe(
      join(root, "node_modules", ".cache", "blume", "narration")
    );
  });
});

describe(buildNarration, () => {
  it("does nothing unless a provider is configured", async () => {
    for (const config of [
      "export default {};\n",
      "export default { narration: true };\n",
      'export default { narration: { enabled: false, provider: { kind: "gateway", options: {}, requiredSecrets: [], runtimeDeps: [] } } };\n',
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- one fixture at a time
      const { dist, root } = await fixture(config, {});
      // oxlint-disable-next-line no-await-in-loop
      const project = await scanProject(root, { mode: "build" });
      const log: Log = { info: [], warn: [] };
      // oxlint-disable-next-line no-await-in-loop
      expect(await buildNarration(project, dist, logger(log))).toBeNull();
      expect(log.warn).toEqual([]);
    }
  });

  it("warns and skips generation without the provider's key", async () => {
    Reflect.deleteProperty(process.env, "NARRATION_TEST_KEY");
    Reflect.deleteProperty(process.env, "VERCEL_OIDC_TOKEN");
    const { dist, root } = await fixture(PROVIDER_CONFIG, {
      "guide/index.html": page({ route: "/guide" }),
    });
    const project = await scanProject(root, { mode: "build" });
    const log: Log = { info: [], warn: [] };
    expect(await buildNarration(project, dist, logger(log))).toBeNull();
    expect(log.warn[0]).toBe(
      "Narration audio was not generated: NARRATION_TEST_KEY is not set, so pages will be read with browser voices."
    );
    expect(existsSync(join(dist, "blume-narration"))).toBe(false);
  });

  it("writes a clip per sentence and a manifest per page, then reuses them", async () => {
    const { dist, root } = await fixture(PROVIDER_CONFIG, {
      "404.html": "<html><body><p>Not found.</p></body></html>",
      "guide/index.html": page({ lang: "en-US", route: "/guide" }),
      "guide/short/index.html": page({
        body: "<p>Too short.</p>",
        route: "/guide/short",
      }),
      "reference/index.html": page({ manifest: null, route: "/reference" }),
      "zh/index.html": page({
        body: `<p>${"这是一个很长的句子，用来测试中文页面的朗读。".repeat(20)}</p>`,
        lang: "zh",
        route: "/zh",
      }),
    });
    const project = await scanProject(root, { mode: "build" });
    const cacheDir = narrationCacheDir(project.context);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "stale.mp3"), "old");
    await writeFile(join(cacheDir, "crashed.mp3.123.tmp"), "partial");

    const log: Log = { info: [], warn: [] };
    const first = recorder();
    const result = await buildNarration(
      project,
      dist,
      logger(log),
      first.speak
    );
    expect(result?.pages).toBe(2);
    expect(result?.failed).toBe(0);
    expect(result?.reused).toBe(0);
    expect(result?.generated).toBe(first.said.length);
    expect(first.said.slice(0, 2)).toEqual(["en-US:Title", "en-US:Tip."]);
    expect(log.info[0]).toMatch(
      /^Generating narration: \d+ new clip\(s\), [\d,]+ characters, with openai\/tts-1-hd$/u
    );

    const manifest = JSON.parse(
      await readFile(join(dist, "blume-narration", "guide.json"), "utf-8")
    );
    expect(manifest.version).toBe(1);
    expect(manifest.blocks).toEqual(["Title", PROSE]);
    const [title, cue, sentence] = manifest.segments;
    expect(cue.text).toBe("Tip.");
    expect(title).toMatchObject({ block: 0, end: 5, start: 0 });
    expect(sentence).toMatchObject({ block: 1, start: 0 });
    const clip = await readFile(
      join(dist, "blume-narration", "audio", title.audio),
      "utf-8"
    );
    expect(clip).toBe("audio:Title");
    expect(existsSync(join(dist, "blume-narration", "zh.json"))).toBe(true);
    expect(
      existsSync(join(dist, "blume-narration", "guide", "short.json"))
    ).toBe(false);
    expect(existsSync(join(dist, "blume-narration", "reference.json"))).toBe(
      false
    );
    // Stale clips and crashed writes are pruned; the site's clips stay.
    const cached = await readdir(cacheDir);
    expect(cached).not.toContain("stale.mp3");
    expect(cached).not.toContain("crashed.mp3.123.tmp");
    expect(cached).toHaveLength(first.said.length);

    const again = recorder();
    const rebuilt = await buildNarration(
      project,
      dist,
      logger({ info: [], warn: [] }),
      again.speak
    );
    expect(again.said).toEqual([]);
    expect(rebuilt).toEqual({
      failed: 0,
      generated: 0,
      pages: 2,
      reused: first.said.length,
    });
  });

  it("writes under the deployment base as the host serves it", async () => {
    const { dist, root } = await fixture(
      PROVIDER_CONFIG.replace(
        "export default {",
        'export default {\n  deployment: { base: "/docs" },'
      ),
      {
        "größe/index.html": page({
          base: "/docs",
          manifest: `/docs/blume-narration/${encodeURI("größe")}.json`,
          route: "/größe",
        }),
      }
    );
    const project = await scanProject(root, { mode: "build" });
    const { speak } = recorder();
    await buildNarration(project, dist, logger({ info: [], warn: [] }), speak);
    expect(existsSync(join(dist, "blume-narration", "größe.json"))).toBe(true);
    const clips = await readdir(join(dist, "blume-narration", "audio"));
    expect(clips.length).toBeGreaterThan(0);
  });

  it("reports nothing to do when no page has narration", async () => {
    const { dist, root } = await fixture(PROVIDER_CONFIG, {
      "index.html": "<html><body><p>Plain.</p></body></html>",
    });
    const project = await scanProject(root, { mode: "build" });
    const { speak } = recorder();
    expect(
      await buildNarration(project, dist, logger({ info: [], warn: [] }), speak)
    ).toEqual({ failed: 0, generated: 0, pages: 0, reused: 0 });
  });

  it("stops at the first failed clip and leaves those pages to browser voices", async () => {
    process.env.NARRATION_TEST_KEY = "set";
    const { dist, root } = await fixture(PROVIDER_CONFIG, {
      "guide/index.html": page({ route: "/guide" }),
    });
    const project = await scanProject(root, { mode: "build" });
    const log: Log = { info: [], warn: [] };
    let calls = 0;
    const failing = async (): Promise<Uint8Array> => {
      calls += 1;
      await Promise.resolve();
      throw new Error("Invalid API key");
    };
    const result = await buildNarration(project, dist, logger(log), failing);
    expect(result?.pages).toBe(0);
    expect(result?.generated).toBe(0);
    expect(calls).toBeLessThanOrEqual(4);
    expect(log.warn[0]).toBe(
      "Narration stopped generating after a clip failed (Invalid API key). Pages missing clips will be read with browser voices."
    );
    expect(existsSync(join(dist, "blume-narration", "guide.json"))).toBe(false);

    const thrown = await buildNarration(
      project,
      dist,
      logger(log),
      async (): Promise<Uint8Array> => {
        await Promise.resolve();
        // oxlint-disable-next-line no-throw-literal, typescript/only-throw-error -- a provider that throws a non-Error
        throw "quota";
      }
    );
    expect(thrown?.failed).toBeGreaterThan(0);
    expect(log.warn.at(-1)).toContain("(quota)");
  });
});
