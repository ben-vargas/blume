/**
 * Link destinations in content Blume imports from someone else — an API spec's
 * descriptions, a repository's release notes, CMS rich text — that are safe to
 * render as a clickable link. Author-written pages are trusted and never pass
 * through here; imported content can carry a `javascript:` (or `data:`,
 * `vbscript:`) link that would run as the docs site when a reader clicks it.
 * A destination with no scheme (a relative path, a fragment) stays a link, as
 * does one whose scheme is on this list.
 */
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

const SCHEME = /^(?<scheme>[a-z][\d+.a-z-]*):/iu;

// The URL parser removes ASCII tabs and newlines anywhere, and strips leading
// C0 controls and spaces, before it reads a scheme — so `java\tscript:` is a
// `javascript:` URL to a browser, and the check must see it the same way.
const URL_IGNORED = /[\t\n\r]/gu;

/** Whether a link destination from imported content is safe to keep. */
export const isSafeHref = (href: string): boolean => {
  const cleaned = href.replaceAll(URL_IGNORED, "");
  let start = 0;
  while (start < cleaned.length && (cleaned.codePointAt(start) ?? 0) <= 0x20) {
    start += 1;
  }
  const scheme = SCHEME.exec(cleaned.slice(start))?.groups?.scheme;
  return scheme === undefined || SAFE_SCHEMES.has(scheme.toLowerCase());
};
