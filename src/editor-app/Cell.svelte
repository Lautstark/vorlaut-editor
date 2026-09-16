<script lang="ts">
  /** One cell of the board: what is in it, what a press does, and the two
   *  controls that sit in its corners.
   *
   * The cell is a box, not a control. It holds two controls side by side: one
   * filling it, and - once there is something to hear - one in the corner that
   * plays. Nesting the second inside the first would be a control inside a
   * control, which no keyboard can reach and no markup validator allows.
   */
  import { t } from "../shell/live.svelte.js";
  import { speak } from "../shell/speech.js";
  import { HOME_TONES } from "../shell/homekey.js";
  import Negate from "../shell/pieces/Negate.svelte";
  import Picture from "../shell/pieces/Picture.svelte";
  import { appends } from "../data/app_package.js";
  import type { AppPage } from "../core/types.js";
  import { moveButton, moveShared, pageById } from "./pages.js";
  import { actBadge, actKey, classColor } from "./marks.js";
  import { editButton } from "./buttonSheet.svelte.js";
  import {
    board, cellHolder, commit, goToPage, inColumn, pageName, wordColor,
  } from "./standing.svelte.js";
  import {
    dragged, endDrag, hover, hovering, startDrag, takesDrop, unhover,
  } from "./grid.svelte.js";

  let { on, row, col }: { on: AppPage; row: number; col: number } = $props();

  /* A shallow copy of the button rather than the button itself.
   *
   * Everything below reads fields off it, and a `$derived` holding the record
   * would never say anything changed: the layout is mutated in place, so the
   * object at this seat is the same object before and after the sheet writes a
   * new word onto it. A copy is a different object every time, which is what a
   * derived propagates on. See the head of shell/live.svelte.ts.
   *
   * It is read-only by construction, which is the other half of why this is
   * safe: nothing here writes to a button. The three handlers that move one -
   * the drop, the keyboard move, the press that opens the sheet - ask
   * cellHolder() again at the moment of the press. */
  const held = $derived.by(() => {
    const one = cellHolder(on, row, col);
    return one ? { ...one } : undefined;
  });

  /* What a screen reader calls the cell. A button carrying a picture and no
     word is a deliberate button rather than an unfinished one, so it is not
     announced as empty: what it says when pressed names it, and where it says
     nothing the picture is named as the whole of it. Only a button with neither
     is empty. */
  const named = $derived(!held ? ""
    : held.label || (held.symbol ? held.vocalization.trim() || t("ui.app_button_symbol") : ""));

  /* The word class, worn as the Sammlung says: a fill, a border, or nothing.
   *
   * Two different custom properties rather than one and a class on the grid,
   * because the fill is what decides the *text* colour - a label over a light
   * Fitzgerald fill is dark whatever the theme is, and a label on a bordered
   * cell is the theme's own. ui.css keys both off which property is set, so a
   * cell cannot end up dark text on a dark surface by having the class and not
   * the fill. "off" sets neither, and the cell is left as any other. */
  const colour = $derived(held ? classColor(held.wordClass) : "");
  const fill = $derived(colour && wordColor(board()) === "fill" ? colour : "");
  const edge = $derived(colour && wordColor(board()) === "border" ? colour : "");

  /* The one cell whose look is the viewer's rather than the collection's.
   *
   * Everything else on this board is a word: paper under the picture because
   * AAC symbols are drawn for white, a Fitzgerald tint saying which kind of
   * word, the label spelling it. A start key is none of those, and the tablet
   * draws it as what it is - the picture's luminance on a dark plate, the same
   * two tones the bar controls wear. Until this class existed the editor drew it
   * as a word anyway, so the one cell the editor could not preview was the one
   * cell that does not look like its own picture.
   *
   * The condition is BoardScreen.kt's `chrome`, restated rather than
   * approximated, because the two have to answer alike on the same button: a
   * bare `home` (an appending one really is a word, and keeps its paper and its
   * tint), and no fill and no border (a key wearing a colour has been given one
   * on purpose, and neither renderer takes it away for the sake of a default).
   *
   * The plate comes from HOME_TONES for the reason Pick.svelte gives at its own
   * copy of this line: it is the tablet's colour, not a theme token. */
  const chrome = $derived(!!held && held.act.kind === "home"
    && held.act.alsoAppend !== true && !fill && !edge);

  /** What the tablet would say, where there is anything. The four bar controls
   *  speak nothing when pressed, and nor does a navigation button - unless it
   *  is one that carries its word into the sentence on the way, which speaks
   *  exactly like the word button it also is. Offering to audition any of the
   *  others would be offering silence. */
  const saying = $derived(held ? (held.vocalization || held.label).trim() : "");
  const plays = $derived(!!held && !!saying
    && (appends(held.act) || held.act.kind === "speak"));
  /* The ring says the word is spoken at once and the sentence bar is left alone
     - §7.3's `speak`. It marks the exception, because almost every button on a
     board feeds the bar and marking that would be marking everything. */
  const atOnce = $derived(held?.act.kind === "speak");
  const playSays = $derived(t(atOnce ? "ui.play_at_once" : "ui.play_title"));

  const badge = $derived(held ? actBadge(held.act) : "");
  /** Where a navigation button leads, if the page is still there. */
  const to = $derived(held && held.act.kind === "goto"
    ? pageById(board(), held.act.page) : undefined);

  /* Placed rather than left to auto-flow, but only while the gap is drawn.
   *
   * .grid--gap puts a real spacer track between the first column and the
   * second, which is the only way to set a column apart without making it
   * narrower than the ones beside it - a margin comes out of the cell, and a
   * first column 5% short of the rest is a board that looks slightly wrong
   * rather than deliberately spaced. A spacer track is a track, though, and
   * auto-flow would drop the second cell of every row into it. So every cell
   * says which track it is in, and the empty one stays empty. */
  const track = $derived(board().firstColumnGap === true
    ? String(col === 0 ? 1 : col + 2) : "");

  const style = $derived([
    fill && `--cell-color:${fill}`,
    edge && `--cell-edge:${edge}`,
    chrome && `--home-plate:${HOME_TONES.plate}`,
    /* The strokes' tone, for the things on the plate that are not the picture -
       the act badge in the corner. The picture gets there through the filter
       instead, which is the same two numbers by the other route. */
    chrome && `--home-ink:${HOME_TONES.light}`,
    track && `grid-column:${track}`,
  ].filter(Boolean).join(";"));

  /* The sheet opens with nothing filled in, and the button comes into being on
     Fertig. Pressing an empty cell used to mint one immediately, which meant an
     accidental press left a blank button on the board - and a dialog somebody
     closes must cost nothing. */
  const open = (): void => { void editButton(held ? held.row : row, held ? held.col : col); };

  function dropped(event: DragEvent): void {
    event.preventDefault();
    const id = dragged();
    const takes = takesDrop(on, row, col);
    endDrag();
    if (id === null || !takes) return;
    if (inColumn(col)) moveShared(board(), id, row);
    else moveButton(on, id, row, col);
    commit();
  }

  /* Alt and an arrow moves a button one cell, which is the same key this
   * product already uses to reorder the talker's sets. The alternative -
   * editor-diy's arm-with-Enter, drop-with-Enter - reads well on four keys in a
   * fixed square and badly on sixty-six, where the two ends of the gesture can
   * be a screen apart.
   *
   * Claimed even where the move has nowhere to go: Alt+Left is history-back in
   * some engines, and rearranging a board must never walk off the page. */
  function pressed(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
      return;
    }
    const one = cellHolder(on, row, col);
    if (!one) return;
    const step = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0],
                    ArrowLeft: [0, -1], ArrowRight: [0, 1] } as const)[
                      event.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"];
    if (!event.altKey || !step) return;
    event.preventDefault();
    const grid = board().grid;
    const at = [one.row + step[0], one.col + step[1]] as const;
    if (at[0] < 0 || at[0] >= grid.rows || at[1] < 0 || at[1] >= grid.columns) return;
    /* The keyboard move stops at the same boundary the drag does, and stopping
       is all it does: a shared button walks its own column, and a page button
       may not walk into it. */
    if (inColumn(at[1]) !== inColumn(one.col)) return;
    if (inColumn(one.col)) moveShared(board(), one.id, at[0]);
    else moveButton(on, one.id, at[0], at[1]);
    commit();
    /* Focus follows the button rather than staying at the coordinate, which is
       what makes a run of presses move one thing across the board. The elements
       are keyed by the button's id now, so what has to be found is the cell the
       button landed in - and its widget is the one thing in it that takes
       focus. */
    const seat = (event.currentTarget as HTMLElement).closest(".grid")
      ?.children[(at[0] * grid.columns) + at[1]];
    (seat?.querySelector(".cell__open") as HTMLElement | null)?.focus();
  }
</script>

<!-- `cell--first` is what the gap is drawn against - see .grid--gap. On the
     cell rather than by counting children in CSS, because nth-child cannot be
     told how wide the grid is. -->
<div
  class="cell"
  class:cell--first={col === 0}
  class:cell--shared={inColumn(col)}
  class:cell--empty={!held}
  class:cell--words={!!held && !held.symbol}
  class:cell--tohome={held?.act.kind === "home"}
  class:cell--home={chrome}
  class:dragover={hovering(row, col)}
  style={style || undefined}
  title={held ? undefined : t("ui.app_button_add")}
  draggable={held ? true : undefined}
  ondragover={(event) => { if (takesDrop(on, row, col)) { event.preventDefault(); hover(row, col); } }}
  ondragleave={() => unhover(row, col)}
  ondrop={dropped}
  ondragstart={(event) => {
    if (!held) return;
    startDrag(held.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", held.id);
    }
  }}
  ondragend={endDrag}
  role="presentation"
><!-- The widget inside a cell: what a press lands on. A div wearing
     role="button" rather than a <button>, for the reason editor-diy's gives:
     its parent is dragged, and a real button captures the mousedown that would
     start the drag. So the two things the element would have brought - a place
     in the tab order, and acting on Enter and Space - are written out here.
     `aria-haspopup="dialog"` says what a press actually does. This was
     aria-pressed while the panel existed, which described a button that stays
     down - and once every cell opened a sheet instead, a screen reader was
     announcing a toggle state for something that toggles nothing. --><div class="cell__open" role="button" tabindex="0" aria-label={held ? (named || t("ui.app_button_empty")) : t("ui.app_button_add")} aria-haspopup="dialog" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" onclick={open} onkeydown={pressed}></div>{#if held}{#if held.symbol}{#if held.negated}<!-- Crossed out, and only then wrapped: the cross has to be the size of the
     picture rather than of the cell - see .cell__crossed - and an ordinary
     button keeps the <img> as its own flex item. --><span class="cell__crossed"><Picture symbol={held.symbol} className="cell__pic" /><Negate /></span>{:else}<Picture symbol={held.symbol} className="cell__pic" />{/if}{/if}<!-- The word, where there is one. A picture with no word is ordinary AAC and
     the format allows it - exchange/SPEC.md §7.2 - so nothing stands in for the
     word that is not there. -->{#if held.label}<span class="cell__word">{held.label}</span>{/if}<!-- What the button does, where it is not the default. An appending button is
     the common case and carries no mark: marking every ordinary cell would make
     the marks worth nothing. -->{#if badge}<span class="cell__act" title={t(`ui.app_act_${actKey(held.act.kind)}`)}>{badge}</span>{/if}<!-- Hearing it, without opening anything. The five-key editor has had a play
     button on every key since it was written, and it is what somebody uses
     while looking at the board to check it reads right. A real <button>,
     because nothing drags it. -->{#if plays}<button type="button" class="cell__play{atOnce ? ' cell__play--now' : ''}" title={playSays} aria-label={playSays} onclick={(event) => { event.stopPropagation(); void speak(saying, event.currentTarget); }}>▶</button>{/if}<!-- And the corner that follows a navigation button.
     **Top right, and the play control is top left.** Both seats are fixed and
     neither moves for the other: a `goto` button that carries its word into the
     sentence on the way - §7.3's `ext_lautstark_append_on_navigate` - has
     something to audition *and* a page to follow.
     The act badge shares this seat rather than the play control's, and that is
     forced rather than chosen: the play control is the one thing that turns up
     beside either of the other two, so it needs the seat nobody else uses. A
     `goto` has carried no badge since this corner replaced its arrow, so these
     two can never meet. ui.css has the table.
     The press itself still opens the button's own sheet: a `goto` button that
     navigated when pressed would be the one button on the board nobody could
     ever edit. -->{#if to}<button type="button" class="cell__follow" title={t("ui.page_follow", { name: pageName(to) })} aria-label={t("ui.page_follow", { name: pageName(to) })} onclick={(event) => { event.stopPropagation(); goToPage(to.id); }}>›</button>{/if}{/if}</div>
