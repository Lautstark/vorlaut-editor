/* --- The two sheets ------------------------------------------------------
 *
 * Everything about one button, and everything about one page, each in a modal
 * opened by pressing the thing itself. This is what replaced the property row
 * that used to sit under the grid. The page's question is askDelete() in
 * pageHead.ts; this file is the button's.
 *
 * **Why a sheet rather than a row.** The row could only ever hold what fits on
 * one line, which is why the picture and the sound had to stay in the cell and
 * why a dense board had to give its tools up. A sheet has room for all of it at
 * every board size, so the eleven-column case stops being a degradation and
 * becomes the same interaction as the three-column one. What it costs is the
 * fast path - fifteen new buttons is fifteen open-type-close cycles rather than
 * fifteen presses and some typing - and the foot's "next" button is the
 * mitigation, which is worth stating plainly rather than hiding.
 *
 * **Nothing is written until Fertig.** Both sheets edit a draft and copy it
 * back on the confirming press, so every way out that is not that press costs
 * exactly nothing - which is the rule an empty cell made unavoidable (pressing
 * one must not leave a blank button behind when the sheet is dismissed) and
 * which is no less true of an existing button.
 *
 * **What is left here is the rows.** The frame - the picture column with its
 * search, the foot with the destructive act on the left, and the promise that
 * settles from the presses rather than from `close` alone - is
 * shell/sheet.svelte.ts's, and the head of that file is where the reasoning for
 * each of those lives. What a *button* has on it - which is the half that is
 * genuinely the tablet's - is editor-app/ButtonRows.svelte; what is left here is
 * the draft, the four questions the rows ask, and what Fertig writes.
 */
import type { Act, AppButton } from "../core/types.js";
import { LANG, WORD_CLASSES } from "../core/boot.js";
import { t } from "../core/texts.js";
/* The sheet is the shell's now, and the whole of what this file hands it is a
 * title, a picture, some rows and three labelled things to do. It was written
 * here, and moving it is what let the talker have the same one: an editor may
 * not import out of another editor - tests/unit/layers.test.ts - so anything
 * genuinely shared between the two belongs in the shell. */
import { openSheet } from "../shell/sheet.svelte.js";
import type { Left } from "../shell/sheet.svelte.js";
import { dropdown, type Choice, type Dropdown } from "../shell/dropdown.svelte.js";
import ButtonRows from "./ButtonRows.svelte";
/* What part of speech a word is, as far as the lexicon behind the symbol
 * search can say. In data/ rather than here because it is knowledge about a
 * language, not about a tablet - the talker has no word class at all, and the
 * next thing that wants to read a word will want it from there too. */
import { guessWordClass } from "../data/wordclass.js";
import { addPage, blankButton } from "./pages.js";
import { actKey } from "./marks.js";
import { board, cellHolder, commit, inColumn, page } from "./standing.svelte.js";

/** What the sheet is editing: a copy, until Fertig writes it back. */
interface Draft {
  label: string;
  vocalization: string;
  symbol: string;
  negated: boolean;
  wordClass: string;
  act: Act;
}

/** The four kinds the sheet offers, which are not the seven the union holds.
 *
 * A question about a *word*, and nothing else - `Act` is unchanged and so is
 * everything in data/app_package.ts. Two things it used to ask are gone.
 *
 * The first two used to name a distinction that does not exist: one label
 * said "into the sentence bar" and the other "speak at once", as though one
 * of them spoke and the other did not, and vorlaut-app's BoardViewModel calls
 * utter() for `append` *and* `speak`. Both speak. The only difference is
 * whether the word joins the sentence, which is what the labels say now.
 *
 * The fourth kind is gone with three of the four acts under it. `sayBar`,
 * `backspace` and `clear` are drawn by the viewer as permanent chrome on the
 * message bar - TalkerScreen.kt, per design.md §4.3, with Speak as the
 * screen's one primary - so a grid button for any of them spends a cell out of
 * fifteen on a control that is already on screen at all times, and a second
 * Speak competes with that primary. `home` has no such chrome and does need a
 * cell, but it is navigation rather than bar operation: it is an entry in the
 * page option's target list now, where it says what it does.
 *
 * exchange/SPEC.md §7.4 still names all four, and so does `Act`: a package
 * from another AAC tool may carry any of them, and vorlaut-app has to read it.
 * This is about what this editor offers to make.
 *
 * The fourth kind is the third one wearing §7.3's append-on-navigate: a button
 * that puts its word in the sentence and *then* leads onward, which is how a
 * sentence starter is built. It is a kind here rather than a checkbox under
 * the target list, because the question this dropdown asks is already the
 * right one - what does one press do - and a checkbox would leave the third
 * kind's own label naming two different behaviours depending on a control
 * underneath it.
 */
type Does = "word" | "shout" | "goto" | "carry";

/** Which kind an act reads as, or null for one of the three bar controls the
 *  sheet no longer offers. The sheet keeps such a button saying what it is
 *  rather than letting it re-read as the first kind in the list. */
const doesOf = (act: Act): Does | null =>
  act.kind === "append" ? "word"
  : act.kind === "speak" ? "shout"
  : act.kind === "goto" || act.kind === "home" ? (act.alsoAppend ? "carry" : "goto")
  : null;

/** The two entries in the target list that are not a page: the start page,
 *  which is the act `home` rather than a `goto` at whichever page is home
 *  today, and one that mints a page on Fertig. Page ids are UUIDs, so neither
 *  can collide with one. */
const GOTO_HOME = "⌂";
const GOTO_NEW = "+";

/**
 * One button, opened by pressing its cell.
 *
 * `held` is null for an empty cell, and that is the case the whole draft model
 * is built around: the sheet opens with nothing filled in and the button comes
 * into being on Fertig, so a sheet somebody closes leaves the cell as empty as
 * they found it. Pressing an empty cell used to mint a button immediately and
 * move the panel to it, which meant an accidental press left a blank button on
 * the board.
 */
/** What the sheet holds while it is open, and what its rows read.
 *
 * Every getter is a question rather than a value, which is what makes the rows
 * redraw: `goes` is asked of the dropdown's answer, and the dropdown's answer is
 * a rune. The alternative - a `follow()` that wrote three fields whenever
 * anything moved - is what this file did, and it is the shape that had to be
 * called from four places and was.
 */
export interface ButtonSheet {
  draft: Draft;
  does: Dropdown;
  targets: Dropdown;
  classes: Dropdown;
  readonly kinds: Choice[];
  readonly where: Choice[];
  readonly wordClasses: Choice[];
  /** The sentence under the act dropdown, which is the chosen option's own. */
  readonly note: string;
  /** Whether this button leads anywhere, and whether it says anything. */
  readonly goes: boolean;
  readonly speaks: boolean;
  /** Typing in the Aufschrift, which is two writes and a guess. */
  typedLabel(value: string): void;
}

function openButtonSheet(held: AppButton | null, at: [number, number]): Promise<Left> {
  const layout = board();

  const draft: Draft = $state(held
    ? { label: held.label, vocalization: held.vocalization, symbol: held.symbol,
        negated: Boolean(held.negated), wordClass: held.wordClass, act: held.act }
    : { label: "", vocalization: "", symbol: "", negated: false, wordClass: "",
        act: { kind: "append" } });
  /* Whether "Neue Seite ..." is what the target list is standing on.
   *
   * Held here rather than written straight into the layout, so that the page
   * is minted by the same press that writes everything else - and named from
   * the label as it finally reads, rather than as it read at the moment the
   * option was chosen. The panel minted immediately and took the label it had,
   * which was usually the empty one. */
  let wantsNewPage = false;

  /* A button in the shared column is one button on every page, and the sheet
   * says so before anything is typed into it.
   *
   * The surprise this heads off is not the edit, it is *where* the edit lands:
   * somebody standing on page three, changing a word, has no way to see that
   * pages one, two and four changed with it - and the same press that renames
   * it can delete it from all of them. conventions.md's rule about counting
   * what somebody cannot see, one floor down from the page delete question. It
   * is a notice rather than a question because nothing is lost and nothing is
   * hidden: the board behind the sheet redraws with the change on it, and every
   * other page is one tab away. */
  const notice = inColumn(at[1]) ? t("ui.app_first_column_button") : undefined;

  /* --- what a press does ---------------------------------------------------- */

  const kinds: Choice[] = (["word", "shout", "goto", "carry"] as const)
    .map((kind) => ({ value: kind, label: t(`ui.app_does_${kind}`) }));
  const chose = doesOf(draft.act);
  /* A button made in this editor before the sheet stopped offering the bar
   * controls keeps its act, and keeps saying what that act is: a fourth entry
   * that only such a button has. The alternative is a `sayBar` button that
   * opens reading "Wort" and quietly becomes one on Fertig.
   *
   * Nothing general is built for this, because nothing general can arrive.
   * importObz() has no mapping for these acts on the way in and reads into a
   * talker layout rather than a tablet one, so no board from another AAC tool
   * can carry one here. The only source is this editor's own past, in this
   * browser's IndexedDB. */
  if (!chose) {
    kinds.push({ value: draft.act.kind,
                 label: t(`ui.app_act_${actKey(draft.act.kind)}`) });
  }

  /* Where a navigation button leads, with the start page as the first entry
   * above the pages themselves.
   *
   * `home` is kept as its own act rather than written as a `goto` at whichever
   * page is home today, because the two behave differently the moment somebody
   * makes another page the start page: a `goto` stays pointing where it
   * pointed, and a home button follows. That is the whole reason it is worth an
   * entry of its own - and on a first-column button, which is on every page at
   * once, it is the difference between "back to the start" and "back to the
   * page that used to be the start". */
  const where: Choice[] = [
    { value: GOTO_HOME, label: t("ui.app_act_home") },
    ...layout.pages.map((one, index) =>
      ({ value: one.id, label: one.name || t("ui.app_page_n", { n: index + 1 }) })),
    { value: GOTO_NEW, label: t("ui.app_goto_new") },
  ];

  const wordClasses: Choice[] = [
    { value: "", label: t("ui.wordclass_none") },
    ...WORD_CLASSES.map((one) => ({ value: one.key, label: t(`ui.wordclass_${one.key}`) })),
  ];

  /** What the target list comes to, as an act. A `goto` is never left pointing
   *  at nothing - a button with no target exports as an ordinary appending
   *  button, which is not what the list said was chosen - so it takes whatever
   *  is selected, which is the current page until somebody changes it. */
  const leadsTo = (): Act => {
    // Absent rather than false where the button only navigates - Act's own
    // note, and what keeps a button made before this existed byte-identical.
    const carrying = does.value === "carry" ? { alsoAppend: true } : {};
    return targets.value === GOTO_HOME
      ? { kind: "home", ...carrying }
      : { kind: "goto", page: targets.value === GOTO_NEW ? "" : targets.value,
          ...carrying };
  };

  const does = dropdown(chose ?? draft.act.kind, () => {
    /* Nothing is cleared on a change of act. The draft is a copy that reaches
       the layout only on Fertig, so what somebody typed before changing their
       mind is still there if they change it back. */
    draft.act = does.value === "word" ? { kind: "append" }
      : does.value === "shout" ? { kind: "speak" }
      : does.value === "goto" || does.value === "carry" ? leadsTo()
      : { kind: does.value } as Act;
    wantsNewPage = (does.value === "goto" || does.value === "carry")
      && targets.value === GOTO_NEW;
  });

  const targets = dropdown(
    draft.act.kind === "home" ? GOTO_HOME
      : draft.act.kind === "goto" && draft.act.page ? draft.act.page : page().id,
    () => {
      wantsNewPage = targets.value === GOTO_NEW;
      draft.act = leadsTo();
    });

  const classes = dropdown(draft.wordClass, (value) => {
    draft.wordClass = value;
    /* Somebody has answered, so nothing may answer for them again. Set from
       the control rather than from the value: choosing "Keine Wortart"
       deliberately is an answer, and a guess arriving afterwards to fill the
       field back in would be the page overruling a press. */
    classChosen = true;
  });

  /* --- Guessing the word class from the word --------------------------------
   *
   * The class is a second question about a word that has already been typed,
   * and most of the time the word contains the answer: "Apfel" is a Nomen.
   * data/wordclass.ts is what knows, and what it will not say - it answers for
   * Nomen, Verb and Pronomen and returns "" for everything else, including
   * every word it is not certain about.
   *
   * **Only into a field nobody has touched.** `classChosen` starts true for a
   * button that already carries a class, so opening an old button never
   * re-guesses it, and it is set by the dropdown above the moment somebody
   * chooses anything at all. That is the same rule the Aufschrift keeps for the
   * collection's caption, and it matters more here: a wrong class is a wrong
   * colour on a board somebody else reads, and a field that is already filled
   * in is a field nobody looks at twice.
   *
   * Hung off the Aufschrift rather than off the search, although the ask was
   * "either". They are the same event by the time it matters: typing in the
   * search finds a picture, taking the picture writes the word into an empty
   * Aufschrift, and that write comes through here.
   *
   * The answer arrives late - the tables are fetched on the first word - so the
   * guard is re-read on the way back, and a newer word invalidates an older
   * question the way the search's own token does.
   *
   * **And not into a list somebody has open.** Arriving late also means
   * arriving while the Wortart menu is standing open, and writing then is worse
   * than writing late. A dropdown builds its entries when the list is opened, so
   * an assignment underneath one repaints the trigger and leaves the entries as
   * they were: the trigger reads Pronomen behind a list still ticking Keine
   * Wortart. The press that ought to settle it cannot, because choosing what is
   * already held is a no-op in the control - so a press on Pronomen there calls
   * nobody back, `classChosen` stays false, and the field somebody just answered
   * is left open to being answered over by the next keystroke.
   *
   * Dropped rather than kept until the list closes. Kept, it would land on a
   * field they had just decided about, at a moment no press of theirs explains.
   *
   * Which is why the list being open *now* is not the whole test. An answer
   * arriving a moment after the list is closed is the same surprise again and
   * lands where nobody is looking for it - the first version of this guard asked
   * only whether the list was open at that instant, and a loaded machine walked
   * straight through it. So what is asked is whether anybody has had this
   * question open since it was asked: `opens` when it went out against `opens`
   * on the way back. */
  let classChosen = Boolean(draft.wordClass);
  let asking = 0;
  const guessClass = (): void => {
    if (classChosen) return;
    const word = draft.label;
    const mine = ++asking;
    const looked = classes.opens;
    void guessWordClass(word, LANG).then((key) => {
      if (mine !== asking || classChosen) return;
      if (classes.open || classes.opens !== looked) return;
      draft.wordClass = key;
      // Assigning redraws the trigger and calls nobody back - see dropdown() -
      // so this cannot be mistaken for somebody having chosen.
      classes.value = key;
    }, () => { /* the tables never arrived; the field keeps saying nothing */ });
  };

  const sheet: ButtonSheet = {
    draft, does, targets, classes,
    get kinds() { return kinds; },
    get where() { return where; },
    get wordClasses() { return wordClasses; },
    /* "carry" is the one that answers both with yes: it says its word and it
       leads onward, so it is the only choice that draws Zielseite and
       Gesprochen at once. */
    get goes() { return does.value === "goto" || does.value === "carry"; },
    get speaks() {
      return does.value === "word" || does.value === "shout" || does.value === "carry";
    },
    get note() {
      return this.goes || this.speaks
        ? t(`ui.app_does_${does.value}_note`) : t("ui.app_does_bar_kept");
    },
    typedLabel(value: string) {
      draft.label = value;
      guessClass();
    },
  };

  /** The draft, written where it belongs. Everything the sheet changed lands
   *  in one press, including the button's own existence.
   *
   *  Through `$state.snapshot()`, and that is the one thing this conversion
   *  added to this function: a record handed to a component is a proxy, and a
   *  proxy written into the layout is a proxy handed to structuredClone() and to
   *  IndexedDB, both of which refuse one. wochenwerk's pilot found this out and
   *  wrote it down; every write in this repository goes through a snapshot for
   *  the same reason. */
  const keep = () => {
    const done = $state.snapshot(draft) as Draft;
    if (done.act.kind === "goto" && wantsNewPage) {
      // Named from the label as it finally reads. The authoring move is "this
      // button should lead somewhere new", and making somebody leave, make a
      // page, come back and select it is one thought in three steps.
      //
      // Spread rather than rebuilt, so that a carrying button is still one
      // after the page it leads to has been minted.
      done.act = { ...done.act, page: addPage(layout, done.label.trim()).id };
    } else if (done.act.kind === "goto" && !done.act.page) {
      done.act = { ...done.act, page: page().id };
    }
    const on = page();
    const target = held ?? blankButton(at[0], at[1]);
    // Into the column when the cell is the column's, and onto the page
    // otherwise. An existing button is already in whichever store it belongs
    // to, and nothing here moves it between them - see takesDrop().
    if (!held) {
      if (inColumn(at[1])) layout.firstColumn!.push(target);
      else on.buttons.push(target);
    }
    Object.assign(target, {
      label: done.label, vocalization: done.vocalization,
      symbol: done.symbol, wordClass: done.wordClass, act: done.act,
    });
    // Present only when it is true, never a stored false - see Slot.negated.
    // A button that has never been crossed out is written exactly as it was
    // written before this field existed.
    if (done.negated) target.negated = true;
    else delete target.negated;
    commit();
  };

  return openSheet<ButtonSheet>({
    title: t("ui.app_button_title"),
    pick: {
      symbol: draft.symbol,
      // Seeded with the word already on the button, which is what somebody is
      // most likely looking for a picture of.
      seed: draft.label,
      negated: draft.negated,
      /* Fills an empty label, and never writes over one somebody typed - the
       * same rule both editors have always kept, and for the same reason: the
       * symbol may be called "zustimmen" while the button should say "Ja!".
       *
       * What is new is which word fills it. The collection's caption was the
       * only thing on offer, so a search for "trinken" that landed on a
       * pictogram filed under "Getraenk" named the button "Getraenk" - the
       * collection's word, over the top of the one its owner had just written
       * three inches to the left. The typed word leads now and the caption is
       * what is left for the picks that were not searched for: an upload has
       * neither, and the prescribed start-key tile has only its own name. */
      onPick: (symbol, caption, typed) => {
        draft.symbol = symbol;
        const word = typed || caption;
        if (word && !draft.label.trim()) {
          // The same word the search was run on is a word to guess a class
          // from, and typedLabel() is the one write that does both.
          sheet.typedLabel(word);
        }
      },
      onNegate: (negated) => { draft.negated = negated; },
    },
    rows: ButtonRows,
    state: sheet,
    ...(notice ? { notice } : {}),
    /* Only where there is something to delete. On an empty cell the button
     * would close a sheet that had written nothing, which is what the corner
     * and Escape already do.
     *
     * A shared button leaves every page at once, so the button that does it
     * says that rather than "delete this button". Still no question: the
     * notice at the head of the sheet has said what the column is, and putting
     * it back is one press in the cell it came from. */
    ...(held ? {
      remove: {
        label: t(inColumn(at[1]) ? "ui.app_first_column_remove"
                                 : "ui.app_button_remove"),
        onPress: (settle: () => void) => {
          if (inColumn(at[1])) {
            layout.firstColumn = (layout.firstColumn ?? [])
              .filter((one) => one.id !== held.id);
          } else {
            const on = page();
            on.buttons = on.buttons.filter((one) => one.id !== held.id);
          }
          settle();
          commit();
        },
      },
    } : {}),
    next: { label: t("ui.app_button_next"), onPress: keep },
    done: { label: t("ui.done"), onPress: keep },
  });
}

/**
 * The sheet, and then the next cell's, for as long as somebody keeps pressing
 * "next".
 *
 * This is the property row's one advantage bought back. A board is built in
 * runs - fifteen words onto a page in a sitting - and a sheet that had to be
 * re-opened from the board fourteen more times would be slower than the row it
 * replaced. Reading order, and it stops at the end of the grid rather than
 * wrapping: walking off the last cell back to the first is a surprise, and the
 * board is right there to press.
 */
export async function editButton(row: number, col: number): Promise<void> {
  const grid = board().grid;
  let at = (row * grid.columns) + col;
  for (;;) {
    const on = page();
    const [r, c] = [Math.floor(at / grid.columns), at % grid.columns];
    const how = await openButtonSheet(cellHolder(on, r, c) ?? null, [r, c]);
    if (how !== "next" || at + 1 >= grid.rows * grid.columns) break;
    at += 1;
  }
}
