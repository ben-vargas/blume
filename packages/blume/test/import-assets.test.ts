import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, readdir, writeFile } from "node:fs/promises";

import { join } from "pathe";

import { materializeAssets } from "../src/core/sources/assets.ts";
import type { AssetContext } from "../src/core/sources/assets.ts";
import { hashText } from "../src/core/sources/cache.ts";
import { image } from "../src/core/sources/lower.ts";
import { cleanupTempDirs, tempDir } from "./cms-fixtures.ts";

afterAll(cleanupTempDirs);

type FetchHandler = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

// SAFETY: materializeAssets calls fetchImpl as a plain function; the
// preconnect helper Bun attaches to the real fetch is never accessed.
const asFetch = (handler: FetchHandler): typeof fetch =>
  handler as typeof fetch;

/** A fetch stub answering every request with `type`, recording the URLs. */
const serving = (type?: string) => {
  const fetched: string[] = [];
  const fetchImpl = asFetch((input) => {
    fetched.push(String(input));
    return Promise.resolve(
      new Response(new ArrayBuffer(4), {
        headers: type ? { "content-type": type } : {},
      })
    );
  });
  return { fetchImpl, fetched };
};

const ctx = async (fetchImpl: typeof fetch): Promise<AssetContext> => ({
  assetsBaseUrl: "/assets",
  assetsDir: join(await tempDir("assets"), "assets"),
  fetchImpl,
});

describe("materializeAssets: only images and videos are saved", () => {
  it("refuses an html page posing as an image and writes nothing", async () => {
    const { fetchImpl } = serving("text/html; charset=utf-8");
    const assets = await ctx(fetchImpl);
    const body = "![pwn](https://attacker.example/pwn.html)";
    const { diagnostics, markdown } = await materializeAssets(body, assets);
    expect(markdown).toBe(body);
    expect(diagnostics[0]?.message).toContain(
      "responded with text/html, not an image or video"
    );
    expect(await readdir(assets.assetsDir).catch(() => [])).toStrictEqual([]);
  });

  it("refuses an untyped response whose URL names no image or video", async () => {
    const { fetchImpl } = serving("application/octet-stream");
    const { diagnostics } = await materializeAssets(
      "![pwn](https://attacker.example/pwn.html)",
      await ctx(fetchImpl)
    );
    expect(diagnostics[0]?.message).toContain(
      "responded with application/octet-stream and its URL names no image or video file"
    );
  });

  it("names the file by the reported image type, whatever the URL says", async () => {
    const { fetchImpl } = serving("image/png");
    const url = "https://cdn.example.com/pic.html";
    const { markdown } = await materializeAssets(
      `![pic](${url})`,
      await ctx(fetchImpl)
    );
    expect(markdown).toBe(`![pic](/assets/${hashText(url)}.png)`);
  });

  it("falls back to the URL's image extension for an untyped response", async () => {
    const { fetchImpl } = serving("binary/octet-stream");
    const url = "https://s3.example.com/photo.JPEG";
    const { markdown } = await materializeAssets(
      `![photo](${url})`,
      await ctx(fetchImpl)
    );
    expect(markdown).toBe(`![photo](/assets/${hashText(url)}.jpeg)`);
  });

  it("reuses a file named by an earlier response instead of fetching again", async () => {
    const { fetched, fetchImpl } = serving("image/jpeg");
    const assets = await ctx(fetchImpl);
    const url = "https://cdn.example.com/pic.png";
    const first = await materializeAssets(`![pic](${url}?sig=1)`, assets);
    const second = await materializeAssets(`![pic](${url}?sig=2)`, assets);
    expect(first.markdown).toBe(`![pic](/assets/${hashText(url)}.jpg)`);
    expect(second.markdown).toBe(first.markdown);
    expect(fetched).toStrictEqual([`${url}?sig=1`]);
  });

  it("never reuses a non-media file left for the same asset", async () => {
    const { fetched, fetchImpl } = serving("image/png");
    const assets = await ctx(fetchImpl);
    const url = "https://cdn.example.com/pic.html";
    await mkdir(assets.assetsDir, { recursive: true });
    await writeFile(join(assets.assetsDir, `${hashText(url)}.html`), "<p>");
    const { markdown } = await materializeAssets(`![pic](${url})`, assets);
    expect(fetched).toStrictEqual([url]);
    expect(markdown).toBe(`![pic](/assets/${hashText(url)}.png)`);
  });
});

describe("materializeAssets: image syntax the lowerers write", () => {
  it("downloads an image whose alt holds escapes and whose URL has spaces", async () => {
    const { fetched, fetchImpl } = serving("image/png");
    const url = "https://s3.example.com/files/Screen Shot (1).png?X-Amz=1";
    const body = image("a ] caption [with brackets]", url);
    const { markdown } = await materializeAssets(body, await ctx(fetchImpl));
    expect(fetched).toStrictEqual([url]);
    const stem = hashText("https://s3.example.com/files/Screen Shot (1).png");
    expect(markdown).toBe(
      String.raw`![a \] caption \[with brackets\]](/assets/${stem}.png)`
    );
  });

  it("fetches the URL a destination's escapes stand for", async () => {
    const { fetched, fetchImpl } = serving("image/png");
    const url = "https://cdn.example.com/a.png?x=&amp;y";
    const body = image("pic", url);
    expect(body).toBe(
      String.raw`![pic](https://cdn.example.com/a.png?x=\&amp;y)`
    );
    const { markdown } = await materializeAssets(body, await ctx(fetchImpl));
    expect(fetched).toStrictEqual([url]);
    expect(markdown).toBe(
      `![pic](/assets/${hashText("https://cdn.example.com/a.png")}.png)`
    );
  });

  it("leaves a relative image alone", async () => {
    const { fetched, fetchImpl } = serving("image/png");
    const body = "![pic](</local dir/a.png>)";
    const { markdown } = await materializeAssets(body, await ctx(fetchImpl));
    expect(fetched).toStrictEqual([]);
    expect(markdown).toBe(body);
  });
});
