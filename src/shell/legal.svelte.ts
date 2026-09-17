/* Which of the three pages the footer opens is showing.
 *
 * There is no state here worth the name: one dialog, three sections, and the
 * only decision is which one is not hidden. It is a module rather than three
 * lines in the footer because the pages have to agree on that - a second caller
 * showing one section without hiding the other two would put the Impressum
 * under the privacy notice, and the dialog would still look right until
 * somebody scrolled. Written as one answer rather than three flags, which is
 * what makes the disagreement unsayable.
 */

/** The three sections, and the heading each of them opens under. The heading
 *  is also the dialog's accessible name - see Legal.svelte. */
export const LEGAL_PAGES = {
  aboutPage: "ui.legal_about",
  impressumPage: "ui.legal_impressum",
  privacyPage: "ui.legal_privacy",
} as const;

export type LegalPage = keyof typeof LEGAL_PAGES;

let showing = $state<LegalPage | null>(null);

/** Which page is open, or null while the dialog is not. */
export const legalPage = (): LegalPage | null => showing;

export function showLegal(page: LegalPage): void {
  showing = page;
}

export function closeLegal(): void {
  showing = null;
}

/** The setter half, for `bind:page` on @lautstark/design/svelte/Legal.
 *
 * The component holds which page is showing as a two-way prop, because every
 * way out - the ✕, Escape, a press outside - has to end with the dialog and the
 * caller agreeing rather than one of them left behind. `bind:` cannot take a
 * function pair's worth of question and answer out of a module, so this is the
 * answer half and legalPage() above is the question half; the getter/setter
 * form of `bind:` is what puts them back together at the call site.
 *
 * A key the component hands back is one it was given - `pages` is built from
 * LEGAL_PAGES - so the cast is a cast and not a widening. */
export function setLegalPage(page: string | null): void {
  showing = (page as LegalPage | null) ?? null;
}
