import type { AdapterDescriptor } from "../core/adapter.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";
import { rateLimitOptionsSchema } from "./memory.ts";
import type { RateLimitOptions } from "./memory.ts";

/** The env vars holding the Upstash Redis REST endpoint and its token. */
export const UPSTASH_SECRETS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

export type UpstashAdapter = AdapterDescriptor<"upstash", RateLimitOptions>;

export const upstashAdapterSchema = adapterDescriptorSchema(
  "upstash",
  rateLimitOptionsSchema
);

/**
 * Keeps the count in Upstash Redis, which every instance on every host shares,
 * so the limit holds exactly. It talks to Upstash's REST API, so there is
 * nothing to install; the endpoint and token come from
 * `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
 */
export const upstash = (options: RateLimitOptions = {}): UpstashAdapter => ({
  kind: "upstash",
  options,
  requiredSecrets: [...UPSTASH_SECRETS],
  runtimeDeps: [],
});
