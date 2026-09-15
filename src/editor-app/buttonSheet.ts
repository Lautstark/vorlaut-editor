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
 * shell/sheet.ts's, and the head of that file is where the reasoning for each
 * of those now lives. This file says what a *button* has on it, which is the
 * half that is genuinely the tablet's.
 */
import type { Act, AppButton } from "../core/types.js";
import { LANG, WORD_CLASSES } from "../core/boot.js";
import { t } from "../core/texts.js";
import { speak } from "../shell/speech.js";
/* The sheet is the shell's now, and the whole of what this file hands it is a
 * title, a picture, some rows and three labelled things to do. It was written
 * here, and moving it is what let the talker have the same one: an editor may
 * not import out of another editor - tests/unit/layers.test.ts - so anything
 * genuinely shared between the two belongs in the shell. */
import { dropdown, formRow, hint, openSheet, textField } from "../shell/sheet.js";
import type { Choice, Left } from "../shell/sheet.js";
/* What part of speech a word is, as far as the lexicon behind the symbol
 * search can say. In data/ rather than here because it is knowledge about a
 * language, not about a tablet - the talker has no word class at all, and the
 * next thing that wants to read a word will want it from there too. */
import { guessWordClass } from "../data/wordclass.js";
import { addPage, blankButton } from "./pages.js";
import { actKey } from "./marks.js";
import { board, cellHolder, commit, inColumn, page } from "./standing.js";

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
function openButtonSheet(held: AppButton | null, at: [number, number]): Promise<Left> {
  const layout = board();

  const draft: Draft = held
    ? { label: held.label, vocalization: held.vocalization, symbol: held.symbol,
        negated: Boolean(held.negated), wordClass: held.wordClass, act: held.act }
    : { label: "", vocalization: "", symbol: "", negated: false, wordClass: "",
        act: { kind: "append" } };
  /* Whether "Neue Seite ..." is what the target select is standing on.
   *
   * Held here rather than written straight into the layout, so that the page
   * is minted by the same press that writes everything else - and named from
   * the label as it finally reads, rather than as it read at the moment the
   * option was chosen. The panel minted immediately and took the label it had,
   * which was usually the empty one. */
  let wantsNewPage = false;

  /* --- the fields --- */

  const rows: HTMLElement[] = [];

  /* A button in the shared column is one button on every page, and the sheet
   * says so before anything is typed into it.
   *
   * The surprise this heads off is not the edit, it is *where* the edit
   * lands: somebody standing on page three, changing a word, has no way to
   * see that pages one, two and four changed with it - and the same press
   * that renames it can delete it from all of them. conventions.md's rule
   * about counting what somebody cannot see, one floor down from the page
   * delete question. It is a notice rather than a question because nothing
   * is lost and nothing is hidden: the board behind the sheet redraws with
   * the change on it, and every other page is one tab away. */
  let notice: HTMLElement | undefined;
  if (inColumn(at[1])) {
    notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = t("ui.app_first_column_button");
  }

  const labelInput = textField(draft.label, (value) => { draft.label = value; });
  labelInput.id = "appLabel";
  labelInput.placeholder = t("ui.app_button_label_hint");
  /* The hint rides on the caption's line rather than under the field.
   *
   * It is a qualification of the question - what an empty one means - and it
   * is short enough to read as one. Under the control it was a third stacked
   * line saying something the placeholder in the field had half said already;
   * beside the caption it says the half the placeholder cannot, and costs no
   * height at all.
   *
   * Short enough is a measured claim rather than a hope. The caption's line
   * is the form column less the caption, which is 312px here, and the whole
   * sentence has to fit in one of them - a note that wraps there is taller
   * than the row it was moved out of, which is the modifier costing the
   * height it was written to save. The sentence this row used to carry filled
   * that line with nothing to spare; the one in ui.app_button_label_note now
   * says the same thing in half of it, which is the margin a longer caption
   * or a larger text size needs. ui.app_button_spoken_note is the same
   * sentence about the other field, and the two are written to read as a
   * pair. */
  const labelRow = formRow(t("ui.app_button_label"), labelInput,
                           t("ui.app_button_label_note"));
  labelRow.classList.add("form__row--caption");
  rows.push(labelRow);

  /* --- what a press does, and the rows that follow from it ---------------
   *
   * Asked second, directly under the label, because it decides whether the
   * rows under it mean anything at all. A navigation button says nothing, so
   * its Gesprochen field and its play button are two dead controls - and
   * asked last, as this was, they were dead in silence, with nothing on
   * screen saying why typing into one changes nothing.
   *
   * A dropdown rather than the radiogroup it was, which is what makes the
   * move affordable: four boxed options with their notes under them were most
   * of this sheet's height, and a sheet that has to be scrolled to reach
   * Fertig is worse than one asking its questions in the wrong order. What
   * the radiogroup carried and a bare dropdown would throw away is each
   * option's own line - ui.app_does_word_note against ui.app_does_shout_note,
   * "says itself and joins the sentence" against "says itself but does not",
   * which is the only thing explaining a distinction people otherwise get
   * wrong. So the chosen option's note follows the control as a hint, and the
   * sheet still says it.
   */
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
   * browser's IndexedDB.
   */
  if (!chose) {
    kinds.push({ value: draft.act.kind,
                 label: t(`ui.app_act_${actKey(draft.act.kind)}`) });
  }

  const note = hint();
  note.id = "appDoesNote";
  const does = dropdown(kinds, chose ?? draft.act.kind, () => { chosen(); });
  does.button.id = "appDoes";
  /* Named to the trigger by hand, because this row builds its sentence rather
   * than handing formRow() one: it is rewritten on every choice, so the row
   * cannot be given a string once. What the association buys is the same
   * thing it buys everywhere else - "Wort" on its own does not say what a
   * word does, and this is the distinction people get wrong. */
  does.button.setAttribute("aria-describedby", note.id);
  /* Beside the caption, the same as Aufschrift and Gesprochen.
   *
   * It sat beside the *trigger* while the trigger was a narrow button, on the
   * argument that "Ausruf" left three quarters of a line empty. The trigger
   * spans the row now, so that line is gone - and the wider point is that a
   * reader should not have to work out a different rule per row. A note rides
   * beside the caption that names the question; nowhere else.
   *
   * This one is longer than the other two and will wrap here, which is the
   * cost of the consistency and is worth paying rather than hiding. It has a
   * better home waiting: the descriptions belong on the menu items themselves,
   * where all three are readable while somebody is choosing between them
   * instead of one at a time afterwards. That needs a second line on
   * @lautstark/design's menu items, which `AddItem` has no room for today. */
  const actRow = formRow(t("ui.button_act"), does.anchor, "", does.button);
  actRow.classList.add("form__row--caption");
  actRow.appendChild(note);
  rows.push(actRow);

  /* Where a navigation button leads, with the start page as the first entry
   * above the pages themselves.
   *
   * `home` is kept as its own act rather than written as a `goto` at whichever
   * page is home today, because the two behave differently the moment somebody
   * makes another page the start page: a `goto` stays pointing where it
   * pointed, and a home button follows. That is the whole reason it is worth
   * an entry of its own - and on a first-column button, which is on every page
   * at once, it is the difference between "back to the start" and "back to the
   * page that used to be the start".
   */
  const where: Choice[] = [
    { value: GOTO_HOME, label: t("ui.app_act_home") },
    ...layout.pages.map((one, index) =>
      ({ value: one.id, label: one.name || t("ui.app_page_n", { n: index + 1 }) })),
    { value: GOTO_NEW, label: t("ui.app_goto_new") },
  ];
  /** What the target list is standing on, as an act. A `goto` is never left
   *  pointing at nothing - a button with no target exports as an ordinary
   *  appending button, which is not what the list said was chosen - so it
   *  takes whatever is selected, which is the current page until somebody
   *  changes it. */
  const leadsTo = (): Act => {
    // Absent rather than false where the button only navigates - Act's own
    // note, and what keeps a button made before this existed byte-identical.
    const carrying = does.value === "carry" ? { alsoAppend: true } : {};
    return targets.value === GOTO_HOME
      ? { kind: "home", ...carrying }
      : { kind: "goto", page: targets.value === GOTO_NEW ? "" : targets.value,
          ...carrying };
  };
  const targets = dropdown(where,
    draft.act.kind === "home" ? GOTO_HOME
      : draft.act.kind === "goto" && draft.act.page ? draft.act.page : page().id,
    () => {
      wantsNewPage = targets.value === GOTO_NEW;
      draft.act = leadsTo();
    });
  targets.button.id = "appGoto";
  const targetRow = formRow(t("ui.goto_page"), targets.anchor, "", targets.button);
  rows.push(targetRow);

  const spoken = textField(draft.vocalization, (value) => {
    draft.vocalization = value;
  });
  spoken.id = "appSpoken";
  /* What this field would say if nothing were typed into it, shown in it while
   * nothing is - which is the Aufschrift, by exchange/SPEC.md §7.2's rule.
   *
   * A placeholder that is a value rather than a placeholder that is a
   * sentence, which is the distinction that makes this safe to add after the
   * sentence was deliberately taken out of here. That one said what an empty
   * field means and vanished the moment somebody typed - so it disappeared
   * exactly when it might have been wanted - and it now lives on the caption's
   * line where it stays put. This says something else: not the rule, but what
   * the rule currently comes to. It is right to vanish when there is a
   * vocalization, because then it is no longer true.
   *
   * Kept in step with the field above by listening rather than by replacing
   * its handler: textField() has already put the draft write on `oninput`, and
   * a second listener is the way to have both.
   */
  const echoLabel = () => { spoken.placeholder = draft.label.trim(); };
  echoLabel();
  labelInput.addEventListener("input", echoLabel);
  const play = document.createElement("button");
  play.type = "button";
  play.className = "btn";
  play.textContent = "▶";
  play.setAttribute("aria-label", t("ui.play_title"));
  play.title = t("ui.play_title");
  // What the tablet would say, which is the vocalization where there is one
  // and the label where there is not - exchange/SPEC.md §7.2's rule, said out
  // loud rather than described.
  play.onclick = () => {
    const saying = (draft.vocalization || draft.label).trim();
    if (saying) void speak(saying, play);
  };
  const withPlay = document.createElement("div");
  withPlay.className = "form__withplay";
  withPlay.append(spoken, play);
  /* The same treatment as Aufschrift, and the same sentence about the other
   * field: leave it empty and the label is what gets said.
   *
   * It was the field's placeholder, which is one place too few and one too
   * many at once. Too few, because a placeholder is gone the moment somebody
   * types - and the thing it says is about the empty field, so it disappears
   * exactly when somebody might want to undo their way back to it. Too many,
   * because the row would otherwise say it twice. So it moves onto the
   * caption's line, where it stays put and costs no height, and the field is
   * left bare. */
  const spokenRow = formRow(t("ui.app_button_spoken"), withPlay,
                            t("ui.app_button_spoken_note"), spoken.id);
  spokenRow.classList.add("form__row--caption");
  rows.push(spokenRow);

  /* Eleven entries, which is the longest list in the product and the one that
   * decides whether an open menu still fits inside a sheet. See fit() in
   * shell/sheet.ts: it opens upward from here and caps itself at what is
   * above, rather than hanging out of the body and taking the sheet's own
   * scrollbar with it. */
  const classes = dropdown(
    [{ value: "", label: t("ui.wordclass_none") },
     ...WORD_CLASSES.map((one) =>
       ({ value: one.key, label: t(`ui.wordclass_${one.key}`) }))],
    draft.wordClass, (value) => {
      draft.wordClass = value;
      /* Somebody has answered, so nothing may answer for them again. Set from
       * the control rather than from the value: choosing "Keine Wortart"
       * deliberately is an answer, and a guess arriving afterwards to fill the
       * field back in would be the page overruling a press. */
      classChosen = true;
    });
  classes.button.id = "appClass";
  rows.push(formRow(t("ui.app_button_class"), classes.anchor, "", classes.button));

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
   * chooses anything at all. That is the same rule the Aufschrift keeps for
   * the collection's caption, one row up, and it matters more here: a wrong
   * class is a wrong colour on a board somebody else reads, and a field that
   * is already filled in is a field nobody looks at twice.
   *
   * Hung off the Aufschrift rather than off the search, although the ask was
   * "either". They are the same event by the time it matters: typing in the
   * search finds a picture, taking the picture writes the word into an empty
   * Aufschrift, and that write comes through here. Typing in the search with a
   * name already on the button is not an event about the name.
   *
   * The answer arrives late - the tables are fetched on the first word - so
   * the guard is re-read on the way back, and a newer word invalidates an
   * older question the way the search's own token does.
   *
   * **And not into a list somebody has open.** Arriving late also means
   * arriving while the Wortart menu is standing open, and writing then is
   * worse than writing late. dropdown() builds its entries when the list is
   * opened, so an assignment underneath one repaints the trigger and leaves
   * the entries as they were: the trigger reads Pronomen behind a list still
   * ticking Keine Wortart. The press that ought to settle it cannot, because
   * choosing what is already held is a no-op in the control - so a press on
   * Pronomen there calls nobody back, `classChosen` stays false, and the field
   * somebody just answered is left open to being answered over by the next
   * keystroke. Somebody with the question open is answering it; the guess is
   * an offer to somebody who is not.
   *
   * Dropped rather than kept until the list closes. Kept, it would land on a
   * field they had just decided about, at a moment no press of theirs
   * explains - the same surprise, moved later and made harder to attribute.
   * Dropping costs a guess only where no further keystroke follows, and where
   * one does it costs nothing at all: the tables are in the browser's module
   * map by then, so the next ask answers without a fetch.
   *
   * Which is why the list being open *now* is not the whole test. An answer
   * arriving a moment after the list is closed is the same surprise again and
   * lands where nobody is looking for it - the first version of this guard
   * asked only whether the list was open at that instant, and a loaded machine
   * walked straight through it. So what is asked is whether anybody has had
   * this question open since it was asked: `opens` when it went out against
   * `opens` on the way back.
   *
   * Counted per ask rather than remembered on the field, which is the
   * difference between this and treating an open list as an answer given.
   * Somebody who opens Wortart before typing anything has answered nothing,
   * and the word they type next is guessed at exactly as it would have been.
   */
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
  labelInput.addEventListener("input", guessClass);

  /** The rows that depend on the answer above them, and the note under it.
   *
   * Hidden rather than disabled: the question is not whether somebody may type
   * into Gesprochen, it is whether this button says anything at all, and a
   * greyed field still reads as a field they have failed to reach.
   *
   * Wortart stays for all four, which looks like an oversight and is not. A
   * page-leading button is coloured as a category on real German boards, and
   * BuilderTabletPackageTest asserts exactly that of the navigating button in
   * the round-trip sample - #D8AF97, the category colour.
   *
   * Nothing is cleared on a change of act. The draft is a copy that reaches
   * the layout only on Fertig, so what somebody typed before changing their
   * mind is still there if they change it back.
   */
  const follow = () => {
    // "carry" is the one that answers both with yes: it says its word and it
    // leads onward, so it is the only choice that draws Zielseite and
    // Gesprochen at once.
    const goes = does.value === "goto" || does.value === "carry";
    const speaks = does.value === "word" || does.value === "shout"
                || does.value === "carry";
    note.textContent = goes || speaks ? t(`ui.app_does_${does.value}_note`)
                                      : t("ui.app_does_bar_kept");
    targetRow.hidden = !goes;
    spokenRow.hidden = !speaks;
  };
  /* A declaration rather than the assignment the select's onchange was, and
   * hoisting is the whole reason: the dropdown is built above the two rows it
   * governs, so what it is handed has to be nameable before they exist. */
  function chosen(): void {
    draft.act = does.value === "word" ? { kind: "append" }
      : does.value === "shout" ? { kind: "speak" }
      : does.value === "goto" || does.value === "carry" ? leadsTo()
      : { kind: does.value } as Act;
    wantsNewPage = (does.value === "goto" || does.value === "carry")
      && targets.value === GOTO_NEW;
    follow();
  }
  follow();

  /** The draft, written where it belongs. Everything the sheet changed lands
   *  in one press, including the button's own existence. */
  const keep = () => {
    if (draft.act.kind === "goto" && wantsNewPage) {
      // Named from the label as it finally reads. The authoring move is "this
      // button should lead somewhere new", and making somebody leave, make a
      // page, come back and select it is one thought in three steps.
      //
      // Spread rather than rebuilt, so that a carrying button is still one
      // after the page it leads to has been minted.
      draft.act = { ...draft.act, page: addPage(layout, draft.label.trim()).id };
    } else if (draft.act.kind === "goto" && !draft.act.page) {
      draft.act = { ...draft.act, page: page().id };
    }
    const on = page();
    const target = held ?? blankButton(at[0], at[1]);
    // Into the column when the cell is the column's, and onto the page
    // otherwise. An existing button is already in whichever store it belongs
    // to, and nothing here moves it between them - see acceptsDrop().
    if (!held) {
      if (inColumn(at[1])) layout.firstColumn!.push(target);
      else on.buttons.push(target);
    }
    Object.assign(target, {
      label: draft.label, vocalization: draft.vocalization,
      symbol: draft.symbol, wordClass: draft.wordClass, act: draft.act,
    });
    // Present only when it is true, never a stored false - see Slot.negated.
    // A button that has never been crossed out is written exactly as it was
    // written before this field existed.
    if (draft.negated) target.negated = true;
    else delete target.negated;
    commit();
  };

  return openSheet({
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
          draft.label = word;
          labelInput.value = word;
          // Or the field below goes on offering to say the empty label.
          echoLabel();
          // The same word the search was run on is a word to guess a class
          // from, and this is the write the listener above cannot see.
          guessClass();
        }
      },
      onNegate: (negated) => { draft.negated = negated; },
    },
    rows,
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
    /* No `focus`: the sheet opens in the picture column's search field, which
     * is where a button is now begun. See SheetSpec.focus, which carries the
     * argument - the word is typed once, into the search, and picking what it
     * finds writes it into the empty Aufschrift behind. */
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
