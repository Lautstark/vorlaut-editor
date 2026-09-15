/* The Sammlungen: the list down the side, the name in the work head, and the
 * four things somebody can do to the list.
 *
 * A Sammlung is a whole layout - one per child, one per room, one to try
 * something out in - and the sets inside it are the talker's five keys. Those
 * are two different levels, and the word "board" is not either of them any
 * more: it means one page of an Open Board Format document, which is what
 * exchange/SPEC.md has always used it for. `Collection` in the code and
 * *Sammlung* on screen is the family's convention, settled in design.md §3.6.
 *
 * Nothing here knows what a set is. How many things are inside one is asked of
 * the editor (core/editor.ts), because that is the device's answer.
 *
 * Where each control lives is conventions.md §1 and §3, and is worth restating
 * because the arrangement looks arbitrary until you try the other one:
 *
 *   the list, and "+ Neue Sammlung"   in the sidebar - this is their level
 *   the name                          in the work head, as the field that renames
 *   the exports, the settings, delete in the work head's ⋯
 *
 * The last line is the one worth defending. All of them are about exactly the
 * Sammlung that is open, and a button sitting in a list of five can never say
 * which one it means - so they live beside the name of the one they act on.
 * Renaming has no menu entry at all: the name on screen is the field.
 *
 * §3.6 says the ⋯ holds what *acts* on a Sammlung, and the word "acts" is now
 * too narrow for what is in here. The tablet's grid card stretched it first
 * and nobody noticed; the Sammlung's own settings sheet is the second, and it
 * is deliberate rather than accidental. The sentence §3.6 needs is that the ⋯
 * holds what is true of one Sammlung - what acts on it, and what it is set to
 * - because both answer the question a menu in a list of five cannot: which
 * one. docs/sammlung-settings.md carries the wording; ~/Code/design is its own
 * session and this file may not edit it.
 *
 * What is here is the list, the name field, opening and deleting one, and the
 * wiring. The four things have their own modules beside this one where they
 * are more than a few lines: collectionNew.ts makes one, collectionExport.ts
 * writes one out, sidebar.ts is the column and the drawer, gridSizes.ts is
 * the control both the new-Sammlung sheet and the tablet's grid panel draw,
 * and openCollection.ts is what all of them share.
 */
import { byId, status } from "./dom.js";
import { menuOn, type AddItem } from "@lautstark/design/menu";
import { confirmDialog } from "./dialog.js";
import { renameField, type RenameField } from "@lautstark/design/rename";
import { drawCollections } from "@lautstark/design/collections";
import { reason } from "../core/errors.js";
import {
  createCollection, deleteCollection, layoutOf, listCollections,
  renameCollection, useCollection,
} from "../backend/index.js";
import { editorFor, editorOf, FIRST_TARGET } from "../core/editor.js";
import { openCollectionSettings } from "./voices.js";
import { state } from "../core/state.js";
import { load, saveNow } from "../core/save.js";
import { t } from "../core/texts.js";
import { isApp } from "../core/types.js";
import type { Layout } from "../core/types.js";
import { chooseExport } from "./collectionExport.js";
import { create } from "./collectionNew.js";
import { defaultName, held, nameOf, usePaint } from "./openCollection.js";
import { closeOnPick, wireSidebar } from "./sidebar.js";

/** The bound name field, once wireCollections() has bound it. Held because
 *  paintCollections() may only reach the input through it - see there. */
let name: RenameField | null = null;

/* --- Drawing ---------------------------------------------------------------- */

/** The second line under a name in the sidebar: which device this Sammlung is
 * built for, and - on a tablet - how big its pages are.
 *
 * The one fact the row was missing. A count means *sets* on the talker and
 * *buttons* on a tablet, so 5 and 78 sat in one column of tabular figures as
 * if they were comparable, and two Sammlungen for two different devices were
 * indistinguishable until one was opened.
 *
 * The package draws this line and does not compose it (its `subtitle` field
 * says why): it holds no vocabulary, so the words are here, in TEXTS, beside
 * the rest of vorlaut's German and English. The grid rides in the same string
 * rather than in a column of its own - ~/Code/design's
 * docs/mocks/vorlaut-sammlung-zeile.html measured six answers to this, and a
 * second column cost a third of the name on exactly the names §1.5 mints
 * unaided.
 *
 * isApp rather than a bare target check, for the reason types.ts gives: "diy"
 * is written on nothing saved before there were two editors. */
function rowSubtitle(layout: Layout): string {
  return isApp(layout)
    ? t("ui.collection_row_app",
        { rows: layout.grid.rows, columns: layout.grid.columns })
    : t("ui.collection_row_diy");
}

/** What each row's second line and count last worked out to, by Sammlung.
 *
 * Held rather than local to the paint, because of which row can change while
 * somebody is working: only the open one. Every other row is a layout nobody
 * on this page can touch, so what was read of it at the last full paint is
 * still true - which is what lets paintOpenCollection() below redraw the list
 * without going back to the store for any of them.
 *
 * Emptied by every full paint rather than updated in place, so that a deleted
 * Sammlung cannot leave a number behind for an id that is coming round again.
 */
const counts = new Map<string, number>();
const subtitles = new Map<string, string>();

/** The open Sammlung's row, from what is on screen rather than from the store.
 *
 * The store is up to a second behind it - the save is debounced - and a count
 * that lags the thing it is beside reads as a bug. */
function readOpen(): void {
  const current = held.list.current;
  if (!current) return;
  counts.set(current, rowCount(state.layout));
  subtitles.set(current, rowSubtitle(state.layout));
}

/**
 * The number on a row in the sidebar.
 *
 * **Not the same number the delete question asks with, and that is deliberate.**
 * The Editor port's count() answers "how much work is in here", which is
 * buttons on a tablet and sets on a talker - conventions.md §1.8, and the
 * argument for it is in editor-app's count(): sixty-three buttons is the
 * sentence that could change somebody's mind about deleting. That stays exactly
 * as it is, question and all.
 *
 * What sits in the sidebar is now a different question, because a different
 * thing sits under it: the Sammlung's pages, listed. A row reading "63" over a
 * list of four is two units in one column, and the one the eye needs is the one
 * it can count. So a tablet row says pages.
 *
 * The talker is untouched, here as everywhere in this change: it has no page
 * list under its row and keeps counting sets. Two rows can therefore show
 * numbers that look alike and count different things, which is the price and is
 * a decision rather than an oversight.
 */
function rowCount(layout: Layout): number {
  return isApp(layout) ? layout.pages.length : editorOf(layout).count(layout);
}

/** The sidebar and the work head, from whatever the store last said. */
export async function paintCollections(): Promise<void> {
  held.list = await listCollections();
  const { collections, current } = held.list;

  /* How much is in each one, and which device it is for - the second line
   * costing no read that was not already happening. The open one is not read
   * at all (see readOpen); the rest are, because there are a handful of them
   * and each is a small JSON, which is cheaper than keeping a denormalised
   * number in the registry and being wrong about it. */
  counts.clear();
  subtitles.clear();
  await Promise.all(collections.map(async (one) => {
    if (one.id === current) return readOpen();
    const layout = await layoutOf(one.id);
    // Each Sammlung counted by *its own* editor, not by whichever one is on
    // screen. This read `editor().count(...)` while there was one, and the
    // first tablet Sammlung in a list opened on a talker Sammlung would have
    // been counted in sets, found none, and drawn "0" beside sixty buttons.
    if (layout) {
      counts.set(one.id, rowCount(layout));
      subtitles.set(one.id, rowSubtitle(layout));
    }
  }));

  drawList();

  const at = collections.findIndex((one) => one.id === current);
  const field = byId<HTMLInputElement>("collectionName");
  // Through refresh() rather than by assigning, which is the whole reason that
  // function exists: it declines while the field is being typed in and while a
  // keystroke is still waiting out its debounce, so a repaint cannot put the
  // stored name back over what somebody has just written. Making a Sammlung is
  // the case where that is guaranteed rather than likely - the field is filled
  // the moment the row appears, and the paint that made the row is still
  // running.
  //
  // Optional only because the binding is module state: app.ts wires before it
  // paints and always has, so in practice there is always a field here.
  name?.refresh(at < 0 ? "" : collections[at]!.name);
  field.placeholder = at < 0 ? t("ui.collection_name") : t("ui.collection_unnamed");
  field.disabled = at < 0;
}

// The modules that make, open and delete a Sammlung ask for this paint
// through openCollection.ts, and this is the paint they get.
usePaint(paintCollections);

/** The open Sammlung's row, brought back into line with what is on screen.
 *
 * An editor's commit() is the caller - both of them - because that is what a
 * structural change *is* on this page: the layout in memory has moved, and
 * everything drawn from it has to move with it. The sidebar row was the one
 * thing that did not, so placing a button left the row's count at its old
 * number and resizing a tablet's grid left the row naming the old size while
 * the panel that had just changed it named the new one, an inch away.
 *
 * Not in save(), which was the other obvious home for it. The row goes stale
 * the moment state.layout changes, not when it reaches the disk: hanging the
 * repaint off the write would make the row lag by the save's debounce for
 * everything that goes through saveSoon(), and would leave it *wrong* rather
 * than merely late whenever a write comes back conflicted - the screen would
 * have the change and the row beside it would not. A notification out of the
 * save loop is the same timing wearing the onBuildState() shape, and it buys a
 * decoupling that is not needed here: an editor may import the shell, and only
 * the other direction is forbidden (tests/unit/layers.test.ts).
 *
 * Not debounced either, and that is what this function is for. What made a
 * repaint too expensive to do on every change was reading every other
 * Sammlung's layout out of the store - and the open row is the one row that
 * needs no read, because it is drawn from state.layout. So the maps above are
 * kept, the open entry is recomputed, and what is left is rebuilding a handful
 * of rows: a fraction of the render() that commit() has just done anyway.
 */
export function paintOpenCollection(): void {
  if (!held.list.current) return;
  readOpen();
  drawList();
}

/** The rows, from the two maps above.
 *
 * The rows themselves are @lautstark/design/collections'. What is left here
 * is what a row means in this product: the fallback name for an unnamed
 * Sammlung, the count - the one fact that tells two similarly named ones
 * apart, and the number the delete question will count with, which is why it
 * is on screen before that question rather than appearing for the first time
 * when something is about to go - and what pressing one does.
 *
 * `open` is a set of one, because a Sammlung here is a whole layout and so
 * cannot be in two (§4.1). The additive flag the package reports is ignored
 * for the same reason: there is no second thing to add.
 */
function drawList(): void {
  const { collections, current } = held.list;
  const list = byId("collectionList");
  list.setAttribute("aria-label", t("ui.collections"));
  drawCollections(list, {
    rows: collections.map((one) => ({
      id: one.id, name: nameOf(one.name), count: counts.get(one.id),
      subtitle: subtitles.get(one.id),
    })),
    open: current ? [current] : [],
    onPick: (id) => { closeOnPick(); void open(id); },
  });

  if (!pages || !current) return;
  const row = list.querySelector(".collections__item--active");
  if (!row) return;
  const into = document.createElement("div");
  into.className = "pagelist";
  into.id = "collectionPages";
  row.after(into);
  pages(into);
}

/** There is always one, and it has a name.
 *
 * The store will seed a layout for a browser that has none - that is its
 * guarantee and it stays - but it has no language to name one with, so what it
 * seeds arrives blank. This gets in first, on the one visit where it matters,
 * so that "unnamed" is a state only the Sammlung carried across from the
 * single-layout database is ever in. conventions.md §1.5 and §1.9.
 */
export async function ensureCollection(): Promise<void> {
  const list = await listCollections();
  if (list.collections.length) return;
  // Unnamed on purpose: the language is not settled until load() has read the
  // layout this creates. nameIfUnnamed() below is what names it, afterwards.
  // The talker's, because this is the seed a browser with nothing in it gets
  // and there is nobody to ask yet - the target dialog belongs to a press on
  // "+ Neue Sammlung", and this runs before the page has drawn.
  await createCollection("", editorFor(FIRST_TARGET).blank());
}

/** Gives the open Sammlung a name if it has none, in the language the page has
 *  settled on.
 *
 * Two arrive without one and both are named here rather than where they are
 * made: the seed above, because the language it will put the page into is
 * inside the layout it is seeding, and the Sammlung carried across from the
 * single-layout database, which never had a name at all. Naming either one
 * earlier means naming it in whatever language the browser guessed. */
export async function nameIfUnnamed(): Promise<void> {
  const list = await listCollections();
  const open = list.collections.find((one) => one.id === list.current);
  if (!open || open.name.trim()) return;
  await renameCollection(open.id, defaultName());
}

/* --- Opening one, and deleting one ------------------------------------------- */

/** Put a different Sammlung on screen.
 *
 * Anything typed in the last second is written first. The save is debounced, so
 * switching straight after a keystroke would otherwise fire the pending write
 * *after* load() had replaced state.layout - and it would write the old text
 * into the new Sammlung, under the new one's version.
 */
async function open(id: string): Promise<void> {
  if (id === held.list.current) return;
  await saveNow();
  await useCollection(id);
  // load() re-reads the layout, adopts its own language, resets the version
  // this page holds and tells the editor to let go of where it was - which now
  // includes installing a different editor when the two Sammlungen are for
  // different things.
  await load();
  await paintCollections();
}

/** Gone, once somebody has said so to a question that named what goes.
 *
 * The count is in the question because a Sammlung is a folder somebody cannot
 * see into from the sidebar - the row shows a name and a number, and the
 * number is the thing that could change their mind. Closing the dialog any
 * other way deletes nothing.
 */
async function remove(): Promise<void> {
  const { collections, current: id } = held.list;
  if (!id) return;
  const at = collections.findIndex((one) => one.id === id);
  const name = nameOf(collections[at]!.name);
  const which = editorOf(state.layout);
  const n = which.count(state.layout);
  // What is being counted is the editor's answer - sets on the device, buttons
  // on a tablet - so the *word* is too. A shared sentence with a {unit} hole
  // would not survive German: the two nouns take different articles, so the
  // singular sentence differs in a word no plural rule reaches.
  //
  // One is the common case and "1 Set(s)" is not a sentence anybody wrote. Two
  // keys rather than a plural rule: this page has two languages and both want
  // a different word here, and a rule covering German and English would still
  // be wrong for the third.
  const one = n === 1 ? "_one" : "";
  if (!await confirmDialog({
    title: t("ui.collection_delete"),
    body: t(`ui.collection_delete_ask_${which.unit}${one}`, { name, n }),
    confirmLabel: t(`ui.collection_delete_go_${which.unit}${one}`, { n }),
    // Never the same word as the button beside it: two dismissals sharing an
    // accessible name is ambiguous to anyone navigating by it.
    danger: true,
  })) return;

  await deleteCollection(id);
  // Whatever the store made current, or a fresh one where it made nothing:
  // load() seeds one when the list has been emptied, which is what a first
  // visit gets and is a better answer than a page with nothing on it.
  await load();
  await paintCollections();
}

/* --- Wiring ------------------------------------------------------------------ */

/** Entries the editor on screen adds to the menu beside the Sammlung's name.
 *
 * The menu is the shell's - it acts on the Sammlung, which is the shell's
 * level - but not everything that acts on one is: writing a talker's build
 * into a folder is editor-diy's, and the shell may not import an editor
 * (tests/unit/layers.test.ts), so the editor hands its entries in instead.
 *
 * This carried the tablet's grid card as well until the grid became a panel in
 * the Sammlung's own sheet - which is the same hand-over one floor along, and
 * voices.ts's collectionSheetPanel() is where it is now. What is left here is
 * an act rather than a setting, which is what this menu is for.
 *
 * Registered by an editor's wire() and taken back by the teardown it answers
 * with, for the reason EditorHalf.wire() gives: the shell outlives every
 * editor, so anything left behind here would draw a tablet's entry over a
 * talker Sammlung and reach for elements that are no longer in the page.
 */
let extras: ((add: AddItem) => void) | null = null;

export function collectionMenuExtras(build: ((add: AddItem) => void) | null): void {
  extras = build;
}

/**
 * The list of pages an editor draws under the open Sammlung's row.
 *
 * The same hand-over as collectionMenuExtras above and collectionSheetPanel one
 * floor along, and for the same reason: the sidebar is the shell's, an editor
 * may import the shell and not the other way round, and what belongs in the
 * list is entirely the editor's business - the talker passes nothing and gets
 * no list at all.
 *
 * **Under the open row and nowhere else.** The list is sorted by what was
 * edited last, so the open Sammlung is not always first; the container is
 * inserted after whichever row is marked open, which is also what makes it
 * disappear when a different one is opened without anything having to remove
 * it.
 */
let pages: ((into: HTMLElement) => void) | null = null;

export function collectionPages(draw: ((into: HTMLElement) => void) | null): void {
  pages = draw;
  if (held.list.current) drawList();
}

/**
 * Redraw only the pages, leaving the rows above and below them alone.
 *
 * Called on every render of the tablet editor - which page is open, what each
 * one is called and what each one costs all live here - so it may not go back
 * to the store or repaint the whole list. Where the container is not in the
 * page yet, the next drawList() puts it there.
 */
export function paintPages(): void {
  const into = document.getElementById("collectionPages");
  if (!into || !pages) return;
  into.replaceChildren();
  pages(into);
}

export function wireCollections(): void {
  byId<HTMLButtonElement>("collectionNew").onclick = () => { void create(); closeOnPick(); };
  wireSidebar();

  // The debounce, the write on the way out, and the rule that a repaint never
  // types over you are all @lautstark/design/rename's now. What is left here is
  // the half that is this product's: trimming, which Sammlung is being renamed,
  // and what to say when the write fails.
  name = renameField(byId<HTMLInputElement>("collectionName"), async (typed) => {
    const current = held.list.current;
    if (!current) return;
    try {
      await renameCollection(current, typed.trim());
      await paintCollections();
    } catch (error) {
      status(t("ui.save_failed", { error: reason(error) }));
    }
  });

  byId<HTMLButtonElement>("collectionMenu").onclick = (event) => {
    event.stopPropagation();
    menuOn(byId("collectionMenu"), (add) => {
      /* One export, whatever kind of Sammlung this is.
       *
       * This was three entries until adr/0011's last open point was done -
       * one per file - and they read as three acts when they are three shapes
       * of one. What a person has is a Sammlung and something to put it on, so
       * the menu says the act and chooseExport() leads with the one this
       * Sammlung is for. The three writers behind it are untouched and stay
       * untouched: exchange/SPEC.md §5.2 is a licence rather than a
       * preference, and adr/0010 says what merging them would cost.
       *
       * **On a tablet Sammlung too, and that entry moved here to say so.** It
       * used to come up a few lines down through extras?.(), added by
       * editor-app under this very label, because the sheet behind this entry
       * was a question a tablet Sammlung had no business being asked - it can
       * only be written one way. That is still true and is now said in one
       * place: exportsFor() holds which doors each target has, chooseExport()
       * does not ask where there is nothing to ask, and a tablet Sammlung goes
       * from this entry straight into its package the way it always did. Two
       * doors to one act was two things to keep in step for no gain, which is
       * the same argument that took the gear out of the page header.
       *
       * What a tablet Sammlung must still not be offered is unchanged, and
       * exportsFor() is where it is argued: the talker's export refuses it and
       * the document export writes an empty file, so neither is a card. */
      add(t("ui.collection_export"), () => { chooseExport(); });
      /* Whatever act the editor on screen has to add, which is none either way
       * as things stand.
       *
       * A talker used to add the build written into a folder; that went with
       * the build (adr/0011). A tablet used to add the package export; that is
       * the entry above now, for the reason it gives. The hook stays because
       * the shell outliving every editor is the thing it is for - the same
       * bargain collectionPages() and collectionSheetPanel() make, and both of
       * those still have a caller.
       *
       * The grid used to be here too and was the one entry in this menu that
       * was a setting rather than an act. It is in the settings sheet now,
       * behind the same ⋯, which is what the entry below opens. */
      extras?.(add);
      /* Then what this Sammlung is set to, rather than what can be done with
       * it: the voice it speaks in, the grid a tablet's pages are on, and - on
       * a talker - the language the device shows its own menu in. All of them
       * are layout.json fields and all travel in an export. The first two were
       * in the settings sheet at the foot of the sidebar until it turned out
       * that a panel whose answer changes when you click a different row in
       * the list is not a setting of the app; the grid came the other way,
       * from an entry of its own directly above this one, because two doors to
       * "what is this Sammlung set to" is one too many.
       *
       * Below the acts and above the delete. The delete stays last wherever it
       * appears; everything else in this menu reads as "with this Sammlung, do
       * X" and this one reads as "about this Sammlung", which is the weaker
       * claim and so goes second. */
      add(t("ui.collection_settings"), () => { void openCollectionSettings(); });
      add(t("ui.collection_delete"), () => { void remove(); }, { danger: true });
    });
  };
}
