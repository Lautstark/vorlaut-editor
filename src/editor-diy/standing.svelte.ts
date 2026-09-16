// Where the five-key editor is standing, and the few answers every part of it
// asks for.
//
// editor.ts was one file of twelve hundred lines and the state at the top of it
// - which page, which key is being dragged - was read and written from every
// section below. The sections are their own components now (Board with Tabs,
// Device and Key under it; the two sheets beside them) and this is the one thing
// they share: the standing state, the layout as the shape this editor is for,
// the page on screen, and the two ways a change reaches the page - commit() for
// structure, render() for a redraw.
//
// The same arrangement editor-app arrived at one directory along, and it is the
// same arrangement for the same reason: an editor's parts must not import the
// module that draws them, because that module imports every one of them.
// editor-app solved it with a slot handed in at load; there is nothing to hand
// in here, because what redraws a component is the layout it reads. adr/0025.
import { isDiy, PAGE_KEY } from "../core/types.js";
import type { BoardSet, DiyLayout, SlotAct } from "../core/types.js";

import { save } from "../core/save.js";
import { paintOpenCollection } from "../shell/collections.js";
/* `t` from the runes wrapper rather than from core/texts.ts: setName() below is
 * the word on a tab and on a key, and both have to move when the page changes
 * language. See the head of shell/live.svelte.ts. */
import { layout as live, t, touched } from "../shell/live.svelte.js";

/* Which set is being edited. It was `state.current` while the page held one
 * board and every module that touched a set index was allowed to know about it.
 * Now it is an index into whichever board is open, so it belongs to the thing
 * that draws the sets, and it is reset by adopt() rather than clamped by the
 * save loop. */
let current = $state(0);

export const at = (): number => current;
export const goToSet = (index: number): void => { current = index; };

/** The key being dragged, by slot. Null when nothing is.
 *
 * A rune where it was a `let` and a sweep of `.dragover` off the document: one
 * cell is marked at a time by construction now, which is what that sweep was
 * for. */
let dragSlot = $state<number | null>(null);
let over = $state<number | null>(null);

export const dragged = (): number | null => dragSlot;
export const hovering = (index: number): boolean => over === index;
export const startDrag = (index: number): void => { dragSlot = index; };
export const endDrag = (): void => { dragSlot = null; over = null; };
export const hover = (index: number): void => { over = index; };
export const unhover = (index: number): void => { if (over === index) over = null; };

/* state.layout, as the shape this editor is the editor for.
 *
 * The shell holds one layout and it may be either kind - core/types.ts's union
 * - and this file may only ever be looking at the DIY half, because the
 * composition root installs it for a DIY Sammlung and for nothing else. So this
 * is that guarantee written down once instead of a cast at each of the forty
 * places that used to need one.
 *
 * Read through shell/live.svelte.ts rather than straight off core/state.ts, and
 * that is the whole of what makes this editor's components redraw. The object is
 * the same object - live.svelte.ts holds it rather than copying it - so every
 * write is still a write into the layout the save loop hands to IndexedDB.
 *
 * It throws for the reason byId() used to: reaching here with a tablet Sammlung
 * on screen is not a case to handle, it is a composition root that has installed
 * the wrong editor, and the complaint should say so once. */
export function board(): DiyLayout {
  const held = live();
  if (!isDiy(held)) throw new Error("the five-key editor was given a tablet Sammlung");
  return held;
}

/** The set on screen. */
export function set(): BoardSet {
  return board().sets[current]!;
}

/** Draw what the layout says. One line: every part of this editor is a
 *  component reading it, and this is the note that it moved. */
export function render(): void {
  touched();
}

/**
 * Redrawn now, written after - the same order and the same reason as
 * editor-app's commit(), which is where the argument is written out: an
 * IndexedDB round trip between a press and the page reflecting it is merely slow
 * for most of these, and for a sheet that has just written a key it is long
 * enough for a test driving the page to see the old board.
 *
 * Nothing is risked by drawing first. save() does not touch state.layout, and
 * the writes are serialised in a chain inside it.
 */
export function commit(): void {
  render();
  /* The sidebar row for this Sammlung counts its sets, off the layout this has
   * just changed - so adding or removing one leaves the row at its old number
   * until something redraws it. Cheap by construction: the open row is the one
   * row paintOpenCollection() need not go to the store for. */
  paintOpenCollection();
  void save();
}

/* --- The board ------------------------------------------------------------
 *
 * The six cells in reading order: `null` is the hole where the speaker sits,
 * and a number is that one of the five keys.
 *
 *     .        slot 0   slot 1
 *     slot 2   slot 3   slot 4
 *
 * The one place this arrangement is written down in this editor, so that the
 * grid, the drop targets and where Alt+Arrow may go cannot drift apart. It is
 * BoardSet.slots' own order and the table data/obf.ts's grid() exports; the
 * three agreeing is what makes a document round trip go through the cells rather
 * than through a rule about which key leads anywhere.
 */
export const CELLS: (null | number)[] = [null, 0, 1, 2, 3, 4];

/** Which cell in the grid holds a key. */
export const cellOf = (slot: number): number => CELLS.indexOf(slot);

/** Where a key sits, as a row and a column of the 2x3. */
export const seatOf = (slot: number): readonly [number, number] => {
  const cell = cellOf(slot);
  return [Math.floor(cell / 3), cell % 3] as const;
};

/** Which key sits at a row and a column, or -1 for the speaker's corner and
 *  for anywhere off the board. */
export const keyAt = (row: number, column: number): number => {
  if (row < 0 || row > 1 || column < 0 || column > 2) return -1;
  const place = CELLS[(row * 3) + column];
  return typeof place === "number" ? place : -1;
};

/** The three answers a key's sheet offers, in the words on its list: **Wort**,
 *  **Wort & weiter**, **weiter**. Two members of SlotAct and the modifier on
 *  one of them, which is where the union puts them and why - see there. */
export type Does = "word" | "carry" | "goto";

/** Which of the three an act reads as. Total, unlike editor-app's, because
 *  every act this device can hold is one of the three: there is no bar control
 *  a key could have been given before the list stopped offering it.
 *
 *  Three on all five keys. There was a fourth, **Reihum**, on the set key alone
 *  - go to the next page, for ever, in whatever order the pages sat in - and it
 *  went with the ring itself: what it meant is a target now, which is what
 *  *Weiter* already said. data/upgrade.ts is where every stored Reihum became
 *  one. */
export const chosenAs = (act: SlotAct): Does =>
  act.kind === "speak" ? "word" : act.alsoSpeak ? "carry" : "goto";

/** An id for a set, minted when a key first names one. crypto.randomUUID() for
 *  store.ts's reason at its own: two of them made in two tabs must not collide,
 *  and nothing about a set - not its name, which may be empty on every one of
 *  them at once - is unique enough to derive one from. */
export const mint = (): string => crypto.randomUUID();

/** What a page is called in a list, which is its name until somebody gives it
 *  one. The tab, the page-key panel and the delete question all say this; so do
 *  the target list and the corner that follows it. */
export const setName = (entry: BoardSet, index: number): string =>
  entry.name || t("ui.set_n", { n: index + 1 });

/** What the page-key seat prints where the key has no word of its own: the
 *  page's name, because that is what the firmware prints there - core/types.ts's
 *  PAGE_KEY, and ADR 0024 §1 for why that is a fact about a seat rather than a
 *  role. */
export const printsName = (index: number): boolean => index === PAGE_KEY;

/* The grid itself, handed over by the component that draws it. The one element
 * this editor still holds a reference to, and it is held for one line: focus has
 * to follow a key across a swap, and the cell it lands in is a sibling rather
 * than anything either key can reach. */
let device: HTMLElement | null = null;
export function useDevice(node: HTMLElement): void { device = node; }

/** Where a swap of two keys lands, whether dropped or made with Alt+Arrow.
 *  Focus follows the key rather than staying at the cell, which is what makes a
 *  run of presses carry one key across the board. */
export function swapSlots(a: number, b: number): void {
  const slots = set().slots;
  [slots[a], slots[b]] = [slots[b]!, slots[a]!];
  commit();
  (device?.children[cellOf(b)]
    ?.querySelector(".cell__open") as HTMLElement | null)?.focus();
}
