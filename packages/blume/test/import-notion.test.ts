import { afterAll, describe, expect, it } from "bun:test";

import { join } from "pathe";

import { notionSource } from "../src/core/sources/notion.ts";
import type { NotionClientLike } from "../src/core/sources/notion.ts";
import type { SourceContext } from "../src/core/sources/types.ts";
import { cleanupTempDirs, tempDir } from "./cms-fixtures.ts";

afterAll(cleanupTempDirs);

const rich = (plainText: string, annotations?: Record<string, boolean>) => ({
  annotations,
  plain_text: plainText,
});

type BlockList = Awaited<
  ReturnType<NotionClientLike["blocks"]["children"]["list"]>
>["results"];

const PAGE = {
  id: "page",
  properties: { Name: { title: [rich("Guide")], type: "title" } },
};

const list = <T>(results: T[]) =>
  Promise.resolve({ has_more: false, next_cursor: null, results });

/** A client serving one page whose top-level blocks are `blocks`. */
const clientWith = (
  blocks: BlockList,
  query: NotionClientLike["dataSources"]["query"] = () => list([PAGE])
): NotionClientLike => ({
  blocks: {
    children: {
      list: ({ block_id }) => list(block_id === "page" ? blocks : []),
    },
  },
  dataSources: { query },
  databases: {
    retrieve: () => Promise.resolve({ data_sources: [{ id: "ds", name: "" }] }),
  },
});

// `typeof fetch` carries the `preconnect` namespace member, so the stub borrows
// it from the real fetch; the source only ever calls the function itself.
const fetchImpl: typeof fetch = Object.assign(
  () =>
    Promise.resolve(
      new Response(new ArrayBuffer(4), {
        headers: { "content-type": "video/mp4" },
      })
    ),
  fetch
);

const ctx = async (): Promise<SourceContext> => {
  const dir = await tempDir("notion-import");
  return {
    assetsBaseUrl: "/blume-assets/handbook",
    assetsDir: join(dir, "assets"),
    cacheDir: join(dir, "cache"),
    mode: "build",
    projectRoot: dir,
  };
};

const bodyOf = async (client: NotionClientLike): Promise<string> => {
  const source = notionSource(
    { client, database: "db", fetchImpl, name: "handbook" },
    await ctx()
  );
  const { entries } = await source.load();
  return entries[0]?.body.text ?? "";
};

describe("notionSource: block-level guards", () => {
  it("keeps a paragraph of 'import ' and a code run out of MDX's ESM", async () => {
    const body = await bodyOf(
      clientWith([
        {
          id: "p",
          paragraph: {
            rich_text: [rich("import "), rich("lodash", { code: true })],
          },
          type: "paragraph",
        },
        {
          // Leading indentation would make the callout's text a code block.
          callout: { rich_text: [rich("    "), rich("export"), rich(" it")] },
          id: "c",
          type: "callout",
        },
      ])
    );
    expect(body).toBe(
      "&#105;mport `lodash`\n\n<Callout>\n&#101;xport it\n</Callout>"
    );
  });
});

describe("notionSource: video captions", () => {
  it("leaves the Frame to escape the caption's angle brackets", async () => {
    const body = await bodyOf(
      clientWith([
        {
          id: "v",
          type: "video",
          video: {
            caption: [rich("A <chart> & "), rich("x", { bold: true })],
            file: { url: "https://notion.so/signed/clip.mp4" },
          },
        },
      ])
    );
    expect(body).toStartWith('<Frame caption={"A <chart> & **x**"}>');
  });
});

describe("notionSource: rate limits", () => {
  it("waits for the Retry-After the rate-limited response names", async () => {
    let calls = 0;
    const query: NotionClientLike["dataSources"]["query"] = () => {
      calls += 1;
      return calls === 1
        ? Promise.reject(
            Object.assign(new Error("rate limited"), {
              headers: new Headers({ "retry-after": "1.2" }),
              status: 429,
            })
          )
        : list([PAGE]);
    };
    const started = performance.now();
    const body = await bodyOf(clientWith([], query));
    // The jittered backoff for a first retry is under a second; only the
    // header's 1.2 seconds waits this long.
    expect(performance.now() - started).toBeGreaterThanOrEqual(1100);
    expect(calls).toBe(2);
    expect(body).toBe("");
  });
});
