/** What went wrong, as a sentence somebody can be shown.
 *
 * A caught value is `unknown` and usually but not always an Error - a rejected
 * fetch, a DOMException, or anything a library chose to throw. Reading .message
 * off it directly was fine until it was not, and the failure mode is
 * "undefined" appearing in the interface where an explanation belonged.
 *
 * In core/ rather than ui/dom.ts, where it started: the format modules under
 * data/ need it too, and a converter reaching into the module that owns the
 * document is the wrong direction for a dependency to run.
 */
export const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/* `Trouble` stood here, and it left with adr/0012.
 *
 * A class carrying a `word` rather than prose, so that a failure the page has
 * a sentence prepared for - a device that did not answer, a build that moved
 * while it was being read - could be shown as `t("err." + word, facts)` rather
 * than raw. Its two callers were the cable and the folder export, both of them
 * in loader/, and its whole `err.*` vocabulary was four `err.cable_*` keys.
 * docs/split-crossings.md put it plainly: it was not shared infrastructure, it
 * was a class that stayed in core/ because that is where it was standing when
 * the cable walked out from under it. So it moved whole, with its four words,
 * and this file's opening paragraph is about reason() alone now.
 *
 * The two names in one 41-line file got opposite answers, which is worth
 * remembering if a second one is ever proposed for core/: the question is not
 * where a thing sits, it is who calls it.
 */
