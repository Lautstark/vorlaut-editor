/* Exporting the open Sammlung: one entry, the doors behind it, and the one
 * this Sammlung is for. The writers are in shell/packageExport.ts and behind
 * it; this decides only which of them are offered. */
import { openDialog } from "./dialog.js";
import { openDeviceExport, openPackageExport } from "./packageExport.js";
import { state } from "../core/state.js";
import { saveNow } from "../core/save.js";
import { t } from "../core/texts.js";
import { isApp } from "../core/types.js";
import type { Layout } from "../core/types.js";
import { currentName, fileStem, haveCurrent } from "./openCollection.js";

/** One card of the export sheet: which of the exports it names, and its door.
 *
 * `which` is the middle of `ui.collection_export_for_*`, and `run` is the
 * function it presses. A door rather than a target, a kind or a flag: what is
 * carried here is already a decision about which writer to call, so there is
 * nothing left for a writer to branch on. That is the shape
 * exchange/SPEC.md §5.2 asks for, held one line further out than it asks.
 */
interface ExportDoor {
  which: string;
  run(): void;
}

/** What this Sammlung can honestly be written as, the one it is for first.
 *
 * **The Sammlung has known this all along.** Every one of them carries a
 * Target, the sidebar shows it under the name, and the export sheet used to
 * ask anyway - so somebody with a five-key Sammlung was asked, every time,
 * whether the file was for a tablet. `lead` is the answer that was already
 * there; `otherwise` is what is left, and it is left behind a fold.
 *
 * **The document export is not offered any more, and that is a decision
 * rather than a fault in it.** The card under ui.collection_export_for_other
 * wrote data/obf.ts's .obz - the keys and the names of the pictures, for other
 * AAC software to open - and it sat in the talker's fold from the day the
 * fold was made. It
 * was asked for and taken away: a card in a fold is still read past by
 * everybody who opens the fold for the one beside it, and this was the one
 * nobody was pressing. The writer stays where it is - backend/local.ts's
 * exportBoard(), which tools/obfcheck.html drives and
 * tests/unit/obf_roundtrip.test.ts holds - so what went is a door and not a
 * format. adr/0005's interoperability story is the argument for reopening it,
 * and reopening it is one ExportDoor here.
 *
 * If it is ever reopened it belongs in the talker's fold and nowhere else,
 * which was measured rather than reasoned: on an app layout obf.ts's
 * layoutToDocument() reads `layout.sets || []`, undefined and then empty, and
 * exportObz() answers 188 bytes of zip holding no boards at all - a file,
 * downloaded, named after the Sammlung, with none of it inside.
 *
 * **A tablet Sammlung has nothing to put in the fold, and that is a finding
 * rather than a simplification.** The talker's export was opened on an app
 * layout and watched: exportDevicePackage() refuses it outright - it checks
 * isDiy() and throws, because there are no sets and so nothing a device could
 * show. It is not demoted, because it is not an option: an entry that writes a
 * useless file is worse than no entry, which is exchange/SPEC.md §7.4's
 * argument about a control that looks live and does the wrong thing. So `lead`
 * stands alone and chooseExport() does not ask a question with one answer.
 *
 * **The other direction does work, and was checked the same way.** A talker
 * Sammlung exports as an app package: buildAppPackage() branches on
 * layout.target and diyBoards() is a written half of it, one board per set -
 * that is the path vorlaut-app's BuilderPackageTest opens. It is demoted, not
 * dropped, and it is the whole of the fold now.
 *
 * The writers are still three functions, and this decides only which of them
 * are offered. Nothing here is passed to one.
 */
function exportsFor(layout: Layout): { lead: ExportDoor; otherwise: ExportDoor[] } {
  const talker: ExportDoor = { which: "talker", run: () => { void exportDevice(); } };
  const app: ExportDoor = { which: "app", run: () => { void exportApp(); } };
  return isApp(layout)
    ? { lead: app, otherwise: [] }
    : { lead: talker, otherwise: [app] };
}

/** The one entry, the doors behind it, and the one this Sammlung is for.
 *
 * **One button, two doors, three writers, and keeping those facts apart is the
 * whole of this.** What a person presses is one act - export this Sammlung -
 * which is what adr/0011 meant by "one action ... whatever kind of board it
 * is", and it says in the same breath that the writers stay three. They share
 * no code path because exchange/SPEC.md §5.2 makes that a licensing guarantee
 * rather than a tidiness preference: the talker's export never writes a
 * METACOM symbol as pixels, and a refusal enforced by an argument is one call
 * site away from being untrue.
 *
 * So the choice is spent here and never travels. Each card names one of the
 * functions below literally, and each of those names one door; nothing
 * carries a kind, a flag or a target past this line for a writer to branch on.
 * A dispatch that decided *inside* an export which package to write is the
 * thing §5.2 forbids by name, and there is no such value to pass.
 *
 * **It leads with an answer rather than opening with a question**, and that is
 * the change. This was three equal cards under a heading asking what the file
 * was for - a question the Sammlung had already answered. exportsFor()
 * above reads that answer. The Sammlung's own export is the one card standing
 * on its own above the fold; whatever else it can honestly be written as is
 * inside a panel that has to be opened. The title says the act now, out of the
 * same key the menu entry uses, because a sheet that is not asking anything
 * should not be headed with a question mark.
 *
 * A card fires rather than selects, which is where this differs from
 * askTarget(): that dialog has a second question inside it and this one has
 * none. Nothing is written on the press either - both exports cost minutes,
 * and each opens the sheet that names the Sammlung and asks again before
 * anything is synthesised.
 *
 * **Dismissed, it does nothing at all** - not even the save each export
 * begins with, because the save is inside them rather than in front of them. A
 * cancelled dialog costs nothing, and the answer to one that costs something
 * is never to take the dialog away.
 */
export function chooseExport(): void {
  if (!haveCurrent()) return;

  const offered = exportsFor(state.layout);
  /* One door is not a choice, and a sheet asking which of one is a press
   * spent on nothing. A tablet Sammlung goes straight through to its own
   * export - which still opens the sheet that names it and asks before
   * anything is synthesised, so nothing here skips a confirmation. */
  if (!offered.otherwise.length) { offered.lead.run(); return; }

  // Assigned below and read from the presses, which happen later. The cards
  // have to exist before the sheet that holds them does.
  let sheet: ReturnType<typeof openDialog> | undefined;
  const card = (door: ExportDoor, leads: boolean): HTMLButtonElement => {
    const choice = document.createElement("button");
    // No aria-pressed, unlike askTarget's cards: these fire rather than hold a
    // selection, and a button claiming a pressed state it never keeps is worse
    // for somebody reading it out than one that claims nothing. The lead card
    // is marked with a class of its own for that reason - it is the one to
    // press, which is not the same claim as the one in force.
    choice.className = leads ? "btn choice choice--lead" : "btn choice";
    choice.type = "button";
    const head = document.createElement("strong");
    head.textContent = t(`ui.collection_export_for_${door.which}`);
    const note = document.createElement("span");
    note.textContent = t(`ui.collection_export_for_${door.which}_note`);
    choice.append(head, note);
    choice.onclick = () => { sheet?.close(); door.run(); };
    return choice;
  };

  /* The fold, and it is design's own <details class="panel"> rather than
   * anything invented here: a heading that says what is behind it, the
   * browser's own toggle and keyboard behaviour, and no JavaScript of ours in
   * the middle of it. Its summary holds text and no button, which that
   * component requires and this one has no reason to break.
   *
   * Closed on open, every time. The point of the fold is that the Sammlung's
   * own export is the only thing to press until somebody says otherwise. */
  const more = document.createElement("details");
  more.className = "panel";
  const summary = document.createElement("summary");
  const heading = document.createElement("span");
  heading.className = "section";
  heading.textContent = t("ui.collection_export_otherwise");
  summary.append(heading);
  const inside = document.createElement("div");
  inside.className = "body";
  inside.append(...offered.otherwise.map((door) => card(door, false)));
  more.append(summary, inside);

  sheet = openDialog({
    // The act, out of the menu entry's own key. The sheet used to be headed
    // with a question about what the file was for, and is not asking it now.
    title: t("ui.collection_export"),
    body: [card(offered.lead, true), more],
    // No footer. There is nothing to confirm - the cards are the presses - and
    // an Abbrechen beside a corner ✕ would be two buttons for one act.
  });
  // The gap between the cards, which components.css does not reach: its sheet
  // body spaces `p + p`, and these are buttons. ui.css carries the rest.
  sheet.dialog.classList.add("sheet--choices");
}

/** The Sammlung as the talker's own .obz: the sources, the negation flags and
 * the 16 kHz WAVs a talker plays.
 *
 * The third door, all the way down, for the reason the other two are two -
 * exchange/SPEC.md §5.2 and adr/0010. It is the card a talker Sammlung's
 * export sheet leads with now rather than one entry of three, and that changed
 * nothing here: what a person presses and what gets written are different
 * questions, and only the first of them was ever three-by-accident.
 *
 * **It is also, since adr/0011, the only way a Sammlung reaches a device.**
 * The button that sent one is gone and so is the build behind it; this file is
 * what a talker is given, and loader/ is the page that gives it. Two things
 * follow. It gets the same progress-and-stop sheet the app package has, since
 * it synthesises rather than copying a build that was already paid for. And
 * the sheet says where the file goes next, because the page that finishes the
 * job is an address nobody would guess - shell/packageExport.ts's
 * openDeviceExport() is where both live.
 */
async function exportDevice(): Promise<void> {
  if (!haveCurrent()) return;
  await saveNow();
  openDeviceExport(currentName(), fileStem());
}

/** The Sammlung as the package the Android viewer opens: pictures and
 * recordings baked in as files.
 *
 * A second function rather than an option on the first, all the way down to
 * the backend - exchange/SPEC.md §5.2, and the note above exportAppPackage().
 * The menu entry it used to have of its own goes through chooseExport() now;
 * the door is untouched, which is the only half that rule is about.
 *
 * Both kinds of Sammlung reach it and they reach it differently, which is
 * exportsFor()'s doing. A tablet Sammlung is led straight here, because this
 * is the only thing it can honestly be written as. A talker Sammlung finds it
 * folded away under its own export, because it works there too - buildAppPackage()
 * has a diyBoards() half - but it is not what that Sammlung is for.
 *
 * The wait, the count and the way to stop are in shell/packageExport.ts, and
 * they are there because a full tablet Sammlung is hundreds of syntheses.
 */
async function exportApp(): Promise<void> {
  if (!haveCurrent()) return;
  await saveNow();
  openPackageExport(currentName(), fileStem());
}
