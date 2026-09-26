/**
 * The rate limit the generated server routes check before any work: the
 * assistant (`/api/ask`), the API playground proxy (`/_api-proxy`), and
 * server-side search. Each route builds one limiter at module scope from the
 * configured adapter (`rateLimit` in `blume.config.ts`) and asks it about
 * every request, keyed by the reader's IP address and the route, so each
 * route has its own budget.
 *
 * A limiter never stands between a reader and the docs by accident: a
 * request whose address the host can't tell is let through, and so is one
 * the shared store fails to count (logged, not blocked). A shared store
 * without its secrets or binding falls back to counting in memory.
 */
import { clientAddressOf } from "../core/client-address.ts";
import type { ClientContext } from "../core/client-address.ts";
import { RATE_LIMIT_BINDING } from "./cloudflare.ts";
import { DEFAULT_REQUESTS, DEFAULT_WINDOW } from "./memory.ts";
import type { RateLimitAdapter } from "./schema.ts";
import { UPSTASH_SECRETS } from "./upstash.ts";

/** What a limiter says about one request. */
export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the reader's window resets. */
  retryAfter: number;
}

/** Count one request against `key`. */
export type Limiter = (key: string) => Promise<RateLimitResult>;

/** A Workers rate limiting binding (`ratelimits` in the Worker's config). */
export interface RateLimitBinding {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

/** What a generated route hands the limiter from its runtime. */
export interface LimiterRuntime {
  /** The Worker's rate limiting binding, under `cloudflare()`. */
  binding?: RateLimitBinding;
  /** For tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** For tests; defaults to `Date.now`. */
  now?: () => number;
  /** Reads a secret (`getSecret` from `astro:env/server`). */
  secret?: (name: string) => string | undefined;
}

/** Past this many tracked readers, a memory limiter drops expired ones. */
const MEMORY_SWEEP_AT = 10_000;

/** One reader's count in the current window. */
interface MemoryEntry {
  count: number;
  resetAt: number;
}

/**
 * Count in this server's memory, in fixed windows: each reader's first
 * request opens a window, and the count resets when it ends.
 */
export const memoryLimiter = (
  requests: number,
  window: number,
  now: () => number = Date.now
): Limiter => {
  const entries = new Map<string, MemoryEntry>();
  return (key) => {
    const time = now();
    if (entries.size >= MEMORY_SWEEP_AT) {
      for (const [tracked, entry] of entries) {
        if (entry.resetAt <= time) {
          entries.delete(tracked);
        }
      }
    }
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + window * 1000 };
      entries.set(key, entry);
    }
    entry.count += 1;
    return Promise.resolve({
      allowed: entry.count <= requests,
      retryAfter: Math.ceil((entry.resetAt - time) / 1000),
    });
  };
};

/** One command's reply from Upstash's REST pipeline. */
interface UpstashReply {
  error?: string;
  result?: number | string | null;
}

/**
 * Count in Upstash Redis over its REST API: one pipeline opens the window
 * (`SET … EX … NX`), counts the request (`INCR`), and reads what's left of
 * the window (`TTL`).
 */
export const upstashLimiter = (
  requests: number,
  window: number,
  endpoint: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): Limiter => {
  const url = `${endpoint.replace(/\/+$/u, "")}/pipeline`;
  return async (key) => {
    const response = await fetchImpl(url, {
      body: JSON.stringify([
        ["SET", key, "0", "EX", String(window), "NX"],
        ["INCR", key],
        ["TTL", key],
      ]),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Upstash answered ${response.status}.`);
    }
    // SAFETY: Upstash's pipeline endpoint answers with one reply object per
    // command, in order; a missing or failed reply reads as `NaN` below.
    const replies = (await response.json()) as UpstashReply[];
    const count = Number(replies[1]?.result ?? Number.NaN);
    const ttl = Number(replies[2]?.result);
    if (Number.isNaN(count)) {
      throw new TypeError("Upstash sent no count.");
    }
    return { allowed: count <= requests, retryAfter: ttl > 0 ? ttl : window };
  };
};

/** Count with a Workers rate limiting binding. */
export const bindingLimiter =
  (binding: RateLimitBinding, window: number): Limiter =>
  async (key) => {
    const { success } = await binding.limit({ key });
    return { allowed: success, retryAfter: window };
  };

/** The limit an adapter sets, with Cloudflare's own defaults for its binding. */
const limitOf = (adapter: RateLimitAdapter) =>
  adapter.kind === "cloudflare"
    ? {
        requests: adapter.options.requests ?? 10,
        window: adapter.options.window ?? 60,
      }
    : {
        requests: adapter.options.requests ?? DEFAULT_REQUESTS,
        window: adapter.options.window ?? DEFAULT_WINDOW,
      };

/**
 * The limiter for the configured adapter, or `null` when rate limiting is
 * off. A shared store missing its secrets or binding counts in memory and
 * says so once.
 */
export const createLimiter = (
  adapter: RateLimitAdapter | null,
  runtime: LimiterRuntime = {}
): Limiter | null => {
  if (!adapter) {
    return null;
  }
  const { requests, window } = limitOf(adapter);
  if (adapter.kind === "cloudflare") {
    if (runtime.binding) {
      return bindingLimiter(runtime.binding, window);
    }
    console.warn(
      `Rate limiting counts in memory: the Worker has no ${RATE_LIMIT_BINDING} binding.`
    );
  }
  if (adapter.kind === "upstash") {
    const [endpoint, token] = UPSTASH_SECRETS.map((name) =>
      runtime.secret?.(name)
    );
    if (endpoint && token) {
      return upstashLimiter(requests, window, endpoint, token, runtime.fetch);
    }
    console.warn(
      `Rate limiting counts in memory: set ${UPSTASH_SECRETS.join(" and ")} to share the count through Upstash.`
    );
  }
  return memoryLimiter(requests, window, runtime.now);
};

/** The slice of Astro's `APIContext` the check reads. */
export type RateLimitContext = ClientContext;

/**
 * Count this request against the reader's budget for `scope` (the route).
 * `null` to go ahead, or the `429 Too Many Requests` to return.
 */
export const rateLimited = async (
  limiter: Limiter | null,
  context: RateLimitContext,
  scope: string
): Promise<Response | null> => {
  const address = limiter ? clientAddressOf(context) : undefined;
  if (!(limiter && address)) {
    return null;
  }
  // The host keeps two sites on one shared store apart.
  const key = `blume:${new URL(context.request.url).host}:${scope}:${address}`;
  let result: RateLimitResult;
  try {
    result = await limiter(key);
  } catch (error) {
    console.error("Rate limiting failed; letting the request through:", error);
    return null;
  }
  if (result.allowed) {
    return null;
  }
  return new Response(
    `Too many requests: try again in ${result.retryAfter} seconds.`,
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "retry-after": String(result.retryAfter),
      },
      status: 429,
    }
  );
};
