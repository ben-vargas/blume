/**
 * A file or folder name's ordering prefix: digits, then a `-`, `_`, or `.`
 * separator (`01-intro`, `2_setup`). It sorts the generated sidebar and is
 * dropped from the route.
 */
const ORDERING_PREFIX = /^(?<order>\d+)[-_.]/u;

/**
 * Digit-led names that are names, not orders, and stay whole: a version
 * (`1.2.0`, `2.0`), which a `1.` prefix would split into `2.0`, and an ISO date
 * (`2024-01-05`, `2024-01-05-first-post`), whose year would sort the sidebar
 * and leave only `01-05…` of the route.
 */
const NOT_AN_ORDER = /^(?:\d+\.\d|\d{4}-\d{2}-\d{2}(?:[-_.]|$))/u;

/** The digits of `name`'s ordering prefix (`01` of `01-intro`), if it has one. */
export const orderingPrefix = (name: string): string | undefined =>
  NOT_AN_ORDER.test(name)
    ? undefined
    : name.match(ORDERING_PREFIX)?.groups?.order;

/** `name` without its ordering prefix (`01-intro` -> `intro`). */
export const stripOrderingPrefix = (name: string): string => {
  const order = orderingPrefix(name);
  // The prefix is the digits plus their one-character separator.
  return order === undefined ? name : name.slice(order.length + 1);
};
