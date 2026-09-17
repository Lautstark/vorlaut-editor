/* One press, one window: the sheet both editors open, and nothing about what
 * is in it.
 *
 * This is design's docs/mocks/vorlaut-editor-sheet.html at the seam that file
 * draws itself along: the picture with its search on the left, on the right
 * only what the device in question really has, deleting at the bottom left and
 * the way onward at the bottom right. The left column, the foot and the way
 * the promise settles are the same for a tablet button, a talker key, a page
 * and a set. What differs is the rows in the right column, and those are the
 * caller's - the tablet has four, the talker one, because a talker key has no
 * word class (the device draws no colour at all: the five displays carry the
 * picture and nothing round it) and no sentence bar to put anything into.
 *
 * ## Why this is in the shell and not in either editor
 *
 * It was in editor-app/editor.ts, which is where it was written. Bringing the
 * talker onto it could not be an import: tests/unit/layers.test.ts forbids one
 * editor reaching into another, deliberately, because that is the cheap
 * version of a second editor - editor-app borrowing editor-diy's thumb, and
 * thereby making one device's ideas the other's.
 *
 * So the shape shell/picker.ts already had is the shape here. It is handed a
 * title, a picture to show, a component it does not read, and three labelled
 * things to do. What a row means, what the picture goes on and what "done"
 * writes are the caller's, every one of them.
 *
 * The test for whether the seam is in the right place is whether anything
 * below would have to say the word "set", "page", "key" or "button". Nothing
 * does.
 *
 * ## The frame is the package's, and it is a Svelte component now
 *
 * This is the one sheet in the product where a frame component of *this
 * repository's own* would have been arguable - two columns, a foot with three
 * seats, a width modifier - and adr/0025 turned it down, because a frame
 * component here would mean this product drawing `.sheet > .head` itself, which
 * is the one thing the shared layer exists to stop four products doing four
 * ways. That argument has been answered rather than overturned: the frame
 * component exists, and it is `@lautstark/design/svelte/Sheet`, so `.head` is
 * still written in exactly one place for all four.
 *
 * What did not change is the seam. `openParts()` puts a body component and a
 * foot component into the frame's own `.body` and `.foot` with nothing in
 * between, because components.css styles those children directly, and the two
 * columns are still a class on the dialog (`.sheet--button`) - a modifier on
 * the shared component rather than a replacement for it. The twenty visual
 * baselines are what proved the first half and hold the second.
 *
 * ## The promise settles from the presses, with a guard
 *
 * design.md §3.4, and the same reasoning shell/collectionNew.svelte.ts's
 * askTarget() writes out: `close` is what a *host* fires, and a host that hides
 * a dialog without firing it would leave the promise pending for the life of
 * the page - a button that did nothing, with no error anywhere. So the presses
 * resolve for themselves and `close` only carries the dismissal.
 *
 * ## Nothing is written until the confirming press
 *
 * Not enforced here - it cannot be, because this module never sees the draft -
 * but it is what the shape is for, and both callers keep it. Every way out
 * that is not a foot button costs exactly nothing, which is the rule an empty
 * cell makes unavoidable: pressing one must not leave a blank key behind when
 * the sheet is dismissed.
 *
 * The picture column has one choice that is made over several presses rather
 * than one - the crop - and so it has to be asked, on the way out through a
 * foot button, whether it is holding anything. That is `Held.settle()` below,
 * and it is on that side of the line rather than this one for exactly the
 * reason above: a foot button is the confirming press, and the ✕, Escape and a
 * press outside still cost nothing.
 */
import type { Component } from "svelte";
import { openParts, type SheetContent } from "./parts.js";
import SheetBody from "./pieces/SheetBody.svelte";
import SheetFoot from "./pieces/SheetFoot.svelte";

/** How a sheet was left. `null` is every way out that wrote nothing. */
export type Left = "done" | "next" | null;

/** The left column, for the sheets that have one.
 *
 * A page on the tablet has no picture and its sheet is one column wide; every
 * other sheet in the product opens on the thing's picture, because that is
 * what somebody is looking at when they press it.
 */
export interface PickColumn {
  /** The symbol the sheet opens on, "" for none. */
  symbol: string;
  /** What to put in the search field: usually the word already on the thing,
   *  which is what somebody is most likely looking for a picture of. */
  seed: string;
  /** A picture was chosen, however it was chosen.
   *
   * `caption` is the collection's own word for the picture and "" when it has
   * none. `typed` is the word the search that found it was run on, and "" when
   * no search was involved - an upload, or the prescribed start-key tile.
   *
   * Both are offered because they are different answers and the callers want
   * the second one. A search for "trinken" that lands on a pictogram filed
   * under "Getraenk" used to name the key "Getraenk": the collection's word,
   * for a key whose owner had just written theirs. `typed` is what somebody
   * meant; `caption` is what the collection calls what they got, and it is
   * still there for the picks that were not searched for at all. */
  onPick(symbol: string, caption: string, typed: string): void;
  /** Whether the picture opens crossed out - Slot.negated. Absent, together
   *  with onNegate below, for a picture that cannot be: a set key is
   *  navigation rather than a word, and there is nothing on it to negate. */
  negated?: boolean;
  /** Somebody crossed the picture out, or stopped. */
  onNegate?(negated: boolean): void;
}

/** What the sheet has to be able to ask the picture column, once it exists.
 *
 * Filled in by shell/pieces/Pick.svelte as it mounts. A handle rather than a
 * return value, because the column is a component now and a component does not
 * hand anything back - what it can do is write into an object its parent made,
 * which is the same seam `drawPick()` had when it answered with one.
 */
export interface Held {
  /** Anything the column has started and not finished, finished. Resolves
   *  immediately when there is nothing pending, which is almost always. */
  settle(): Promise<void>;
  /** The way out that means nothing happened, offered to the column.
   *
   * The Escape this answers used to be a listener on the dialog, because the
   * field it has to be taken back from was markup this file could see. It is
   * inside `@lautstark/bildquelle/svelte/SymbolSearch` now, which takes an
   * `onescape` prop and hands the decision to the caller - conventions.md §6.4,
   * which is explicit that the fix is not Sheet's: wochenwerk nests a second
   * search inside a card editor inside its appointment sheet, and a
   * sheet-level rule there would discard an unsaved appointment and an unsaved
   * card together. This sheet genuinely opens *in* a search and has nothing
   * else to lose, so it wires it.
   *
   * A no-op where no column is drawn, exactly as `settle` is. */
  dismiss(): void;
}

/** The destructive act, on the left of the foot.
 *
 * `settle` closes the sheet as a done. A press that does not call it leaves
 * the sheet standing, which is what a delete that asks a question of its own
 * needs: the question draws a dialog over this one, and only a yes should take
 * the sheet underneath away - a no leaves somebody exactly where they were.
 */
export interface RemoveButton {
  label: string;
  onPress(settle: () => void): void;
}

/** A foot button that closes the sheet as soon as it has done its work. */
export interface FootButton {
  label: string;
  onPress(): void;
}

export interface SheetSpec<S> {
  /** The heading, and the sheet's accessible name. */
  title: string;
  /** The left column. Absent for a sheet with nothing to show a picture of,
   *  which then takes the narrower single-column shape. */
  pick?: PickColumn;
  /** A sentence about the whole thing, across both columns and above them.
   *
   * Its own slot rather than the first of the rows, because those become the
   * form column and a sentence about the button as a whole read there as a
   * sentence about the field under it. It spans, so it also stays right on the
   * one-column sheets - the page card, and either sheet on a narrow screen.
   *
   * A string where it used to be an element: every caller there has ever been
   * built the same `<div class="notice">` round one sentence. */
  notice?: string;
  /** The right column, as a component. This module does not read it - which is
   *  the whole seam, and is why the rows went from an array of elements to one
   *  component rather than to a list of them: what a row is, and how many there
   *  are, is the caller's and always was. */
  rows: Component<{ s: S }>;
  /** What that component is editing. The draft, in every caller. */
  state: S;
  remove?: RemoveButton;
  /** Keep going to the next thing without closing. A board is built in runs,
   *  and a sheet that had to be re-opened from the board fourteen more times
   *  would be slower than the property row it replaced. */
  next?: FootButton;
  done: FootButton;
}

/** What the body and the foot share: the spec, the column's own handle, and
 *  the three presses that end the sheet.
 *
 *  The presses are here rather than built in the foot because the guard that
 *  makes them settle once is in openSheet's closure - see finish() - and a foot
 *  that resolved for itself would be the second half of the promise living
 *  somewhere the first half cannot see. */
export interface Sheet<S> {
  spec: SheetSpec<S>;
  held: Held;
  /** Fertig. Also what Enter in a text field presses. */
  done(): void;
  /** Weiter, for the sheets that have one. */
  next(): void;
  /** The destructive act, which does not close the sheet by itself. */
  remove(): void;
}

/**
 * Opens the sheet and resolves with how it was left.
 *
 * `"done"` and `"next"` are the two foot buttons; every other way out - the
 * corner ✕, Escape, a press outside - is `null`, and null means nothing
 * happened.
 */
export function openSheet<S>(spec: SheetSpec<S>): Promise<Left> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (how: Left) => {
      if (settled) return;
      settled = true;
      resolve(how);
      // After resolving, so a close event arriving as a consequence of this
      // call finds the guard already set.
      sheet?.close();
    };

    /* What the two foot buttons wait for. A sheet with no picture column has
     * nothing to settle and says so in one line, so neither button has to know
     * which kind of sheet it is on. */
    const held: Held = { settle: () => Promise.resolve(), dismiss: () => finish(null) };

    const shared: Sheet<S> = {
      spec, held,
      done: () => void held.settle().then(() => { spec.done.onPress(); finish("done"); }),
      next: () => void held.settle().then(() => { spec.next?.onPress(); finish("next"); }),
      remove: () => spec.remove?.onPress(() => finish("done")),
    };

    const sheet = openParts<Sheet<S>>({
      title: spec.title,
      state: shared,
      /* A width override on the shared component, not a redefinition of it: two
       * columns need more than the 600px a sheet of prose wants. Everything else
       * - the head, body and foot anatomy, the border, the shadow - stays
       * components.css's.
       *
       * A prop, where it was two `classList.add` calls on the handle. It lands
       * on the <dialog> itself at construction, which is what these two need:
       * `.sheet--button > .body`, `.sheet--page > .body`,
       * `.sheet--button > .body > .notice` and `.sheet--button > .foot` are
       * direct-child selectors, and the class arriving a tick after the sheet
       * was shown is a frame of the two-column body drawn as one column.
       * conventions.md §6.1. */
      class: spec.pick ? "sheet--button" : "sheet--button sheet--page",
      body: SheetBody as Component<SheetContent<Sheet<S>>>,
      foot: SheetFoot as Component<SheetContent<Sheet<S>>>,
      onClose: () => finish(null),
    });

    /* Escape out of the search field is `held.dismiss` above, and the listener
     * that used to be here is gone.
     *
     * `<input type="search">` has a behaviour of its own: Escape in one clears
     * the word being searched for, and the key never reaches the dialog. That
     * cost nothing while the sheet opened on a text field - Escape closed it,
     * as it does everywhere in this product - and it costs the whole gesture
     * now that the sheet opens *in* the search. What somebody got was a sheet
     * that ignored the first Escape and shut on the second, which reads as a
     * dialog that has hung.
     *
     * What did it here was a `keydown` on the dialog testing `event.target`
     * for an `<input type="search">`, which worked only while that field was
     * markup this file could see. The field is inside a shared component now
     * and the component takes an `onescape`; the column passes one, and it
     * comes back here as `dismiss` - prevented on the way past, so the field
     * is not cleared, and settled as null, because Escape is one of the ways
     * out that mean nothing happened. §6.4 is explicit that this belongs to
     * the caller rather than to Sheet, and names the product that would lose
     * an unsaved appointment if it did not.
     *
     * Not a reason to give up the search type. The ✕ that type draws inside
     * the field is the one control that clears the word - see the note at the
     * "take the picture off" button, which is a labelled button precisely so
     * that the two ✕ do not stand a few pixels apart meaning different things.
     */

    /* Nothing here takes the focus, and that is a change of hands rather than
     * a loss.
     *
     * showModal() lands it on the corner ✕, which is not what somebody who has
     * just opened a thing is about to do to it, so a sheet has always moved it.
     * Where it moves to is a fact about what is in the sheet: a sheet with a
     * picture column opens in the search field, and the one sheet without a
     * column opens in its single text field. Both of those are components now,
     * and a component taking its own focus as it mounts is the same statement
     * one line closer to the element - where this had to hold an element to
     * point at, and did.
     *
     * Why the search rather than the name, which was the answer before: the
     * word is typed once, into the search. It finds the picture, and picking
     * one writes the same word into the empty name behind it. Landing on the
     * name meant typing it, tabbing across and typing it again. */
  });
}
