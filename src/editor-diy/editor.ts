// The five-key talker's editor: what the shell is handed, and the one question
// this editor asks before something goes.
//
// This is the device-specific half. Five keys to a page, a hole where the
// speaker is, and a cap on the pages that is the device's own: none of that is
// true of AAC in general and all of it is true of this hardware, which is why it
// sits under editor-diy/ and why nothing in the shell may import it. The shell
// reaches it through core/editor.ts instead, and `diy` at the foot of this file
// is what it reaches.
//
// **The drawing is components now, and the file is a tenth of what it was.**
// What stood here was twelve hundred lines: the strip, the six cells, the two
// sheets and the state they all read. Each is its own file beside this one -
// standing.svelte.ts (where the editor stands, and the two ways a change reaches
// the page), Board.svelte with Tabs, Device and Key under it, keySheet.svelte.ts
// with KeyRows.svelte, pageSheet.svelte.ts with PageRows.svelte - and the page
// graph is editor-diy/pages.ts, which is where the walking and the two acts on
// it live, deliberately without a document anywhere near it. adr/0025.
//
// ## The five keys are one kind of thing
//
// There was a fifth here in another shape: a set key, drawn from `BoardSet`'s
// own `name`, `symbol` and `key` rather than from a slot, opening a different
// sheet, and doing one thing nothing else could do - go round to the next set,
// for ever, in whatever order the sets happened to sit. vorlaut-diy-talker's
// adr/0020 ended that on the device and core/types.ts is where it ended here.
//
// What that changes on this screen, in the order somebody would meet it:
//
//   Five cells open the same sheet. There is one key sheet and it has three
//   answers on every one of the five.
//
//   The page's own card - its name, and deleting it - is behind the ⋯ on the
//   tab, and only there. It used to be behind the set key as well, which was
//   two doors to one thing and made the fifth cell the only one that did not
//   open what it was.
//
//   Nothing reorders the pages. Reordering was how the ring was steered, and
//   the ring is gone; the strip draws them in the order the device reaches
//   them instead - editor-diy/pages.ts's pageOrder().
//
// ## What a press does, on a device with no sentence bar
//
// The row for that is in the key sheet, and it asks the same question
// editor-app asks in the same place with the same control. What differs is the
// answers, and the difference is one fact about the hardware: there is no
// sentence bar, so nothing composes. `append`, `clear`, `backspace` and `sayBar`
// are four of Act's seven and all four are about a bar; `home` is the fifth and
// belongs to a start page this device reaches with an ordinary `goto` like any
// other. What is left is saying the key and leading onward, which is three
// answers once the two are allowed to happen on one press:
//
//   Wort            say it, and stay on this page
//   Wort & weiter   say it, then switch to the page the key names
//   weiter          switch, and say nothing
//
// SlotAct in core/types.ts is the shape, and the middle one is why the wire
// needed a field: exchange/SPEC.md §7.3 lets `load_board` beat speaking, so a
// key that does both cannot be written without saying so. It is written as
// `ext_lautstark_speak_on_navigate`, the sibling of the flag the tablet's
// carrier phrase already rides on - *speak on the way through* where a tablet
// *appends on the way through*.
//
// The marks on the cell are editor-app's, not new ones. A key that leads onward
// wears the corner arrow that follows it, a key that speaks wears the play
// control that auditions it, and one that does both wears both - which is the
// same table a tablet cell reads, with the rows this device has. Nothing lands
// in `.cell__act`: that badge is for the acts with no better mark of their own,
// and neither of these is one.
import type { Editor } from "../core/editor.js";
import { isDiy } from "../core/types.js";
import type { Layout } from "../core/types.js";
import { deletePage, blankPage, inboundTo } from "./pages.js";
import { LANG } from "../core/boot.js";
import { t } from "../core/texts.js";
import { confirmDialog } from "../shell/dialog.js";
import { at, board, commit, goToSet, render, setName } from "./standing.svelte.js";

/**
 * The question asked before a page goes.
 *
 * A `<dialog>`, and this is the change: it was `window.confirm`, which
 * conventions.md §3.4 forbids outright - the browser's own chrome is the one
 * surface in the product no design token reaches, so it is the one place that
 * cannot follow the scheme. The divergence list named mitreden for this and
 * recorded vorlaut as compliant; vorlaut was not, and only this call site was
 * left.
 *
 * It also failed §1.7's shape twice over. The question named the set and
 * counted nothing inside it, so it asked somebody to decide without the one
 * fact that could change their mind; and the confirming button said OK, which
 * asks the reader to hold what it refers to in their head.
 *
 * What is counted is the keys with something on them rather than the five,
 * which are always five. An empty page is the case where there is genuinely
 * nothing to lose, and it says so instead of counting to zero.
 *
 * **And a second number, which is the one somebody cannot see.** What is *on*
 * this page is on the screen behind the dialog; what points *at* it is on five
 * other pages, and after the delete every one of those keys says its word and
 * stays where it is. That was harmless while the ring was a rule - it was
 * worked out afresh from the pages that were left and could not point at
 * nothing - and it stopped being harmless the moment targets went into the
 * file. Somebody deleting round 7 of a twelve-round game would otherwise get
 * no message and a dead end in round 6, visible for the first time on the
 * device.
 *
 * Said rather than mended, and deletePage() carries that argument: pulling the
 * chain together would repair a speech Sammlung and silently rewrite a game.
 *
 * The same shape as editor-app's page delete, deliberately - down to counting
 * the inbound edges in the question - because they are the same act on the
 * same kind of object, one editor apart.
 */
export async function askDelete(): Promise<boolean> {
  const layout = board();
  const sets = layout.sets;
  if (!sets.length) return false;
  const entry = sets[at()]!;
  const name = setName(entry, at());
  const n = (entry.slots || []).filter(
    (slot) => (slot.text || "").trim() || (slot.symbol || "").trim()).length;
  const leading = entry.id ? inboundTo(layout, entry.id).length : 0;

  if (!await confirmDialog({
    title: t("ui.remove_set"),
    body: t(n === 0 ? "ui.set_delete_ask_none"
             : n === 1 ? "ui.set_delete_ask_one" : "ui.set_delete_ask",
            { name, n })
          + (leading
            ? " " + t(leading === 1 ? "ui.set_delete_leads_one"
                                    : "ui.set_delete_leads", { n: leading })
            : ""),
    confirmLabel: t("ui.set_delete_go"),
    // Never the same word as the button beside it: two dismissals sharing an
    // accessible name is ambiguous to anyone navigating by it.
    danger: true,
  })) return false;

  deletePage(layout, at());
  goToSet(Math.min(Math.max(0, at() - 1), sets.length - 1));
  commit();
  return true;
}

/* wireEditor() stood here and bound one control: the preview toggle, which went
 * to the loader page with the picture it drew (adr/0013). There is nothing on
 * this editor's own markup left to bind - every control it has is drawn by a
 * component with its handler attached where it is drawn - so app.ts passes a
 * wire step that does nothing rather than this file exporting a function that
 * does nothing. */

/* What the shell is handed, and the whole of what it may ask for.
 *
 * Seven members, and each one is a question the shell has that only the device
 * can answer - see core/editor.ts for what each is and why it is not a general
 * "do something to the board" hook. app.ts registers this object against the
 * "diy" target; nothing in src/shell/ imports this file, and
 * tests/unit/layers.test.ts is what says so.
 */
export const diy: Editor = {
  /* What a new board starts as, and it is a fact about this hardware: one page
   * of five empty keys. app.py seeded
   * content/ from example/ so that nobody met an empty screen; this is that
   * idea at its smallest, because the examples are pictures and recordings
   * that would have to be fetched, and an empty board somebody can type into
   * is worth more than a wait. */
  blank(): Layout {
    return {
      sleep_timeout_seconds: 600,
      /* The language the device's own menu will be in, not a fixed "de".
       *
       * This is the Sammlung's language rather than the page's - the two were
       * one field and one control until they were split - and it is a starting
       * point that can be changed in the settings sheet afterwards. The page's
       * is the best guess there is at the moment of making: somebody working
       * in German is more likely than not building a German talker, and a
       * hardcoded "de" was rendering an English reader's first board in a
       * language they had not asked for, in a product whose whole audience is
       * people who need the words to be theirs.
       *
       * Read at the moment a board is made rather than captured at module
       * level: LANG is a live binding and a language switch moves it, so a
       * board made after the switch is made in the language on screen. */
      language: LANG,
      // blankPage()'s, so that the first page a person meets and the page the
      // "+ Neue Seite" press makes are the same page made two ways.
      sets: [blankPage()],
    };
  },

  /* A different board is in force. Back to its first page rather than clamped
   * to where the last board happened to be standing: set three of the kitchen
   * board and set three of the nursery board have nothing to do with each
   * other, and landing on one because the other was open reads as the page
   * having lost its place. */
  adopt(): void {
    goToSet(0);
    render();
  },

  render,

  /* A sentence somebody actually wrote, from the set on screen, so that trying
   * a voice out is heard on the content rather than on a specimen. "" when
   * this board has nothing typed on it yet; the settings sheet has its own
   * specimen for that, in the reader's language, which is not this file's to
   * choose. */
  sample(): string {
    const entry = board().sets[at()];
    const slot = (entry ? entry.slots || [] : []).find(
      (one) => (one.text || "").trim());
    return slot ? slot.text.trim() : "";
  },

  /* How many sets are in a layout. The sidebar draws it beside the name and
   * the delete question counts with it, and neither of them knows the word
   * "set" - they ask for a number and `unit` below is what puts a word to it.
   *
   * Takes a layout rather than reading state.layout, and answers 0 for a
   * layout that is not this editor's: the sidebar counts every Sammlung it
   * lists, and one of them being a tablet's is the ordinary case rather than
   * a reason to throw the way board() does. */
  count(layout: Layout): number {
    return isDiy(layout) ? layout.sets?.length ?? 0 : 0;
  },

  /* Sets, because a page is a fixed five keys here: the number of pages and
   * the amount of work in a Sammlung move together, so one number does both of
   * the jobs conventions.md §1.8 gives it. That is not true on a tablet, where
   * a page holds anything from nothing to sixty-six - see editor-app. */
  unit: "set",

  /* The fixed words on the controls this editor owns, re-read on every
   * language switch - applyTexts() calls this rather than naming ids itself.
   *
   * None, now. There were four: the button that deleted a set went into the
   * set's own card, which builds its own label every time it opens; the button
   * that sent to the talker went to a page of its own (adr/0011); and the
   * preview toggle went with the picture it drew (adr/0013). Everything else
   * this editor puts on screen is built by render() or by a sheet, with its
   * words read at the moment it is made.
   *
   * Empty rather than absent: Editor.labels() is how the shell asks, and an
   * editor that answers "nothing" is a different statement from one the shell
   * cannot ask. */
  labels(): void {},
};
