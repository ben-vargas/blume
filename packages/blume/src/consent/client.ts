/**
 * The browser half of the consent layer (`consent` in `blume.config.ts`),
 * bundled into every layout by `ConsentHead.astro` and started once per real
 * page load. It answers `window.blumeConsent` (see `init.ts`):
 *
 * - Analytics scripts wait in the page as `<script type="text/plain"
 *   data-blume-consent="analytics">` (see `Analytics.astro`). Once the reader
 *   allows analytics, each one runs, once per page load: the client router
 *   brings the held tags back on every navigation, and running them again
 *   would count every visit twice.
 * - A reader who takes consent back after the scripts ran gets a reload, the
 *   one way to stop scripts that already started.
 * - Any element with `data-blume-consent-open` (the footer's Cookie settings
 *   link) reopens the adapter's preferences.
 * - Under `native()` it is the adapter too: it reads the stored answer, shows
 *   the banner until the reader picks one, and stores the pick.
 */

/** What a consent adapter reports: whether the reader allows analytics. */
export interface ConsentState {
  analytics: boolean;
}

/** `window.blumeConsent`, created by the inline init script. */
export interface BlumeConsent {
  /** `null` until an adapter reports, then the reader's choice. */
  analytics: boolean | null;
  /** The configured adapter's kind. */
  kind: string;
  /** Reopen the reader's consent choices; set by the adapter. */
  open?: () => void;
  /** Report the reader's choice; fires `blume:consent` when it changes. */
  set: (state: ConsentState) => void;
}

/** The window, with the state the init script puts on it. */
type ConsentWindow = Window & { blumeConsent?: BlumeConsent };

/** Analytics tags held until the reader allows analytics. */
export const HELD_SCRIPTS =
  'script[type="text/plain"][data-blume-consent="analytics"]';

/** Where `native()` keeps the reader's answer. */
export const CONSENT_STORAGE_KEY = "blume-consent";

const BANNER = "[data-blume-consent-banner]";
const CHOICE = "[data-blume-consent-choice]";
const OPEN = "[data-blume-consent-open]";

/**
 * Run each held tag the page hasn't run yet, as a new `<script>` beside it
 * with the same attributes and body. `ran` is keyed by the tag's markup,
 * which is the same on every page, so a tag the router brings back is
 * skipped.
 */
export const runHeldScripts = (ran: Set<string>): void => {
  for (const held of document.querySelectorAll(HELD_SCRIPTS)) {
    const key = held.outerHTML;
    if (ran.has(key)) {
      continue;
    }
    ran.add(key);
    const script = document.createElement("script");
    for (const { name, value } of held.attributes) {
      if (name !== "type" && name !== "data-blume-consent") {
        script.setAttribute(name, value);
      }
    }
    // A created script is async unless told otherwise; keep the tags in
    // document order, as the parser would have, unless one asked for async.
    if (!held.hasAttribute("async")) {
      script.async = false;
    }
    script.text = held.textContent ?? "";
    held.after(script);
  }
};

/** The stored `native()` answer, or `null` before one (or without storage). */
export const storedChoice = (): boolean | null => {
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (value === "granted" || value === "denied") {
      return value === "granted";
    }
  } catch {
    // Storage blocked: ask again on every page rather than fail.
  }
  return null;
};

const storeChoice = (granted: boolean): void => {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, granted ? "granted" : "denied");
  } catch {
    // Storage blocked: the answer holds for this page load only.
  }
};

const banner = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(BANNER);

/**
 * Wire this page's banner: show it while the reader hasn't answered, and
 * store and report an answer. Runs again after every client-router swap,
 * which brings a fresh, hidden banner.
 */
const syncBanner = (consent: BlumeConsent): void => {
  const element = banner();
  if (!element) {
    return;
  }
  element.hidden = storedChoice() !== null;
  for (const button of element.querySelectorAll<HTMLElement>(CHOICE)) {
    button.addEventListener("click", () => {
      const granted = button.dataset.blumeConsentChoice === "accept";
      storeChoice(granted);
      element.hidden = true;
      consent.set({ analytics: granted });
    });
  }
};

/** Start the consent runtime on this page load. */
export const startConsent = (): void => {
  // SAFETY: ConsentWindow only adds the optional state the init script
  // creates; it's checked before use.
  const consent = (window as ConsentWindow).blumeConsent;
  if (!consent) {
    return;
  }
  const ran = new Set<string>();
  const run = () => {
    if (consent.analytics === true) {
      runHeldScripts(ran);
    }
  };
  window.addEventListener("blume:consent", () => {
    if (consent.analytics === true) {
      runHeldScripts(ran);
    } else if (ran.size > 0) {
      location.reload();
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(OPEN)) {
      consent.open?.();
    }
  });
  if (consent.kind === "native") {
    consent.open = () => {
      const element = banner();
      if (element) {
        element.hidden = false;
      }
    };
    syncBanner(consent);
    consent.set({ analytics: storedChoice() === true });
  }
  run();
  document.addEventListener("astro:after-swap", () => {
    run();
    if (consent.kind === "native") {
      syncBanner(consent);
    }
  });
};
