// The two panels this editor adds to the Sammlung's sheet: the grid, and how a
// press on the tablet counts. Handed to the shell through
// collectionSheetPanel() in wireEditor(), because the shell may not import
// this directory.
import type { AppLayout, GridSize } from "../core/types.js";
import { t } from "../core/texts.js";
import { sizeChoices } from "../shell/collections.js";
import { outside, resize, shareFirstColumn, shared, spreadFirstColumn } from "./pages.js";
import { board, commit, wordColor } from "./standing.js";

/** The panel that holds what is true of the whole Sammlung: how big a page is,
 * how a word class is worn, and what the first column is.
 *
 * Every one of them is one decision for every page, which is why none belongs
 * in the bar over the board where everything else is about the *page* on
 * screen. They share a panel for the same reason they are the same kind of
 * decision: made once, and then in force wherever somebody goes.
 *
 * It was a card of its own behind the ⋯ beside the Sammlung's name, one entry
 * above that Sammlung's settings - two doors to "what is this Sammlung set
 * to", which is one too many. It is a panel in that sheet now, handed over
 * through collectionSheetPanel() because the shell may not import this file.
 * The heading says the size the Sammlung is at, the way every other panel on
 * that sheet states what it is set to.
 *
 * The first column is the newest and the one that most needs the company. It
 * is the same argument the grid size is made with, one column narrower - what
 * a person learns on a board of this kind is where a word *is*, and core words
 * only stay put while every page puts them in the same place. The gap under it
 * is not a second feature but the way that fact is drawn; it sits directly
 * beneath, because a gap switched on over a column that is not shared marks
 * something that is not true.
 *
 * Nothing is written until the button at the foot of the panel is pressed,
 * and that is the one rule this sheet does not otherwise have: every other
 * panel on it applies as it is touched. It has to be. Waiting is what lets the
 * panel say what a smaller grid would cost while the choice is still being
 * made, and it is why the button changes its words - growing or leaving the
 * size alone is an ordinary "apply", and shrinking past something, or taking
 * one page's first column over the rest, is the destructive act the notices
 * above it have just counted. A live-apply grid would throw the buttons away
 * and then mention it.
 *
 * The button is in the panel rather than on the dialog, which is where the
 * settings sheet's one unavoidable Save already sits for the Azure key: a Save
 * on the dialog would speak for the voice and the language too, and both of
 * those are already in force by the time anybody could press it. There is no
 * Cancel for the same reason there is none anywhere else here - the sheet's ✕
 * is the way out, and what is pending lives only in this closure, so closing
 * it is declining it.
 */
export function gridPanel(into: HTMLElement,
                          heading: (section: string, state: string) => void): void {
  const layout = board();
  let size: GridSize = { ...layout.grid };
  let colour = wordColor(layout);
  let column = shared(layout);
  let gap = layout.firstColumnGap === true;

  /* What the pending choices would do, applied to a copy.
   *
   * A copy rather than arithmetic over the real layout, because the two
   * destructive halves overlap: a button in another page's first column can
   * *also* be outside a smaller grid, and two sentences each counting it would
   * between them claim two buttons are going when one is. Applying the same
   * sequence apply() will apply, to a throwaway, is the only way to count what
   * actually happens - and the pages are small enough that doing it on every
   * redraw of a card costs nothing worth measuring. */
  const trial = (): { dropped: number; lost: number } => {
    const copy = structuredClone(layout);
    const dropped = share(copy);
    return { dropped, lost: outside(copy, size.rows, size.columns).length };
  };

  /** The first-column half of the pending changes, in the order apply() runs
   *  it: before the resize, so that what the resize then counts is the board
   *  the column has already been made into. Answers how many buttons the
   *  sharing itself took. */
  const share = (into: AppLayout): number => {
    if (column && !shared(into)) {
      // The home page's column, not the page somebody happens to be standing
      // on. This card is opened from the Sammlung's menu and shows no board,
      // so a source that depended on which tab was last pressed would make the
      // same press do different things for a reason nothing here shows. Home
      // is the one page the Sammlung itself names, and the notice names it too.
      return shareFirstColumn(into, into.home).length;
    }
    if (!column && shared(into)) spreadFirstColumn(into);
    return 0;
  };

  const go = document.createElement("button");
  go.type = "button";
  go.onclick = () => {
    // The first column first, then the size: the same order trial() counted
    // in, so that what the notices said is what happens.
    share(layout);
    // resize() is what drops whatever is outside; it is also what clamps a
    // size into the bounds, so it runs whether or not anything moved.
    resize(layout, size.rows, size.columns);
    layout.wordColor = colour;
    // Absent rather than false, so a Sammlung that never asked for the gap
    // stays a Sammlung with no such field - which is what data/app_package.ts
    // reads when it decides whether to write the hint at all.
    if (gap) layout.firstColumnGap = true;
    else delete layout.firstColumnGap;
    commit();
    /* The panel stays where it is, so it is drawn again against what it has
     * just written rather than left showing a pending change that is no longer
     * pending: the heading takes the new size, the notices that counted the
     * cost have nothing left to count, and the button goes back to its
     * ordinary words. The two switches and the colour are already what they
     * were set to; the size and the column are read back off the layout,
     * because resize() clamps and share() is what decides the answer. */
    size = { ...layout.grid };
    column = shared(layout);
    draw();
  };

  /* The foot of the panel, and drawn as one.
   *
   * One press applies everything above it - the size, how a word class is
   * worn, and whether the first column belongs to the Sammlung - so it may not
   * look like it belongs to whichever control happens to sit directly over it.
   * A rule across the panel and the button at the far end says "this is the
   * end of the panel", which is the same shape the sheet's own foot uses one
   * level up. */
  const row = document.createElement("div");
  row.className = "row row--apply";
  row.appendChild(go);

  /* Redrawn whole on each choice, because the two things that follow from one
   * are a pressed state somewhere else in the row and a number in a sentence -
   * and threading those through by hand is how a panel comes to disagree with
   * itself. There is nothing to type in here, so there is no caret to lose. */
  const draw = (): void => {
    const why = document.createElement("p");
    why.className = "note";
    why.textContent = t("ui.app_grid_all_pages");

    const { dropped, lost } = trial();
    const body: HTMLElement[] = [why, sizeChoices(size, (picked) => {
      size = picked;
      draw();
    })];

    // The same sentence the question used to ask on its own, said while the
    // choice is still open rather than after it. It names the number, because
    // the buttons that would go may be on a page nobody is looking at.
    if (lost) {
      const notice = document.createElement("div");
      notice.className = "notice bad";
      notice.textContent = t(lost === 1 ? "ui.app_grid_shrink_ask_one"
                                        : "ui.app_grid_shrink_ask",
                             { n: lost, rows: size.rows, cols: size.columns });
      body.push(notice);
    }

    const rule = document.createElement("hr");
    rule.className = "cardrule";
    const what = document.createElement("span");
    what.className = "lbl";
    what.textContent = t("ui.app_word_color");
    body.push(rule, what);

    /* Three alternatives, drawn the way the button sheet draws its four: one
     * radio group, so that which one is in force is said by the markup rather
     * than only by the colour it is drawn in. */
    const choices = document.createElement("div");
    choices.className = "opts";
    choices.setAttribute("role", "radiogroup");
    choices.setAttribute("aria-label", t("ui.app_word_color"));
    for (const one of ["fill", "border", "off"] as const) {
      const opt = document.createElement("label");
      opt.className = "opts__opt";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "appWordColor";
      radio.value = one;
      radio.checked = one === colour;
      const head = document.createElement("b");
      head.textContent = t(`ui.app_word_color_${one}`);
      const note = document.createElement("small");
      note.textContent = t(`ui.app_word_color_${one}_note`);
      opt.append(radio, head, note);
      radio.onchange = () => { if (radio.checked) colour = one; };
      choices.appendChild(opt);
    }
    body.push(choices);

    /* --- the first column ------------------------------------------------ */

    const rule2 = document.createElement("hr");
    rule2.className = "cardrule";
    const which = document.createElement("span");
    which.className = "lbl";
    which.textContent = t("ui.app_first_column");
    body.push(rule2, which);

    /* Two switches rather than one, and the second is only about drawing.
     *
     * They are not the same decision. The column being on every page is what
     * MetaTalk's handbook is describing when it says those keys stay reachable
     * - it is behaviour, and it is what the buttons themselves are. The gap is
     * the mark that says so to somebody looking at the board, and
     * exchange/SPEC.md §4.1 keeps them apart for the same reason: the
     * persistence needs no field because a builder repeats the buttons, and
     * the hint is a hint. Merging them into one switch would make the mark
     * unavailable to a Sammlung that repeats its column by hand, and would
     * make it impossible to see the column plainly for a moment.
     *
     * A checkbox in the shape the three word-colour choices above take, so
     * that the whole card reads as one list of decisions rather than as two
     * kinds of control that happen to share a sheet. */
    const switches = document.createElement("div");
    switches.className = "opts";
    switches.setAttribute("role", "group");
    switches.setAttribute("aria-label", t("ui.app_first_column"));
    /* The whole key, not the half after `ui.`. Building it here saved four
     * characters at each call and cost the file its greppability: a text key
     * that is never written out anywhere is a text key nothing can find, and
     * for as long as this line said `ui.${key}` every one of the 500-odd
     * entries in boot_data.ts looked reachable to anything reading the source.
     * tests/test_texts_used.py is what reads it now, and this is the shape it
     * needs - a key is either written out or it is built from a prefix long
     * enough to name a family. */
    const flag = (key: string, on: boolean, set: (on: boolean) => void,
                  note: string): void => {
      const opt = document.createElement("label");
      opt.className = "opts__opt";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = on;
      const head = document.createElement("b");
      head.textContent = t(key);
      const hint = document.createElement("small");
      hint.textContent = note;
      opt.append(box, head, hint);
      box.onchange = () => { set(box.checked); draw(); };
      switches.appendChild(opt);
    };
    flag("ui.app_first_column_share", column, (on) => { column = on; },
         t("ui.app_first_column_share_note"));
    flag("ui.app_first_column_gap", gap, (on) => { gap = on; },
         t(column ? "ui.app_first_column_gap_note"
                  : "ui.app_first_column_gap_note_alone"));
    body.push(switches);

    /* What taking one page's column over the rest costs, counted while the
     * choice is still open. The same shape the shrink notice takes above, and
     * for the same reason: the columns that go are on pages nobody is looking
     * at, and the start page is named because which page is kept is the whole
     * of what somebody needs to predict here. */
    if (dropped) {
      const notice = document.createElement("div");
      notice.className = "notice bad";
      notice.textContent = t(dropped === 1 ? "ui.app_first_column_take_one"
                                           : "ui.app_first_column_take",
                             { n: dropped });
      body.push(notice);
    }
    // Turning it off costs nothing and says so: the column is written onto
    // every page, which is what the export has been doing with it all along,
    // so every page keeps exactly the buttons it was drawn with.
    if (!column && shared(layout)) {
      const notice = document.createElement("div");
      notice.className = "notice";
      notice.textContent = t("ui.app_first_column_spread");
      body.push(notice);
    }

    body.push(row);
    into.replaceChildren(...body);

    /* The heading says the size the Sammlung *is* at, not the one that is
     * pending: a state line is what a panel would answer folded, and folded
     * there is no pending anything. Which size is picked is said where it is
     * picked, by the pressed option, and what pressing the button would cost
     * is said by the notices between the two. */
    heading(t("ui.app_grid"),
            `${layout.grid.rows} × ${layout.grid.columns}`);

    /* Labelled with the act rather than with "OK", and drawn as the danger it
     * is exactly when it is one: the same press applies a colour and throws
     * buttons away, and only the second of those needs saying.
     *
     * Two acts can now be the one that throws them away, and they get
     * different words - "make it smaller" on a press that takes the first
     * column would name the wrong half. The size wins where both are pending,
     * because it is the one whose number is the larger reading of the same
     * press: every button the column costs is already inside the grid, and the
     * notices above have said which number is whose either way. */
    go.className = lost || dropped ? "btn destructive filled" : "btn primary";
    go.textContent = t(lost ? "ui.app_grid_shrink_go"
                       : dropped ? "ui.app_first_column_take_go"
                       : "ui.app_grid_apply");
  };
  draw();
}

/**
 * The three ways a board can answer a touch, and the two milliseconds each one
 * means.
 *
 * **The same three the tablet offers, with the same names and the same
 * numbers**, and that is the whole point of them being here rather than two
 * lists of millisecond steps. Those lists could not express two of these modes
 * at all - 600 was not among the pauses and 400 was not among the holds - so a
 * Sammlung authored here could never carry what the viewer's own settings did,
 * and the viewer, asked to name what a package wanted, had to guess at the
 * nearest one and could land on "Sofort" for a board with an 800 ms hold on it.
 *
 * The split that produced that was invented: an author who thinks in
 * milliseconds and a parent who does not are, here, the same person. So there is
 * one vocabulary, and this is it.
 *
 * Ordered by what each costs. Once is a pause after a press and is not felt
 * until the *next* word; Held adds a wait before every word there is. Somebody
 * walks down the list and stops at the first that works.
 *
 * Every value stays inside MAX_PRESS_TIMING_MS, where SPEC.md §7.5 clamps.
 */
const PRESS_MODES = [
  { key: "at_once", hold: 0, release: 0 },
  { key: "once", hold: 0, release: 600 },
  { key: "held", hold: 400, release: 800 },
] as const;

/** Which mode a layout is at. Absent counts as the first, which is what absent
 *  means in the format too (SPEC.md §7.5: 0 is off). A layout carrying anything
 *  else - hand-edited, or from an older build of this editor - matches none and
 *  the panel says so rather than pretending. */
function pressModeOf(layout: AppLayout): string | null {
  const hold = layout.holdTimeMs ?? 0;
  const release = layout.releaseTimeMs ?? 0;
  return PRESS_MODES.find((m) => m.hold === hold && m.release === release)?.key
    ?? null;
}

/**
 * Bedienung: when a press on the tablet counts. exchange/SPEC.md §4.1 and §7.5,
 * written into the package as ext_lautstark_hold_time_ms and
 * ext_lautstark_release_time_ms.
 *
 * **Its own panel rather than a third block under Raster**, which was the
 * cheaper option and the wrong one. That panel's heading is "Raster" and its
 * state line is a grid size, so a motor-access setting filed under it is filed
 * where nobody looking for it would look. It also holds its changes behind an
 * apply button, which exists there because resizing a grid throws buttons away
 * - these destroy nothing, so they apply on touch like every other setting on
 * this sheet.
 *
 * Drawn as the bordered .opts rows the word colour uses rather than as the chip
 * row this panel had: three choices that each need a sentence explaining them
 * are what that component is for, and it is what the viewer's own screen draws
 * the same three in.
 */
export function accessPanel(into: HTMLElement,
                            heading: (section: string, state: string) => void): void {
  const layout = board();

  /* Written out one key at a time rather than built from the mode's own,
   * because tests/test_texts_used.py reads this file for literal keys and one
   * assembled from a variable is a key nothing can find. */
  const named = (key: string): string =>
    key === "at_once" ? t("ui.app_press_at_once")
    : key === "once" ? t("ui.app_press_once")
    : t("ui.app_press_held");
  const explained = (key: string): string =>
    key === "at_once" ? t("ui.app_press_at_once_note")
    : key === "once" ? t("ui.app_press_once_note")
    : t("ui.app_press_held_note");

  const draw = (): void => {
    const why = document.createElement("p");
    why.className = "note";
    why.textContent = t("ui.app_press_tablet_only");

    const choices = document.createElement("div");
    choices.className = "opts";
    choices.setAttribute("role", "radiogroup");
    choices.setAttribute("aria-label", t("ui.app_press"));

    const now = pressModeOf(layout);
    for (const mode of PRESS_MODES) {
      const opt = document.createElement("label");
      opt.className = "opts__opt";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "appPressMode";
      radio.value = mode.key;
      radio.checked = mode.key === now;
      const head = document.createElement("b");
      head.textContent = named(mode.key);
      const note = document.createElement("small");
      note.textContent = explained(mode.key);
      opt.append(radio, head, note);
      radio.onchange = () => {
        if (!radio.checked) return;
        /* Absent rather than 0, so a Sammlung asking for nothing carries no
         * such field - which is what data/app_package.ts reads when it decides
         * whether to write the manifest entry at all, and what keeps 1.3.0 a
         * minor version for every package written before it. */
        if (mode.hold) layout.holdTimeMs = mode.hold;
        else delete layout.holdTimeMs;
        if (mode.release) layout.releaseTimeMs = mode.release;
        else delete layout.releaseTimeMs;
        commit();
        // Redrawn rather than the checked state moved by hand, so the state
        // line in the summary agrees with what has just been chosen.
        draw();
      };
      choices.appendChild(opt);
    }

    into.replaceChildren(why, choices);
    /* The mode's own name, or - for a layout carrying values no mode has - the
     * two numbers, because naming the nearest mode would be telling somebody
     * their board does something it does not. */
    heading(t("ui.app_press"),
            now !== null
              ? named(now)
              : t("ui.app_press_own", { hold: layout.holdTimeMs ?? 0,
                                        release: layout.releaseTimeMs ?? 0 }));
  };
  draw();
}
