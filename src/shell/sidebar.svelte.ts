/* --- The sidebar itself ------------------------------------------------------- */
import { readSettings, writeSettings } from "../backend/index.js";

/* Whether the column is there at all. A choice about the shape of the window is
 * not one to make every visit, so it is remembered - and in the settings record
 * with every other preference rather than in localStorage, because a preference
 * living in two stores is one that gets restored by one and overwritten by the
 * other. conventions.md §1.3.
 *
 * A desktop question only. Below 820px there is no column to collapse, only a
 * layer to dismiss - see the drawer below - and the remembered answer is
 * deliberately not consulted down there.
 *
 * Two runes rather than four elements reached by id. What the classes and the
 * two `hidden` attributes were is Shell.svelte's now; what is here is the pair
 * of answers, which is what this module was always about. */
let column = $state(true);
/* The drawer. Opening is a moment rather than a preference, so nothing here is
 * written down: closing the tab closes it, which is what somebody expects of a
 * thing they slid over their work. §1.3 is about the column, not this. */
let drawer = $state(false);

export const columnOpen = (): boolean => column;
export const drawerOpen = (): boolean => drawer;

export async function showColumn(open: boolean, remember = true): Promise<void> {
  column = open;
  if (remember) await writeSettings({ sidebarOpen: open });
}

export const openDrawer = (): void => { drawer = true; };
export const closeDrawer = (): void => { drawer = false; };

/** Below this the sidebar is a layer over the work, not a column beside it.
 *  The number is conventions.md §3.1's, and it is the one the stylesheet
 *  breaks at - the two have to agree or the controls and the layout disagree
 *  about which arrangement is on screen. */
export const narrow = (): boolean => matchMedia("(max-width: 820px)").matches;

/* Choosing one closes the drawer: the layer is in the way of the thing that was
 * just asked for. Only where it is a layer - on a desktop the column stays. */
export function closeOnPick(): void {
  if (narrow()) closeDrawer();
}

/** The remembered answer for the column, read once. Called by
 *  wireCollections(), which is where the four button bindings used to be. */
export function restoreColumn(): void {
  void readSettings().then((held) => { column = held.sidebarOpen !== false; });
}
