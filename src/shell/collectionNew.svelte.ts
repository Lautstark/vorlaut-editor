/* Making a Sammlung: the question asked once about which editor it gets, and
 * what follows from the answer. */
import { status } from "./dom.js";
import { openParts } from "./parts.js";
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
import { defaultName, held, repaint } from "./openCollection.js";
import { askName } from "./nameField.svelte.js";
import NewCollectionBody from "./NewCollectionBody.svelte";
import NewCollectionFoot from "./NewCollectionFoot.svelte";

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
/** What the dialog is holding while it is open, and the two things its two
 *  components do to it. Made by askTarget() and handed to both. */
export interface Asking {
  target: Target | null;
  size: GridSize;
  language: string;
  /** The languages a device menu can be built in, by their own names. */
  readonly languages: { code: string; name: string }[];
  /** What the trigger says, which is the language in force in its own word. */
  readonly languageName: string;
  /** A card was pressed. */
  pick(one: Target): void;
  /** Erstellen. */
  make(): void;
}

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

    const asking: Asking = $state({
      target: null,
      size: { rows: GRID.rows, columns: GRID.columns },
      /* The page's own language, which is the best guess there is at the
       * moment of making: somebody working in German is more likely than not
       * building a German talker. Both blank() implementations already start a
       * Sammlung off this way; what is new is that it is on screen and can be
       * corrected while the Sammlung is being made rather than found
       * afterwards.
       *
       * Asked here rather than answered by a "default language" setting in
       * Einstellungen. A deferred default is one control whose effect appears
       * somewhere else, later, and unseen - which is the shape of the bug this
       * whole change removes. */
      language: LANG,
      get languages() {
        return LANGUAGES.map((code) => ({ code, name: LANGUAGE_NAMES[code] || code }));
      },
      get languageName() {
        return LANGUAGE_NAMES[asking.language] || asking.language;
      },
      pick(one: Target) { asking.target = one; },
      make() {
        if (!asking.target) return;
        finish(asking.target === "app"
          ? { target: asking.target, grid: $state.snapshot(asking.size) }
          : { target: asking.target, language: asking.language });
      },
    });

    /* Standing on the tablet before anybody presses anything, which is the
     * whole of what "default" means here: the card is pressed, its grid
     * question is open under it, and Erstellen is live. Through pick() rather
     * than by writing the field, so that the opening state and every state
     * after a press are made by one piece of code - the version that set them
     * separately is how a dialog comes to open showing a question belonging to
     * the other choice. */
    asking.pick("app");

    const sheet = openParts<Asking>({
      title: t("ui.collection_target"),
      state: asking,
      /* The rhythm between the things in the body, which this body has to ask
       * for. components.css spaces a sheet body with `p + p` - right for the
       * sheets that are prose, and it reaches nothing here: the two choices are
       * buttons, the two conditional questions are divs, and so the closing note
       * had no space above it at all. A modifier on the shared component rather
       * than a redefinition of it, which is the move the button sheet already
       * makes for its two columns; ui.css carries what the gap is and why.
       *
       * A prop rather than a `classList.add` on the handle, because
       * `dialog.sheet--target > .body` is a direct-child selector and the class
       * now lands on the <dialog> at construction. conventions.md §6.1. */
      class: "sheet--target",
      body: NewCollectionBody,
      foot: NewCollectionFoot,
      onClose: () => finish(null),
    });
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
  // to delete rather than a suggestion to type over - which is `select`, true
  // by default on TitleField and left that way here.
  // Asked rather than taken, which is §6.5's shape: this says a caret is owed
  // and the field that takes it says so. It reached through a module singleton
  // at the element before, which coupled this controller to that field.
  askName();
  // And the start key's picture, behind all of that - see keepHomeSymbol. The
  // caret is already in the name field by the time this so much as asks the
  // network, which is the whole reason it is the last line here.
  void keepHomeSymbol(blank, id);
}
