/* The two things on this page that are not inert.
 *
 * Every other word here arrives as text, which says whatever it says and does
 * nothing. An `href` is different: it is a place the browser will go. The text
 * table is our own source rather than anybody's content - but that is exactly
 * the assumption the old `__TEXTS__` hole rested on, and it only has to stop
 * being true once.
 *
 * So an address out of the table is checked rather than trusted, and there are
 * two checks because there are two shapes: a page to visit, and somebody to
 * write to. They are separate functions rather than one with the scheme glued
 * on, because then the table would hold the scheme and the guard would have to
 * let one more through - here the table holds an address and nothing else.
 *
 * Both answer "" for anything that fails, which renders as an anchor with an
 * empty href: a link that goes nowhere rather than a link somewhere unexpected.
 *
 * This was two private functions in core/texts.ts, called by id from the pass
 * that filled a hundred labels in. The labels are in the components now and
 * that pass is four lines; the guard is the half of it that was not markup. */

/** A page to visit, or "" for anything that is not one. */
export const outward = (url: string): string =>
  url.startsWith("https://") ? url : "";

/** Somebody to write to, or "" for anything that is not an address. */
export const mailward = (address: string): string =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? `mailto:${address}` : "";
