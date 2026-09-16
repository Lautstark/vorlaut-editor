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
// **usePaint() is gone, and it is the thing this conversion removed.** The
// parts could not import editor.ts, because editor.ts imports every one of
// them and a cycle that happens to work is a cycle nobody can reason about - so
// the drawing was handed in through a slot at load and `render()` called it.
// What that slot was standing in for is a subscription, and the components have
// one: everything that draws reads shell/live.svelte.ts's layout(), and
// render() below is the note that the layout moved. There is nothing left to
// hand in, nothing to be wired before, and no way for a part to be drawn by the
// wrong editor. adr/0025.
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
import { isApp } from "../core/types.js";
import type { AppButton, AppLayout, AppPage, WordColor } from "../core/types.js";
import { LANG } from "../core/boot.js";

import { save } from "../core/save.js";
import { paintOpenCollection } from "../shell/collections.js";
/* `t` from the runes wrapper rather than from core/texts.ts, because pageName()
 * below is drawn: it is the word on a row in the sidebar and on a link over the
 * board, and both have to move when the page changes language. See the head of
 * shell/live.svelte.ts. */
import { layout as live, t, touched } from "../shell/live.svelte.js";
import { buttonAt, pageById, shared, sharedAt } from "./pages.js";

/** The editor's standing state. One object rather than three exported `let`s,
 *  for the reason core/state.ts gives: an importer of `export let` gets a live
 *  view and cannot assign to it. */
export const at = $state({
  /** Which page is being edited, by id. An id rather than an index because
   *  deleting a page shifts every index after it and would silently move where
   *  somebody is standing. */
  here: "",
  /** Which fact over the board is open, or none. Module state rather than the
   *  DOM's, because every render throws the line away and rebuilds it. */
  unfolded: null as string | null,
  /** Set where a redraw should put the keyboard back into the page list. */
  wantFocus: false,
  /** Set where the page's name over the board should take the keyboard: a page
   *  made from the list was made in order to be filled in, so the field is the
   *  next thing under the hand. A flag rather than a call, because the field is
   *  PageHead.svelte's element and the press is PageList.svelte's - and the
   *  shell used to be asked for it by id, which is exactly what went. */
  wantName: false,
});

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
  /* Through shell/live.svelte.ts rather than straight off core/state.ts, and
     that is the whole of what makes this editor's components redraw. The object
     is the same object - live.svelte.ts holds it rather than copying it, for
     the reason its header gives at length - so every write below is still a
     write into the layout the save loop hands to IndexedDB. */
  const held = live();
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
 *  has named it - the same fallback the delete question uses.
 *
 * **The position is worked out before the name is looked at**, which reads like
 * waste and is what makes a rename show up. A component redraws when something
 * it read has moved, and what this reads is the layout: a named page that
 * short-circuited on `one.name` never touched it, so the one expression on
 * screen that had to notice a rename was the one expression that was not
 * watching. See the head of shell/live.svelte.ts, and e2e/editor_app.spec.ts's
 * "a page is renamed by typing over it". */
export const pageName = (one: AppPage): string => {
  const at = board().pages.indexOf(one) + 1;
  return one.name || t("ui.app_page_n", { n: at });
};

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

/** Draw what the layout says.
 *
 * One line, where it was a slot and a thrown error. Every part of this editor
 * that draws is a component reading layout() out of shell/live.svelte.ts, and
 * this is what says that answer has moved - a mutation in place is invisible
 * otherwise, which is what the counter in that module is for.
 *
 * Still called `render`, and still the name core/editor.ts's Editor port uses:
 * what the shell is asking for has not changed. */
export function render(): void {
  touched();
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
