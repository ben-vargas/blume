import { BlumeError } from "../diagnostics.ts";
import {
  assetFromEntry,
  contentfulRichTextToMarkdown,
} from "./contentful-rich-text.ts";
import type { JsonObject } from "./json.ts";
import {
  asNumber,
  asObject,
  asString,
  getPath,
  isJsonObject,
  objectsIn,
} from "./json.ts";
import { writesMdx } from "./lower.ts";
import type { RemoteFieldMap, RestClient } from "./remote.ts";
import {
  documentEntry,
  fetchJson,
  queryString,
  remoteSource,
} from "./remote.ts";
import type { ContentSource, SourceContext, SourceEntry } from "./types.ts";

export interface ContentfulSourceOptions {
  name: string;
  prefix?: string;
  /** Space id. */
  space: string;
  /** Environment id; default `master`. */
  environment?: string;
  /** The content type id whose entries become pages. */
  contentType: string;
  /** Locale code to fetch; omit for the space's default locale. */
  locale?: string;
  /**
   * Field ids mapping an entry onto Blume meta + body. Paths resolve against
   * the entry's `fields`, with `sys` reachable as `sys.<key>`. Defaults:
   * `title`, `description`, `slug`, `body`, `sys.updatedAt`.
   */
  fields?: RemoteFieldMap;
  /** Extra query parameters for the entries request (`fields.section: "sdk"`). */
  params?: Record<string, string>;
  /** Serializers for embedded entries, keyed by content type id. */
  serializers?: Record<string, (entry: JsonObject) => string>;
  /** Delivery API token; defaults to `CONTENTFUL_ACCESS_TOKEN`. */
  token?: string;
  /** Preview API token for `--preview`; defaults to `CONTENTFUL_PREVIEW_TOKEN`. */
  previewToken?: string;
  /** Opt-in dev polling interval (seconds); omit to freeze for the session. */
  pollInterval?: number;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

const DELIVERY_HOST = "https://cdn.contentful.com";
const PREVIEW_HOST = "https://preview.contentful.com";
const PAGE_SIZE = 100;

const DEFAULT_FIELDS: Required<RemoteFieldMap> = {
  body: "body",
  description: "description",
  lastModified: "sys.updatedAt",
  slug: "slug",
  title: "title",
};

/** The included objects of a page, keyed by `sys.id`. */
const byId = (objects: JsonObject[]): Map<string, JsonObject> =>
  new Map(
    objects.map((object) => [asString(getPath(object, "sys.id")) ?? "", object])
  );

/**
 * Contentful content source. Pages through the Delivery API (the Preview API
 * under `--preview`), maps each entry's fields to frontmatter, and lowers its
 * rich text body to Markdown with the page's `includes` resolving asset and
 * entry links.
 */
export const contentfulSource = (
  options: ContentfulSourceOptions,
  ctx?: SourceContext
): ContentSource => {
  const fields = { ...DEFAULT_FIELDS, ...options.fields };

  const toEntry = (
    item: JsonObject,
    assets: Map<string, JsonObject>,
    linked: Map<string, JsonObject>
  ): SourceEntry => {
    const sys = asObject(item.sys) ?? {};
    const id = asString(sys.id) ?? "";
    // Field paths resolve against the entry's fields, with `sys` beside them.
    const view: JsonObject = { ...asObject(item.fields), sys };
    return documentEntry(
      view,
      fields,
      id,
      (body) =>
        isJsonObject(body)
          ? contentfulRichTextToMarkdown(body, {
              resolveAsset: (assetId) => {
                const asset = assets.get(assetId);
                return asset ? assetFromEntry(asset) : null;
              },
              resolveEntry: (entryId) => linked.get(entryId) ?? null,
              serializers: options.serializers,
            })
          : "",
      false,
      writesMdx(options.serializers)
    );
  };

  const preview = ctx?.preview ?? false;
  const previewToken = (): string | undefined =>
    options.previewToken ?? process.env.CONTENTFUL_PREVIEW_TOKEN;

  // The Preview API rejects delivery tokens, so falling back to one would
  // only trade a clear config error for a 401. Checked before the cache, so
  // a warm snapshot can't stand in for the drafts `--preview` asked for.
  const assertConfigured = (): void => {
    if (preview && !previewToken()) {
      throw new BlumeError({
        code: "BLUME_SOURCE_MISCONFIGURED",
        message: `Source "${options.name}": Contentful --preview needs a Preview API token.`,
        severity: "error",
        suggestion:
          "Set previewToken on contentfulSource, or the CONTENTFUL_PREVIEW_TOKEN environment variable.",
      });
    }
  };

  const fetchEntries = async (): Promise<SourceEntry[]> => {
    const token = preview
      ? previewToken()
      : (options.token ?? process.env.CONTENTFUL_ACCESS_TOKEN);
    const client: RestClient = {
      fetchImpl: options.fetchImpl,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    };
    const host = preview ? PREVIEW_HOST : DELIVERY_HOST;
    const base = `${host}/spaces/${options.space}/environments/${options.environment ?? "master"}/entries`;
    const entries: SourceEntry[] = [];
    let skip = 0;
    let more = true;
    while (more) {
      // The user's params go first so the paging controls always win — a
      // `params` key that shadowed them would refetch the same page forever.
      const query = queryString({
        ...options.params,
        content_type: options.contentType,
        include: "2",
        limit: String(PAGE_SIZE),
        locale: options.locale,
        skip: String(skip),
      });
      // oxlint-disable-next-line no-await-in-loop -- pages are sequential: each response says whether another exists.
      const page = asObject(await fetchJson(`${base}?${query}`, client));
      if (!page) {
        throw new Error("Contentful returned a non-object response");
      }
      const assets = byId(objectsIn(getPath(page, "includes.Asset")));
      const linked = byId(objectsIn(getPath(page, "includes.Entry")));
      const items = objectsIn(page.items);
      for (const item of items) {
        entries.push(toEntry(item, assets, linked));
      }
      skip += items.length;
      more = items.length > 0 && skip < (asNumber(page.total) ?? 0);
    }
    return entries;
  };

  return remoteSource(
    {
      assertConfigured,
      fetchEntries,
      name: options.name,
      pollInterval: options.pollInterval,
      prefix: options.prefix,
      withContext: (next) => contentfulSource(options, next),
    },
    ctx
  );
};
