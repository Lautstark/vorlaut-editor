/* --- The sidebar itself ------------------------------------------------------- */
import { byId } from "./dom.js";
import { readSettings, writeSettings } from "../backend/index.js";

/* Whether the column is there at all. A choice about the shape of the window is
 * not one to make every visit, so it is remembered - and in the settings record
 * with every other preference rather than in localStorage, because a preference
 * living in two stores is one that gets restored by one and overwritten by the
 * other. conventions.md §1.3.
 *
 * A desktop question only. Below 820px there is no column to collapse, only a
 * layer to dismiss - see openDrawer() below - and the remembered answer is
 * deliberately not consulted down there. */
async function showSidebar(open: boolean, remember = true): Promise<void> {
  document.body.classList.toggle("collapsed", !open);
  byId("sidebarShow").hidden = open;
  if (remember) await writeSettings({ sidebarOpen: open });
}

/** Below this the sidebar is a layer over the work, not a column beside it.
 *  The number is conventions.md §3.1's, and it is the one the stylesheet
 *  breaks at - the two have to agree or the controls and the layout disagree
 *  about which arrangement is on screen. */
export const narrow = (): boolean => matchMedia("(max-width: 820px)").matches;

/* The drawer. Opening is a moment rather than a preference, so nothing here is
 * written down: closing the tab closes it, which is what somebody expects of a
 * thing they slid over their work. §1.3 is about the column, not this. */
function openDrawer(): void {
  byId("sidebar").classList.add("open");
  byId("scrim").hidden = false;
}

function closeDrawer(): void {
  byId("sidebar").classList.remove("open");
  byId("scrim").hidden = true;
}

/* Choosing one closes the drawer: the layer is in the way of the thing that was
 * just asked for. Only where it is a layer - on a desktop the column stays. */
export function closeOnPick(): void {
  if (narrow()) closeDrawer();
}

/** The column's two buttons, the drawer's two and the scrim, and the
 *  remembered answer for the column. Called by wireCollections(). */
export function wireSidebar(): void {
  byId<HTMLButtonElement>("sidebarHide").onclick = () => { void showSidebar(false); };
  byId<HTMLButtonElement>("sidebarShowBtn").onclick = () => { void showSidebar(true); };
  byId<HTMLButtonElement>("sidebarOpenBtn").onclick = openDrawer;
  byId<HTMLButtonElement>("sidebarClose").onclick = closeDrawer;
  byId("scrim").onclick = closeDrawer;
  void readSettings().then((held) => showSidebar(held.sidebarOpen !== false, false));
}
