/* Which Sammlung is open, and what it is called.
 *
 * shell/collections.ts used to hold the list, the four things somebody can
 * do to it and the sidebar around it in one file, and every part read the
 * same `held` at the top. The parts are their own modules now - the list
 * (collections.ts), making one (collectionNew.ts), exporting one
 * (collectionExport.ts), the column and the drawer (sidebar.ts) - and this is
 * what they share: the list as it was last read, the name a Sammlung goes
 * by, and the one way to ask for the list to be painted again.
 */
import { downloadSlug } from "@lautstark/werkzeuge/filename";
import { LANG } from "../core/boot.js";
import { t } from "../core/texts.js";
import type { CollectionList } from "../core/types.js";

/** The list as it was last read. Kept so that the name field and the menu do
 *  not each have to go back to the store to find out which one is open.
 *
 *  An object whose field is replaced rather than an exported `let`, for the
 *  reason core/state.ts gives: an importer of `export let` gets a live view
 *  and cannot assign to it. */
export const held: { list: CollectionList } = {
  list: { collections: [], current: null },
};

/** What to call a Sammlung nobody has named.
 *
 * Only the one carried across from the single-layout database is ever unnamed -
 * everything made since is named for the day - so this is a fallback for one
 * row in one browser, and it is deliberately not derived from where that row
 * sits. It was "Sammlung {n}" from its position, which reads fine in a list
 * ordered by creation and renames itself in a list ordered by what was written
 * last: making a second Sammlung would have turned "Sammlung 1" into
 * "Sammlung 2" without anybody touching it. */
export const nameOf = (name: string): string => name.trim() || t("ui.collection_unnamed");

/** A new one is named for the day, the way a new notebook is.
 *
 * Both halves follow the page's language: the words through t(), and the date
 * through LANG, so an English page does not read "Sammlung vom 08/24/2026" or a
 * German one "Collection of 24.08.2026". Every caller has to be somewhere the
 * language is already settled - see nameIfUnnamed() in collections.ts. */
export const defaultName = (): string =>
  t("ui.collection_default", { date: new Date().toLocaleDateString(LANG, {
    day: "2-digit", month: "2-digit", year: "numeric",
  }) });

/** Whether the open Sammlung is one the list knows. False between a delete
 *  and the next paint, and on a page that has not read the list yet. */
export const haveCurrent = (): boolean =>
  held.list.collections.some((one) => one.id === held.list.current);

/** The open Sammlung's name as somebody would read it, fallback included. */
export const currentName = (): string => {
  const open = held.list.collections.find((one) => one.id === held.list.current);
  return open ? nameOf(open.name) : "";
};

/** The name of the Sammlung, as something a file system will take.
 *
 *  One rule for both exports, which is the only thing this line is for: the
 *  package and the talker's .obz are separate writers by design
 *  (exchange/SPEC.md 5.2), and what they are called is not one of the things
 *  they are allowed to differ about. Somebody who exports the same Sammlung
 *  twice should get two files with one name and two extensions.
 *
 *  downloadSlug() rather than the store's safeName(), and the difference is a
 *  Sammlung with an umlaut in it: this one spells the letter out where that
 *  one punched a `_` through it. */
export const fileStem = (): string => downloadSlug(currentName());

/* The list, painted again from the store. collections.ts owns the painting
 * and hands it in once at load through usePaint(); the modules that make,
 * open and delete a Sammlung only ask for it. A slot rather than an import,
 * because collections.ts imports every module that would import it back, and
 * a cycle that happens to work is one nobody can reason about. */
let paint: () => Promise<void> = () => {
  throw new Error("the Sammlung list is not wired");
};

/** Called once, by collections.ts, when the module that paints is loaded. */
export function usePaint(fn: () => Promise<void>): void {
  paint = fn;
}

/** The sidebar and the work head, from whatever the store last said. */
export function repaint(): Promise<void> {
  return paint();
}
