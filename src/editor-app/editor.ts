// The tablet editor: the page strip, the grid, and the two sheets a press
// opens - one for a button, one for a page.
//
// This is the second device-specific half. Pages of a grid, a sentence bar
// composed by pressing buttons, a colour per word class: none of that is true
// of the five-key talker and all of it is true of a MetaTalk-style board,
// which is why it sits under editor-app/ and why nothing in the shell may
// import it. The shell reaches it through core/editor.ts, and `app` at the
// foot of this file is what it reaches.
//
// What is here is the editor's face to the shell - render(), wireEditor(),
// the `app` object - and the key a new Sammlung starts with. The parts are
// their own modules beside this one, cut along the sections this file used
// to have: standing.ts (where the editor stands, and the two ways a change
// reaches the page), pageHead.ts (the name and the facts line over the board,
// and the page's delete question), grid.ts (the cells), buttonSheet.ts (one
// button, edited as a draft), panels.ts (the two panels in the Sammlung's
// sheet) and pageList.ts (the pages down the sidebar).
//
// The graph itself is in pages.ts, deliberately without a document anywhere
// near it: what happens to the buttons that pointed at a deleted page is the
// part of this that is expensive to get wrong, so it is the part that can be
// tested without a browser.
import { byId, status } from "../shell/dom.js";
import { state } from "../core/state.js";
import type { Editor } from "../core/editor.js";
import { isApp } from "../core/types.js";
import type { AppButton, GridSize, Layout } from "../core/types.js";
import { GRID, LANG } from "../core/boot.js";
import { saveSoon } from "../core/save.js";
import { collectionPages, paintPages } from "../shell/collections.js";
/* Which house a start key opens with, and which collection it comes out of.
 * The shell's, not this file's: exchange/SPEC.md §5.1 allows one symbol source
 * per package, so "the prescribed picture" is a different answer per
 * collection, and which collection is in force is something a browser knows
 * and an editor does not. */
import { homeSymbol, homeSymbolSource, homeWord } from "../shell/homekey.js";
import { collectionSheetPanel } from "../shell/voices.js";
import { blankButton, blankPage, pageById, reachable } from "./pages.js";
import { at, board, commit, page, usePaint } from "./standing.js";
import { askDelete, drawFacts, drawPageHead } from "./pageHead.js";
import { drawGrid } from "./grid.js";
import { accessPanel, gridPanel } from "./panels.js";
import { drawPageList } from "./pageList.js";

/* --- Drawing, and the two controls that are not in a sheet ---------------- */

export function render(): void {
  const layout = board();
  if (!pageById(layout, at.here)) at.here = layout.pages[0]!.id;
  const found = reachable(layout);
  drawPageHead(found);
  drawFacts(found);
  drawGrid();
  /* The list in the sidebar carries which page is open and what each costs,
   * and both change here. It belongs to the shell, so it is asked to repaint
   * rather than reached into - the layers test forbids the other direction. */
  paintPages();
}

// The parts ask standing.ts to redraw, and this is the drawing they get. Once,
// at load, before anything is wired.
usePaint(render);

export function wireEditor(): () => void {
  /* The page's name is the field that renames it, the way the Sammlung's is
   * one floor up. Typed straight into the page, saved on the debounce that
   * every other field here uses - no sheet, no Fertig, nothing to dismiss. */
  const named = byId<HTMLInputElement>("appPageName");
  named.oninput = () => {
    page().name = named.value;
    /* The sidebar row for this page carries the same name, so it is repainted
     * with every keystroke - a handful of rows, and the alternative is a list
     * that disagrees with the field above it until something else happens. */
    paintPages();
    saveSoon();
  };

  byId<HTMLButtonElement>("appPageStart").onclick = () => {
    board().home = page().id;
    commit();
  };

  byId<HTMLButtonElement>("appPageDelete").onclick = () => {
    void askDelete(page());
  };

  /* The list of pages under the open Sammlung in the sidebar. Handed over
   * rather than drawn here for the reason the grid panel is: the sidebar is
   * the shell's, an editor may import the shell and not the other way round
   * (tests/unit/layers.test.ts), and a talker Sammlung must not be given a
   * list of pages when this editor leaves the page. */
  collectionPages(drawPageList);

  /* The package used to be added here, as an entry in the ⋯ beside the
   * Sammlung's name - before that it was a filled button in the work head, and
   * templates/board.ts has why that symmetry was given up.
   *
   * It is the shell's own export entry now, under the same label and out of
   * the same key it always used. What this editor was adding was never a
   * second act, only the same one reached from the other side of the seam:
   * the shell's entry opened a sheet asking what the file was for, and a
   * tablet Sammlung has one honest answer, so it was given the door directly
   * instead. That sheet leads with the Sammlung's own target now and asks
   * nothing where there is nothing to ask - collections.ts's exportsFor() is
   * where which doors a target has is decided - so the entry is one entry
   * again and this editor has nothing to add to that menu.
   *
   * Nothing crossed the seam to make that true. The shell already knew the
   * Target, which is what core/editor.ts's registry is keyed by, and
   * tests/unit/layers.test.ts still holds the arrow pointing one way. */

  /* The grid and the press timings are panels in the sheet behind that same ⋯,
   * and unchanged by any of this. Taken back with the rest when this editor
   * leaves the page: the shell outlives it, and a talker Sammlung must not be
   * offered a grid to resize - nor a hold time, which is the tablet viewer's
   * to honour and no part of the device's firmware.
   *
   * In the order they are drawn, the grid first: it is what somebody opens this
   * sheet for, and Bedienung is set once for a user and then left alone. */
  collectionSheetPanel([
    { name: "collectionEditor", build: gridPanel },
    { name: "collectionAccess", build: accessPanel },
  ]);
  return () => {
    collectionPages(null);
    collectionSheetPanel(null);
  };
}

/**
 * The key a new Sammlung starts with: bottom of the first column, and a way
 * back to the start page.
 *
 * The lower-left corner because that is where a thumb is on a tablet held in
 * two hands, and the first column because that is the column that stays put -
 * a way back that is only on the page you started from is not a way back.
 *
 * `home` rather than a `goto` at whichever page is home today, which is the
 * distinction the target list in the button sheet is made around: the two
 * behave differently the moment somebody makes another page the start page,
 * and a `goto` would stay pointing at the page that *used* to be the start.
 * On a shared button, which is on every page at once, that is the difference
 * between a board with a way home and a board with fifteen ways to one
 * particular page. It exports as §7.4's `action: ":home"`.
 *
 * No word class, and that is a value rather than an omission: the key is
 * navigation, not a word, so there is no Fitzgerald class it could be right
 * about. It carries no vocalization either - a `home` press puts nothing in
 * the bar, so there is nothing for it to have said.
 */
function homeKey(row: number): AppButton {
  const key = blankButton(row, 0);
  // Read at the moment the Sammlung is made, out of the same LANG that
  // blank() writes as the Sammlung's language, so the word on the key and the
  // language of the Sammlung it is on are the one answer.
  key.label = homeWord();
  key.symbol = homeSymbol(homeSymbolSource());
  key.act = { kind: "home" };
  return key;
}

/* What the shell is handed, and the whole of what it may ask for.
 *
 * Seven members, and each one is a question the shell has that only this
 * target can answer - see core/editor.ts. app.ts registers this object against
 * the "app" target; nothing in src/shell/ imports this file, and
 * tests/unit/layers.test.ts is what says so.
 */
export const app: Editor = {
  /* What a new tablet Sammlung starts as: one empty page, on the smallest
   * grid worth having, with the first column already the Sammlung's and a way
   * back to the start page standing in the corner of it. 3x5 rather than 6x11
   * because a first board is big cells and few of them - and because the size
   * is a number now, so growing into the larger one costs nothing.
   *
   * Every value here is a *starting* value and none of them is a constraint.
   * The colour, the shared column, the gap and the size are four presses away
   * in the panel behind the Sammlung's ⋯; the key in the corner is an ordinary
   * button and can be retyped, repointed or deleted like any other. What they
   * are is the answer somebody would otherwise have had to find before their
   * board did anything - a board with no way back from a subpage is the first
   * thing a new Sammlung gets wrong, and it gets it wrong silently.
   *
   * The colour is deliberately not "fill" here, and this is not the same
   * decision as the `?? "fill"` two readers make of a layout that has no such
   * field - see wordColor() in standing.ts and app_package.ts's. Those two are
   * about a Sammlung drawn before the field existed, which has to keep looking
   * the way it was drawn; this is about a Sammlung being drawn now, which has
   * nothing to keep. So the value is written rather than left to a fallback,
   * and neither fallback moves.
   */
  blank(grid?: GridSize): Layout {
    const first = blankPage();
    // What was chosen while it was being made, or the first of the offered
    // sizes for the callers that make one without asking - the seed a
    // browser with nothing in it gets, and an import.
    const size = grid ? { ...grid } : { rows: GRID.rows, columns: GRID.columns };
    return {
      target: "app",
      // The Sammlung's own language, started off from the language the page is
      // already in and changed in the settings sheet if that guess is wrong.
      // Read at the moment the Sammlung is made rather than captured at module
      // level: LANG is a live binding and a language switch moves it. The same
      // reasoning as editor-diy's.
      language: LANG,
      grid: size,
      pages: [first],
      // No colour by word class. A first board is a handful of keys somebody
      // is still deciding the words for, and a Fitzgerald key that nobody has
      // assigned yet paints every one of them the same - which teaches the
      // colour means nothing. It is one press in the panel once the words are
      // there and the classes are worth telling apart.
      wordColor: "off",
      /* The first column is the Sammlung's from the start, and empty but for
       * the key below.
       *
       * An array rather than an absent field, which is the whole of what
       * "shared" is - see AppLayout.firstColumn. Switching it on afterwards is
       * the one act in that panel that throws buttons away, because by then
       * every page has a first column of its own and only one of them can be
       * kept; switching it on before there is anything to lose costs nothing
       * and is what the offer would have led to anyway.
       */
      firstColumn: [homeKey(size.rows - 1)],
      // Drawn set apart, because it is: those buttons stay put while the pages
      // behind them change, and the gap is how a board says so. It promises
      // nothing untrue here - the column above really is shared.
      firstColumnGap: true,
      home: first.id,
    };
  },

  /* A different Sammlung is in force. Back to its own home page rather than
   * clamped to wherever the last one was standing rather than at whichever
   * page the Sammlung before it happened to be open at. */
  adopt(): void {
    at.here = isApp(state.layout) ? state.layout.home : "";
    render();
  },

  render,

  /* A sentence somebody actually wrote, from the page on screen, so that
   * trying a voice out is heard on the content rather than on a specimen. What
   * a button *says* rather than what it shows - that is the text the voice
   * will be used on. */
  sample(): string {
    const held = page().buttons.find(
      (one) => (one.vocalization || one.label).trim());
    return held ? (held.vocalization || held.label).trim() : "";
  },

  /* Buttons, across every page.
   *
   * Not pages, and that is the interesting half. conventions.md §1.8 gives the
   * count two jobs - telling two similarly named Sammlungen apart, and making
   * the delete question credible before it is asked - and a page count does
   * neither: it reads 3, then 4, for weeks. Buttons differ from the first
   * afternoon, and "63 Tasten" is the sentence that could change somebody's
   * mind, because sixty-three buttons is the work. Each one carries a label, a
   * symbol, a colour and a recording; four pages is filing.
   *
   * The talker counts sets instead, and that is not an inconsistency: a set is
   * a fixed four keys there, so sets and work move together. A page here holds
   * anything between nothing and sixty-six. */
  count(layout: Layout): number {
    if (!isApp(layout)) return 0;
    /* The shared first column adds its own length once, not once per page.
     *
     * That is the count's own argument turned on the one case that could
     * break it: the number is here to say how much work is in a Sammlung, and
     * a persistent column is authored once however many pages it is drawn on.
     * Counting it per page would put eight buttons of credit on a Sammlung
     * holding two, grow that inflation with every page added, and make the
     * delete question overstate what is about to go - which is the one thing
     * conventions.md §1.8 asks this number to be honest about. */
    return (layout.pages ?? []).reduce(
      (total, one) => total + (one.buttons?.length ?? 0), 0)
      + (layout.firstColumn?.length ?? 0);
  },

  unit: "button",

  /* The fixed words on the controls this editor owns, re-read on every
   * language switch like every other label. Only the ones in the markup:
   * everything the panel and the grid draw is built fresh by render(), which
   * reads the table as it goes. */
  labels(): void {
    status("");
  },
};
