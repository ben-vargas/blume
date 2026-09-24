import { z } from "zod";

import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";
import type { SharedSourceOptions } from "./shared.ts";
import { DEFAULT_CONTENT_GLOB, sharedSourceOptionsSchema } from "./shared.ts";

/** Options for {@link mdxRemote}. */
export interface MdxRemoteOptions extends SharedSourceOptions {
  /** Explicit list of source-relative file paths to fetch from `url`. */
  files?: string[];
  /** Enumerate a GitHub repo subtree via the git-trees API. */
  github?: {
    /** Repository owner (user or org). */
    owner: string;
    /** Subpath within the repo. Defaults to the repo root. */
    path?: string;
    /** Git ref (branch, tag, or SHA). Defaults to `main`. */
    ref?: string;
    /** Repository name. */
    repo: string;
  };
  /** Glob patterns applied to enumerated refs. Defaults to `["**\/*.{md,mdx}"]`. */
  include?: string[];
  /** Raw base URL, e.g. `https://raw.githubusercontent.com/acme/sdk/main/docs`. */
  url?: string;
}

export const mdxRemoteOptionsSchema = sharedSourceOptionsSchema.extend({
  files: z.array(z.string()).optional(),
  github: z
    .strictObject({
      owner: z.string(),
      path: z.string().default(""),
      ref: z.string().default("main"),
      repo: z.string(),
    })
    .optional(),
  include: z.array(z.string()).default([DEFAULT_CONTENT_GLOB]),
  url: z.string().optional(),
});

export type MdxRemoteAdapter = AdapterDescriptor<
  "mdx-remote",
  MdxRemoteOptions
>;

export const mdxRemoteAdapterSchema = adapterDescriptorSchema(
  "mdx-remote",
  mdxRemoteOptionsSchema
);

// The hosts the source ever sends `GITHUB_TOKEN` to (the same set the fetch
// in core/sources/mdx-remote.ts checks), so only an adapter reading from
// GitHub declares the variable.
const GITHUB_HOSTS = new Set(["api.github.com", "raw.githubusercontent.com"]);

const readsFromGithub = (options: MdxRemoteOptions): boolean =>
  options.github !== undefined ||
  (options.url !== undefined &&
    URL.canParse(options.url) &&
    GITHUB_HOSTS.has(new URL(options.url).hostname));

/**
 * Remote Markdown/MDX fetched over HTTP. Enumerate files explicitly against a
 * raw `url` base, or from a GitHub repo subtree via `github`. A private repo's
 * token comes from `GITHUB_TOKEN` — never inline it here. The adapter declares
 * the variable only when it reads from GitHub, since a `url` on any other host
 * is never sent the token.
 */
export const mdxRemote = (options: MdxRemoteOptions): MdxRemoteAdapter => ({
  kind: "mdx-remote",
  options,
  requiredSecrets: readsFromGithub(options) ? ["GITHUB_TOKEN"] : [],
  runtimeDeps: [],
});
