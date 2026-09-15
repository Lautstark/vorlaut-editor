// Where the tablet editor is standing, and the few answers every part of it
// asks for.
//
// editor.ts used to be one file of two thousand lines, and the state at the
// top of it - which page, which fact is unfolded, whether the keyboard wants
// putting back in the list - was read and written from every section below.
// The sections are their own modules now (pageHead, grid, buttonSheet,
// panels, pageList) and this is the one thing they share: the standing state,
// the layout as the shape this editor is for, the page on screen, and the two
// ways a change reaches the page - commit() for structure, render() for a
// redraw.
//
// `here` lives here and nowhere else. It is where the editor is standing -
// which page - and it is reset by adopt() for the same reason editor-diy's
// `current` is: page three of the kitchen Sammlung and page three of the
// nursery Sammlung have nothing to do with each other.
//
// There is no `chosen` beside it any more. A button was once selected and the
// panel showed it, so which one that was had to be remembered between renders;
// now a press opens a sheet that carries its own copy and closes over it, and
// the board goes back to having nothing on it that outlives a press.
import { state } from "../core/state.js";
import { isApp } from "../core/types.js";
import type { AppButton, AppLayout, AppPage, WordColor } from "../core/types.js";
import { LANG } from "../core/boot.js";
import { t } from "../core/texts.js";
import { save } from "../core/save.js";
import { paintOpenCollection } from "../shell/collections.js";
import { buttonAt, pageById, shared, sharedAt } from "./pages.js";

/** The editor's standing state. One object rather than three exported `let`s,
 *  for the reason core/state.ts gives: an importer of `export let` gets a live
 *  view and cannot assign to it. */
export const at = {
  /** Which page is being edited, by id. An id rather than an index because
   *  deleting a page shifts every index after it and would silently move where
   *  somebody is standing. */
  here: "",
  /** Which fact over the board is open, or none. Module state rather than the
   *  DOM's, because every render throws the line away and rebuilds it. */
  unfolded: null as string | null,
  /** Set where a redraw should put the keyboard back into the page list. */
  wantFocus: false,
};

/* state.layout, as the shape this editor is the editor for.
 *
 * The shell holds one layout and it may be either kind. This file may only
 * ever be looking at the tablet half, because the composition root installs it
 * for an app Sammlung and for nothing else - so the guarantee is written down
 * once here instead of being asserted at every read below.
 *
 * It throws for the reason byId() throws: reaching here with a talker Sammlung on
 * screen is not a case to handle, it is a composition root that has installed
 * the wrong editor. */
export function board(): AppLayout {
  const held = state.layout;
  if (!isApp(held)) throw new Error("the tablet editor was given a talker Sammlung");
  return held;
}

/** The page on screen. Falls back to the first rather than to nothing: `here`
 *  can name a page that has just been deleted, and an editor standing on
 *  nothing is a blank screen with no way out of it. */
export function page(): AppPage {
  const layout = board();
  return pageById(layout, at.here) ?? layout.pages[0]!;
}

/** What a page is called in the strip. Its name, or its position where nobody
 *  has named it - the same fallback the delete question uses. */
export const pageName = (one: AppPage): string =>
  one.name || t("ui.app_page_n", { n: board().pages.indexOf(one) + 1 });

/** Two decimals, in the page's language. The effort numbers sit in a column in
 *  the sidebar and beside each other in the facts line, so they are formatted
 *  once, here, rather than by each caller. */
export const decimals = new Intl.NumberFormat(LANG, {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** Whether this column of the board is the Sammlung's shared one rather than
 *  the page's. Column zero, and only while the Sammlung has such a column. */
export const inColumn = (col: number): boolean => col === 0 && shared(board());

/** What sits in one cell of the board on screen, from whichever of the two
 *  stores owns that cell. */
export const cellHolder = (on: AppPage, row: number, col: number): AppButton | undefined =>
  inColumn(col) ? sharedAt(board(), row) : buttonAt(on, row, col);

/** How this Sammlung wears a word class. Absent counts as "fill", which is
 *  what every layout written before the field existed was drawn as - so an old
 *  Sammlung opens looking exactly as it did. See AppLayout.wordColor. */
export const wordColor = (layout: AppLayout): WordColor => layout.wordColor ?? "fill";

/* --- Drawing and writing -------------------------------------------------- */

/* The whole editor, redrawn. editor.ts owns the drawing and hands it in once
 * at load through usePaint(); everything below only asks for it. A slot rather
 * than an import, because editor.ts imports every module that would import it
 * back, and a cycle that happens to work is a cycle nobody can reason about. */
let paint: () => void = () => {
  throw new Error("the tablet editor has not been wired");
};

/** Called once, by editor.ts, when the module that draws is loaded. */
export function usePaint(fn: () => void): void {
  paint = fn;
}

/** Draw what state.layout says. */
export function render(): void {
  paint();
}

/**
 * Redrawn now, written after: for the changes that move structure - a page
 * added, a button placed, an act changed. Typing goes through saveSoon().
 *
 * **The order is the point, and it was the other way round first.** `await
 * save(); render();` puts an IndexedDB round trip between a press and the page
 * reflecting it, and for most of these that is merely slow. For one of them it
 * loses what somebody typed: pressing an empty cell makes a button and moves
 * the panel to it, so during that gap the panel on screen still belongs to the
 * *previous* button, with its label field focused - and anything typed into it
 * goes to the wrong button. It is a small window and it is exactly as long as
 * a database write, which is to say long enough that a test driving the page
 * hit it every time.
 *
 * Nothing is risked by drawing first. save() does not touch state.layout - it
 * writes what is there and compares what comes back - and the writes are
 * serialised in a chain inside it, so an unawaited call cannot overtake an
 * earlier one.
 */
export function commit(): void {
  render();
  /* The sidebar row for this Sammlung counts its buttons and names its grid,
   * both off the layout this has just changed - so a button placed leaves the
   * row at its old number, and a resize leaves it naming the old size while
   * the panel that did the resizing names the new one an inch away. Cheap by
   * construction: the open row is the one row paintOpenCollection() need not
   * go to the store for. See there for why it is not hung off the save. */
  paintOpenCollection();
  void save();
}

/** Somebody chose a page - from the sidebar list, from an unfolded fact, or by
 *  following a button's corner. The one way in, so that the list and the board
 *  cannot disagree about where they are. */
export function goToPage(id: string): void {
  if (!pageById(board(), id)) return;
  const fromList = document.activeElement instanceof HTMLElement
    && document.activeElement.classList.contains("pagelist__item");
  at.here = id;
  at.unfolded = null;
  at.wantFocus = fromList;
  render();
}
