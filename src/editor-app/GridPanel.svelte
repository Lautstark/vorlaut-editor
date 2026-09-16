<script lang="ts">
  /** The panel that holds what is true of the whole Sammlung: how big a page is,
   * how a word class is worn, and what the first column is.
   *
   * Every one of them is one decision for every page, which is why none belongs
   * in the bar over the board where everything else is about the *page* on
   * screen. They share a panel for the same reason they are the same kind of
   * decision: made once, and then in force wherever somebody goes.
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
   * is the way out, and what is pending lives only in this component, which the
   * sheet unmounts when it closes, so closing it is declining it.
   */
  import { t } from "../shell/live.svelte.js";
  import Sizes from "../shell/pieces/Sizes.svelte";
  import type { AppLayout, GridSize } from "../core/types.js";
  import { outside, resize, shareFirstColumn, shared, spreadFirstColumn } from "./pages.js";
  import { board, commit, wordColor } from "./standing.svelte.js";

  const layout = $derived(board());

  let size = $state<GridSize>({ ...board().grid });
  let colour = $state(wordColor(board()));
  let column = $state(shared(board()));
  let gap = $state(board().firstColumnGap === true);

  /** The first-column half of the pending changes, in the order apply() runs
   *  it: before the resize, so that what the resize then counts is the board
   *  the column has already been made into. Answers how many buttons the
   *  sharing itself took. */
  function share(into: AppLayout): number {
    if (column && !shared(into)) {
      // The home page's column, not the page somebody happens to be standing
      // on. This panel is opened from the Sammlung's menu and shows no board,
      // so a source that depended on which tab was last pressed would make the
      // same press do different things for a reason nothing here shows. Home
      // is the one page the Sammlung itself names, and the notice names it too.
      return shareFirstColumn(into, into.home).length;
    }
    if (!column && shared(into)) spreadFirstColumn(into);
    return 0;
  }

  /* What the pending choices would do, applied to a copy.
   *
   * A copy rather than arithmetic over the real layout, because the two
   * destructive halves overlap: a button in another page's first column can
   * *also* be outside a smaller grid, and two sentences each counting it would
   * between them claim two buttons are going when one is. Applying the same
   * sequence apply() will apply, to a throwaway, is the only way to count what
   * actually happens - and the pages are small enough that doing it on every
   * redraw costs nothing worth measuring.
   *
   * structuredClone() of the layout rather than of a snapshot, and that is not
   * an oversight: shell/live.svelte.ts holds the layout as the plain object it
   * always was rather than as a `$state` proxy, precisely so that this line, the
   * save loop and IndexedDB all go on working unchanged. */
  const trial = $derived.by(() => {
    const copy = structuredClone(layout);
    const dropped = share(copy);
    return { dropped, lost: outside(copy, size.rows, size.columns).length };
  });

  function apply(): void {
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
       just written rather than left showing a pending change that is no longer
       pending. The two switches and the colour are already what they were set
       to; the size and the column are read back off the layout, because
       resize() clamps and share() is what decides the answer. */
    size = { ...layout.grid };
    column = shared(layout);
  }

  /* Labelled with the act rather than with "OK", and drawn as the danger it is
     exactly when it is one: the same press applies a colour and throws buttons
     away, and only the second of those needs saying.
     Two acts can now be the one that throws them away, and they get different
     words - "make it smaller" on a press that takes the first column would name
     the wrong half. The size wins where both are pending, because it is the one
     whose number is the larger reading of the same press: every button the
     column costs is already inside the grid. */
  const go = $derived(trial.lost ? t("ui.app_grid_shrink_go")
    : trial.dropped ? t("ui.app_first_column_take_go")
    : t("ui.app_grid_apply"));
</script>

<p class="note">{t("ui.app_grid_all_pages")}</p>
<Sizes chosen={size} onPick={(picked) => { size = picked; }} />

<!-- The same sentence the question used to ask on its own, said while the
     choice is still open rather than after it. It names the number, because the
     buttons that would go may be on a page nobody is looking at. -->
{#if trial.lost}<div class="notice bad">{t(trial.lost === 1 ? "ui.app_grid_shrink_ask_one" : "ui.app_grid_shrink_ask", { n: trial.lost, rows: size.rows, cols: size.columns })}</div>{/if}

<hr class="cardrule" />
<span class="lbl">{t("ui.app_word_color")}</span>
<!-- Three alternatives, drawn the way the button sheet draws its four: one
     radio group, so that which one is in force is said by the markup rather
     than only by the colour it is drawn in. -->
<div class="opts" role="radiogroup" aria-label={t("ui.app_word_color")}>{#each ["fill", "border", "off"] as const as one (one)}<label class="opts__opt"><input type="radio" name="appWordColor" value={one} checked={one === colour} onchange={(e) => { if (e.currentTarget.checked) colour = one; }} /><b>{t(one === "fill" ? "ui.app_word_color_fill" : one === "border" ? "ui.app_word_color_border" : "ui.app_word_color_off")}</b><small>{t(one === "fill" ? "ui.app_word_color_fill_note" : one === "border" ? "ui.app_word_color_border_note" : "ui.app_word_color_off_note")}</small></label>{/each}</div>

<hr class="cardrule" />
<span class="lbl">{t("ui.app_first_column")}</span>
<!-- Two switches rather than one, and the second is only about drawing.
     They are not the same decision. The column being on every page is what
     MetaTalk's handbook is describing when it says those keys stay reachable -
     it is behaviour, and it is what the buttons themselves are. The gap is the
     mark that says so to somebody looking at the board, and exchange/SPEC.md
     §4.1 keeps them apart for the same reason: the persistence needs no field
     because a builder repeats the buttons, and the hint is a hint. Merging them
     into one switch would make the mark unavailable to a Sammlung that repeats
     its column by hand, and would make it impossible to see the column plainly
     for a moment.
     A checkbox in the shape the three word-colour choices above take, so that
     the whole panel reads as one list of decisions rather than as two kinds of
     control that happen to share a sheet. -->
<div class="opts" role="group" aria-label={t("ui.app_first_column")}><label class="opts__opt"><input type="checkbox" checked={column} onchange={(e) => { column = e.currentTarget.checked; }} /><b>{t("ui.app_first_column_share")}</b><small>{t("ui.app_first_column_share_note")}</small></label><label class="opts__opt"><input type="checkbox" checked={gap} onchange={(e) => { gap = e.currentTarget.checked; }} /><b>{t("ui.app_first_column_gap")}</b><small>{t(column ? "ui.app_first_column_gap_note" : "ui.app_first_column_gap_note_alone")}</small></label></div>

<!-- What taking one page's column over the rest costs, counted while the choice
     is still open. The same shape the shrink notice takes above, and for the
     same reason: the columns that go are on pages nobody is looking at, and the
     start page is named because which page is kept is the whole of what
     somebody needs to predict here. -->
{#if trial.dropped}<div class="notice bad">{t(trial.dropped === 1 ? "ui.app_first_column_take_one" : "ui.app_first_column_take", { n: trial.dropped })}</div>{/if}
<!-- Turning it off costs nothing and says so: the column is written onto every
     page, which is what the export has been doing with it all along, so every
     page keeps exactly the buttons it was drawn with. -->
{#if !column && shared(layout)}<div class="notice">{t("ui.app_first_column_spread")}</div>{/if}

<!-- The foot of the panel, and drawn as one. One press applies everything above
     it - the size, how a word class is worn, and whether the first column
     belongs to the Sammlung - so it may not look like it belongs to whichever
     control happens to sit directly over it. A rule across the panel and the
     button at the far end says "this is the end of the panel", which is the same
     shape the sheet's own foot uses one level up. -->
<div class="row row--apply"><button type="button" class={trial.lost || trial.dropped ? "btn destructive filled" : "btn primary"} onclick={apply}>{go}</button></div>
