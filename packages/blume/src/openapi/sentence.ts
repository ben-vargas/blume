/**
 * A sentence's closing punctuation, allowing trailing closing quotes or
 * brackets (`…done.")`) and the CJK full-width marks.
 */
const TERMINAL_PUNCTUATION = /[.!?…。！？]["'”’)\]]*$/u;

/**
 * Close a fragment of spec prose as a sentence. OpenAPI `summary` values are
 * usually title-like ("Get a flag", no period), so prose that runs straight
 * into the next generated sentence ("Get a flag Reference for …") needs one.
 * Empty text stays empty.
 */
export const asSentence = (text: string): string =>
  text === "" || TERMINAL_PUNCTUATION.test(text) ? text : `${text}.`;
