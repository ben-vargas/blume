/**
 * Search analytics: what readers search for, what they find, and what they
 * open, sent through the configured analytics adapters (`track`).
 *
 * The dialog searches on every keystroke, so a query is only recorded once it
 * settles: a second without typing, or the reader picking a result or closing
 * the dialog. Each settled query is one `search` event with the number of
 * results, so a dashboard can list the queries that found nothing. Picking a
 * result is a `search_select` event with its position, for click-through. The
 * same query settling twice in a row (a filter toggled back and forth) counts
 * once.
 */
import type { TrackProps } from "../analytics-client.ts";

/** The longest query sent: past this it's rarely a search term. */
export const MAX_QUERY_CHARS = 100;

/** How long a query sits untouched before it counts as settled. */
export const SETTLE_MS = 1000;

/** Sends one analytics event. */
export type SendEvent = (event: string, props: TrackProps) => void;

/** The timer a tracker waits on; injectable for tests. */
export interface SettleTimer {
  cancel: (handle: number) => void;
  start: (callback: () => void, ms: number) => number;
}

/** What the dialog tells the tracker. */
export interface SearchTracker {
  /** The dialog closed; record the query it was showing. */
  closed: () => void;
  /** The reader picked result `position` (1-based) for `query`. */
  selected: (query: string, position: number, url: string) => void;
  /** Results for `query` are on screen. */
  settled: (query: string, results: number) => void;
}

/** A query and how many results it found. */
interface PendingSearch {
  query: string;
  results: number;
}

const browserTimer: SettleTimer = {
  cancel: (handle) => clearTimeout(handle),
  start: (callback, ms) => Number(setTimeout(callback, ms)),
};

/** A tracker for one search dialog. */
export const createSearchTracker = (
  send: SendEvent,
  timer: SettleTimer = browserTimer
): SearchTracker => {
  let pending: PendingSearch | undefined;
  let handle: number | undefined;
  let last: string | undefined;

  const flush = (): void => {
    if (handle !== undefined) {
      timer.cancel(handle);
      handle = undefined;
    }
    if (pending && pending.query !== last) {
      send("search", {
        path: location.pathname,
        query: pending.query,
        results: pending.results,
      });
      last = pending.query;
    }
    pending = undefined;
  };

  return {
    closed: () => {
      flush();
      last = undefined;
    },
    selected: (query, position, url) => {
      flush();
      send("search_select", {
        path: location.pathname,
        position,
        query: query.slice(0, MAX_QUERY_CHARS),
        url,
      });
    },
    settled: (query, results) => {
      if (handle !== undefined) {
        timer.cancel(handle);
      }
      pending = { query: query.slice(0, MAX_QUERY_CHARS), results };
      handle = timer.start(flush, SETTLE_MS);
    },
  };
};
