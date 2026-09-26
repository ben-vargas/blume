/**
 * Consent adapters for `blume.config.ts`:
 *
 * ```ts
 * import { defineConfig } from "blume";
 * import { googleAnalytics } from "blume/analytics";
 * import { native } from "blume/consent";
 *
 * export default defineConfig({
 *   analytics: [googleAnalytics({ id: "G-XXXXXXXXXX" })],
 *   consent: native({ policy: "/privacy" }),
 * });
 * ```
 *
 * With `consent` set, analytics waits for the reader: every adapter's tags are
 * held until the consent adapter reports that analytics is allowed. Each
 * factory returns a plain descriptor (see `core/adapter.ts`).
 *
 * Adding a consent manager: a factory and option schema in its own module,
 * a member of `consentAdapterSchema` (`schema.ts`), and its tags in
 * `consentHead` (`head.ts`): the manager's loader, then a constant bridge
 * script that calls `window.blumeConsent.set({ analytics })` with the
 * reader's choice on load and on every change, and sets
 * `window.blumeConsent.open` to reopen the manager's preferences (see
 * `init.ts` for the contract, and `osano.ts` for an example).
 */
export type { AdapterDescriptor, JsonValue } from "../core/adapter.ts";
export { ethyca } from "./ethyca.ts";
export type { EthycaAdapter, EthycaOptions } from "./ethyca.ts";
export { native } from "./native.ts";
export type { NativeAdapter, NativeOptions } from "./native.ts";
export { osano } from "./osano.ts";
export type { OsanoAdapter, OsanoOptions } from "./osano.ts";
export type { ConsentAdapter } from "./schema.ts";
