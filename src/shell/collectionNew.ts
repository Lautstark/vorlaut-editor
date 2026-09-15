/* Making a Sammlung: the question asked once about which editor it gets, and
 * what follows from the answer. */
import { byId, status } from "./dom.js";
import { menuOn } from "@lautstark/design/menu";
import { openDialog } from "./dialog.js";
import { reason } from "../core/errors.js";
import { createCollection, useCollection } from "../backend/index.js";
import { editorFor, editorOf } from "../core/editor.js";
import { homeSymbol, homeSymbolSource, takeHomeSymbol } from "./homekey.js";
import { state } from "../core/state.js";
import * as symbols from "../data/symbols.js";
import { load, saveNow } from "../core/save.js";
import { t } from "../core/texts.js";
import { GRID, LANG, LANGUAGE_NAMES, LANGUAGES } from "../core/boot.js";
import { isApp } from "../core/types.js";
import type { GridSize, Layout, Target } from "../core/types.js";
import { sizeChoices } from "./gridSizes.js";
import { defaultName, held, repaint } from "./openCollection.js";

/** What askTarget() answers with: which editor, and - for a tablet - how big
 *  its pages are. `grid` is absent for the talker, which has no grid. */
export interface Made {
  target: Target;
  grid?: GridSize;
  /** Which language the device shows its own menu in. The talker's only: on a
   *  tablet package localeFor() reads the locale off the voice first, so this
   *  would be a field with nothing downstream of it. */
  language?: string;
}

/* Which editor a new Sammlung gets, asked once and never again.
 *
 * A dialog rather than two buttons in the sidebar, because "+ Neue Sammlung"
 * is one act with a question inside it and two entries would put the whole of
 * this decision in the width of a rail. Dismissing it makes nothing at all -
 * the rule this page keeps everywhere, and the reason the question comes
 * before the write rather than after.
 *
 * The note under the two says it does not change later. That is the one thing
 * somebody could reasonably expect to be able to undo, and the moment to say
 * so is while they are choosing rather than when they go looking for a switch.
 *
 * ## The tablet leads, and it is already chosen
 *
 * The talker was first and nothing was chosen, so every new Sammlung cost a
 * press on the rarer of the two before the primary button would even light.
 * That order is this repository's history rather than anybody's use of it: the
 * tablet app is what most people are building for, and the five-key talker is
 * the one you go out of your way to make.
 *
 * So the tablet card is first and opens pressed. The dialog still asks - both
 * cards are there, either can be pressed, and the note underneath still says
 * the answer is final - but it asks the way a form with a sensible default
 * asks, which is by being right most of the time and correctable always. What
 * it costs is that somebody who wanted the talker must notice a choice already
 * made rather than make one; the pressed card carries aria-pressed and the
 * grid question under it is open, so what has been chosen is on the screen
 * rather than implied by an enabled button.
 */
function askTarget(): Promise<Made | null> {
  return new Promise((resolve) => {
    /* Settled from the presses, with a guard, and the `close` event only for
     * the ways out that are not a press. That is design.md §3.4's rule, and
     * this file talked itself out of it once: the reasoning was that the
     * presses close the dialog, so one exit through `close` covers everything.
     * It does not. `close` is what a *host* fires, and a host that hides the
     * dialog without firing it leaves this promise pending for the life of the
     * page - what somebody sees is a button that did nothing, with no error
     * anywhere. e2e/collections.spec.ts makes the host into exactly that one,
     * and it is the test that caught this.
     *
     * So the making button resolves for itself, `close` resolves null for the
     * dismissal, and `settled` makes the second of those a no-op. A host that
     * fires `close` twice still resolves once; a host that fires none still
     * resolves. */
    let settled = false;
    const finish = (made: Made | null) => {
      if (settled) return;
      settled = true;
      resolve(made);
      // After resolving, so that a close event arriving as a consequence of
      // this call finds the guard already set.
      sheet?.close();
    };

    /* What the two presses set rather than what they resolve, which is the
     * change: a tablet Sammlung has a second question inside the first, and a
     * button that made the Sammlung on the way past would ask it too late.
     * The talker goes through the same footer press for one press more,
     * because two ways out of one sheet is two things to keep in step. */
    let target: Target | null = null;
    let size: GridSize = { rows: GRID.rows, columns: GRID.columns };
    /* The page's own language, which is the best guess there is at the moment
     * of making: somebody working in German is more likely than not building a
     * German talker. Both blank() implementations already start a Sammlung off
     * this way; what is new is that it is on screen and can be corrected while
     * the Sammlung is being made rather than found afterwards.
     *
     * Asked here rather than answered by a "default language" setting in
     * Einstellungen. A deferred default is one control whose effect appears
     * somewhere else, later, and unseen - which is the shape of the bug this
     * whole change removes. */
    let language = LANG;

    const body: HTMLElement[] = [];
    const choices = new Map<Target, HTMLButtonElement>();
    /* The tablet first. See the head of this function: this order is the answer
     * to "what is somebody most likely making", not the order the two editors
     * were written in. */
    for (const one of ["app", "diy"] as const) {
      const choice = document.createElement("button");
      choice.className = "btn choice";
      choice.type = "button";
      choice.setAttribute("aria-pressed", "false");
      const head = document.createElement("strong");
      head.textContent = t(`ui.collection_target_${one}`);
      const note = document.createElement("span");
      note.textContent = t(`ui.collection_target_${one}_note`);
      choice.append(head, note);
      choice.onclick = () => pick(one);
      choices.set(one, choice);
      body.push(choice);
    }

    /* How much fits on a page, asked only of the target that has pages.
     *
     * Under the tablet choice rather than inside it: a control inside a
     * control is markup no keyboard can walk and no validator allows, which
     * is the same reason a cell in the grid is a box holding two widgets
     * rather than a button holding a button.
     *
     * Beside it rather than after the Sammlung exists, because it is the one
     * thing about a new board somebody already knows - and it says so of
     * itself that it is not final: growing later costs nothing. */
    const sizes = document.createElement("div");
    sizes.className = "sizeask";
    sizes.hidden = true;
    const asks = document.createElement("span");
    asks.className = "lbl";
    asks.textContent = t("ui.app_grid_size");
    const later = document.createElement("p");
    later.className = "note";
    later.textContent = t("ui.app_grid_later");
    const drawSizes = () => {
      sizes.replaceChildren(asks, sizeChoices(size, (picked) => {
        size = picked;
        drawSizes();
      }), later);
    };
    drawSizes();
    body.push(sizes);

    /* The language of the device's own menu, asked only of the target that has
     * one to show.
     *
     * Target-conditional the way the grid above it is, which is the shape this
     * dialog already had: one act with a question inside it, and the question
     * differs by what is being made. The voice is deliberately not here - a
     * new Sammlung starts on whatever the catalogue says its language speaks
     * with, which is a sensible answer nobody has to give, and the Sammlung's
     * own sheet is where it is corrected. */
    const langAsk = document.createElement("div");
    langAsk.className = "sizeask";
    langAsk.hidden = true;
    const asksLang = document.createElement("span");
    asksLang.className = "lbl";
    asksLang.id = "collectionNewLangLabel";
    asksLang.textContent = t("ui.collection_language");
    const anchor = document.createElement("span");
    anchor.className = "menu-anchor start";
    const langPick = document.createElement("button");
    langPick.className = "btn quiet sm dropdown";
    langPick.type = "button";
    langPick.setAttribute("aria-haspopup", "menu");
    langPick.setAttribute("aria-expanded", "false");
    langPick.setAttribute("aria-labelledby", asksLang.id);
    // The options name themselves, out of the same table the two other
    // language controls read - see LANGUAGE_NAMES in core/boot.ts.
    const sayLang = () => { langPick.textContent = LANGUAGE_NAMES[language] || language; };
    sayLang();
    langPick.onclick = () => menuOn(langPick, (add) => {
      for (const code of LANGUAGES) {
        add(LANGUAGE_NAMES[code] || code, () => { language = code; sayLang(); },
            { checked: code === language });
      }
    });
    anchor.appendChild(langPick);
    const langNote = document.createElement("p");
    langNote.className = "note";
    langNote.textContent = t("ui.collection_language_note");
    langAsk.append(asksLang, anchor, langNote);
    body.push(langAsk);

    const note = document.createElement("p");
    note.className = "note";
    note.textContent = t("ui.collection_target_note");
    body.push(note);

    const make = document.createElement("button");
    make.className = "btn primary";
    make.type = "button";
    make.disabled = true;
    make.textContent = t("ui.collection_create");
    make.onclick = () => {
      if (!target) return;
      finish(target === "app" ? { target, grid: size } : { target, language });
    };

    function pick(one: Target): void {
      target = one;
      for (const [which, choice] of choices) {
        choice.setAttribute("aria-pressed", which === one ? "true" : "false");
      }
      sizes.hidden = one !== "app";
      langAsk.hidden = one !== "diy";
      make.disabled = false;
    }

    /* Standing on the tablet before anybody presses anything, which is the
     * whole of what "default" means here: the card is pressed, its grid
     * question is open under it, and Erstellen is live. Through pick() rather
     * than by setting the three of them here, so that the opening state and
     * every state after a press are made by one piece of code - the version
     * that set them separately is how a dialog comes to open showing a
     * question belonging to the other choice. */
    pick("app");

    const sheet: ReturnType<typeof openDialog> | undefined = openDialog({
      title: t("ui.collection_target"),
      body,
      footer: [make],
      onClose: () => finish(null),
    });
    /* The rhythm between the things in the body, which this body has to ask
     * for. components.css spaces a sheet body with `p + p` - right for the
     * sheets that are prose, and it reaches nothing here: the two choices are
     * buttons, the two conditional questions are divs, and so the closing note
     * had no space above it at all. A modifier on the shared component rather
     * than a redefinition of it, which is the move the button sheet already
     * makes for its two columns; ui.css carries what the gap is and why. */
    sheet.dialog.classList.add("sheet--target");
  });
}

/**
 * The picture the start key of a brand new tablet Sammlung points at, fetched
 * into this browser and then drawn.
 *
 * blank() names the picture; this is what makes the name resolve. The two are
 * apart because they can only be apart: naming it is one expression and
 * fetching it is a download, and blank() answers a synchronous question the
 * shell asks of every editor.
 *
 * **Not awaited, and after the Sammlung exists rather than before it.** A
 * Sammlung being made is a press somebody is waiting on, and making it wait on
 * a pictogram download would put the network between "new" and a board - on a
 * page whose whole point is that everything else in it works offline. So the
 * Sammlung is written, opened and named first, this runs behind it, and the
 * board is drawn again when the picture lands. Until then the key is a key with
 * a picture that is not here yet, which is a state every board in this product
 * can already be in and already says out loud.
 *
 * Which collection is asked is read off the Sammlung blank() has just made
 * rather than asked afresh. That answer is live - a METACOM folder arrives and
 * leaves without a reload - so two reads of it are two chances to fetch a
 * picture nothing points at, or to leave the one that is pointed at unfetched.
 * A METACOM start key needs nothing fetched at all: the reference resolves out
 * of somebody's own licensed folder, which is the rule the whole symbol seam is
 * built around.
 *
 * A failure costs the picture and nothing else, and it is said in the status
 * line rather than swallowed: an ARASAAC that could not be reached is worth
 * knowing about, because the remedy is to try again in a minute and the key is
 * one press from being given a picture by hand.
 */
async function keepHomeSymbol(made: Layout, id: string): Promise<void> {
  if (!isApp(made)) return;
  const source = homeSymbolSource();
  const wanted = (made.firstColumn ?? [])
    .some((one) => one.symbol === homeSymbol(source));
  if (!wanted) return;
  try {
    await takeHomeSymbol(source);
  } catch (error) {
    status(t("ui.symbol_failed", { error: reason(error) }));
    return;
  }
  /* Drawn again, because the board was drawn while the picture was still on
   * its way and every cell holding it decided then that there was none.
   *
   * Guarded on the Sammlung still being the open one: a download takes long
   * enough for somebody to have clicked away to another Sammlung, and
   * re-rendering there would draw this Sammlung's board over theirs. Nothing
   * is lost by not drawing - the file is in the store, and the board is
   * correct the next time it is opened. */
  if (held.list.current === id) editorOf(state.layout).render();
}

export async function create(): Promise<void> {
  const made = await askTarget();
  // Dismissed. Nothing was written and nothing is said: a dialog somebody
  // closes should cost exactly what it looked like it would.
  if (!made) return;
  await saveNow();
  const blank = editorFor(made.target).blank(made.grid);
  /* What was chosen while it was being made. blank() already starts a Sammlung
   * off at the page's language, so this only ever differs when somebody
   * changed the field - but it is written unconditionally rather than
   * compared, because "the answer the dialog gave" is the thing this line is
   * about and a guess that happens to agree is still a guess. */
  if (made.language) blank.language = made.language;
  /* And which symbol collection its pictures will come from, taken from what
   * this browser is set to.
   *
   * The pattern the voice and bildhaft already use one level along: the app's
   * setting is the default for a new Sammlung, and the Sammlung carries its
   * own from then on. Written here rather than in blank(), because blank() is
   * the editor's and the setting is the shell's - and because "what this
   * machine is set to" is a fact about the moment a Sammlung is made, not
   * about what a blank one is.
   *
   * readSettings() has already refused "metacom" where no folder answers, so
   * a Sammlung cannot be born asking for a collection this browser has never
   * seen. */
  blank.symbolSource = symbols.activeSource();
  const id = await createCollection(defaultName(), blank);
  await useCollection(id);
  await load();
  await repaint();
  // Straight into the name, selected: the first keystroke replaces the date it
  // was given. Focusing without selecting would make the invented name a chore
  // to delete rather than a suggestion to type over.
  const field = byId<HTMLInputElement>("collectionName");
  field.focus();
  field.select();
  // And the start key's picture, behind all of that - see keepHomeSymbol. The
  // caret is already in the name field by the time this so much as asks the
  // network, which is the whole reason it is the last line here.
  void keepHomeSymbol(blank, id);
}
