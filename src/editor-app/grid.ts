/* --- The grid ------------------------------------------------------------ */
import { byId, negationCross } from "../shell/dom.js";
import { symbolInto } from "../backend/index.js";
import type { AppPage } from "../core/types.js";
import { t } from "../core/texts.js";
import { speak } from "../shell/speech.js";
import { missing } from "../shell/sheet.js";
import { HOME_TONES } from "../shell/homekey.js";
import { appends } from "../data/app_package.js";
import { isShared, moveButton, moveShared, pageById } from "./pages.js";
import { actBadge, actKey, classColor } from "./marks.js";
import { editButton } from "./buttonSheet.js";
import {
  board, cellHolder, commit, goToPage, inColumn, page, pageName, wordColor,
} from "./standing.js";

/** The button being dragged, by id. Null when nothing is. */
let dragging: string | null = null;

export function drawGrid(): void {
  // A drag does not survive a redraw: the element that carried it is thrown
  // away with the rest of the grid.
  dragging = null;
  const layout = board();
  const grid = byId("appGrid");
  grid.innerHTML = "";
  grid.style.setProperty("--rows", String(layout.grid.rows));
  grid.style.setProperty("--cols", String(layout.grid.columns));
  /* The gap the package asks a viewer for, drawn here too - see
   * AppLayout.firstColumnGap. The board on this screen is a picture of the
   * board on the tablet, and a hint that only showed up after export would be
   * a setting somebody had to take on faith. */
  grid.classList.toggle("grid--gap", layout.firstColumnGap === true);

  for (let row = 0; row < layout.grid.rows; row++) {
    for (let col = 0; col < layout.grid.columns; col++) {
      grid.appendChild(cell(page(), row, col));
    }
  }
}

/** Every cell is a drop target, filled or not: dropping onto an empty one is
 *  a move and onto a full one is a swap, and both are the same gesture.
 *
 * Except across the two regions a shared first column makes of the board. A
 * button dragged out of that column would stop being on every page, and one
 * dragged into it would start being on all of them - which is not a move, it
 * is a change of what the button *is*, and no drag should carry that much. So
 * the cell simply does not become a drop target, which is the same silent "no"
 * this function already gives a button dropped where it already sits.
 */
function acceptsDrop(box: HTMLElement, on: AppPage, row: number, col: number): void {
  const takes = (id: string): boolean =>
    isShared(board(), id) === inColumn(col);
  box.ondragover = (event) => {
    if (dragging === null || !takes(dragging)) return;
    const already = cellHolder(on, row, col);
    if (already && already.id === dragging) return;
    // Only a prevented dragover marks an element as a drop target at all.
    event.preventDefault();
    box.classList.add("dragover");
  };
  box.ondragleave = () => box.classList.remove("dragover");
  box.ondrop = (event) => {
    event.preventDefault();
    clearDragMarks();
    if (dragging === null || !takes(dragging)) return;
    const id = dragging;
    dragging = null;
    if (inColumn(col)) moveShared(board(), id, row);
    else moveButton(on, id, row, col);
    commit();
  };
}

function clearDragMarks(): void {
  for (const one of document.querySelectorAll(".cell.dragover")) {
    one.classList.remove("dragover");
  }
}

/** The widget inside a cell: what a press lands on.
 *
 * A div wearing role="button" rather than a <button>, for the reason
 * editor-diy's tabs give: its parent is dragged, and a real button captures
 * the mousedown that would start the drag. So the two things the element would
 * have brought - a place in the tab order, and acting on Enter and Space - are
 * written out at each call site. */
function opener(label: string): HTMLElement {
  const hit = document.createElement("div");
  hit.className = "cell__open";
  hit.setAttribute("role", "button");
  hit.tabIndex = 0;
  hit.setAttribute("aria-label", label);
  /* What a press actually does, said rather than left to be found out. This
   * was aria-pressed while the panel existed, which described a button that
   * stays down - and once every cell opened a sheet instead, a screen reader
   * was announcing a toggle state for something that toggles nothing. */
  hit.setAttribute("aria-haspopup", "dialog");
  return hit;
}

function cell(on: AppPage, row: number, col: number): HTMLElement {
  const held = cellHolder(on, row, col);
  /* The cell is a box, not a control. It holds two controls side by side: one
   * filling it, and - once there is something to hear - one in the corner that
   * plays. Nesting the second inside the first would be a control inside a
   * control, which no keyboard can reach and no markup validator allows. */
  const box = document.createElement("div");
  box.className = "cell";
  // What the gap is drawn against - see .grid--gap. On the cell rather than
  // by counting children in CSS, because nth-child cannot be told how wide the
  // grid is.
  if (col === 0) box.classList.add("cell--first");
  if (inColumn(col)) box.classList.add("cell--shared");
  /* Placed rather than left to auto-flow, but only while the gap is drawn.
   *
   * .grid--gap puts a real spacer track between the first column and the
   * second, which is the only way to set a column apart without making it
   * narrower than the ones beside it - a margin comes out of the cell, and a
   * first column 5% short of the rest is a board that looks slightly wrong
   * rather than deliberately spaced. A spacer track is a track, though, and
   * auto-flow would drop the second cell of every row into it. So every cell
   * says which track it is in, and the empty one stays empty. */
  if (board().firstColumnGap === true) {
    box.style.gridColumn = String(col === 0 ? 1 : col + 2);
  }
  acceptsDrop(box, on, row, col);

  if (!held) {
    box.classList.add("cell--empty");
    box.title = t("ui.app_button_add");
    const hit = opener(t("ui.app_button_add"));
    box.appendChild(hit);
    /* The sheet opens with nothing filled in, and the button comes into being
     * on Fertig. Pressing an empty cell used to mint one immediately, which
     * meant an accidental press left a blank button on the board - and a
     * dialog somebody closes must cost nothing. */
    const make = () => { void editButton(row, col); };
    hit.onclick = make;
    hit.onkeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      make();
    };
    return box;
  }

  /* What a screen reader calls the cell. A button carrying a picture and no
   * word is a deliberate button rather than an unfinished one, so it is not
   * announced as empty: what it says when pressed names it, and where it says
   * nothing the picture is named as the whole of it. Only a button with
   * neither is empty. */
  const named = held.label
    || (held.symbol ? held.vocalization.trim() || t("ui.app_button_symbol") : "");
  const hit = opener(named || t("ui.app_button_empty"));
  // A word with no picture is its own kind of button, and takes the room the
  // picture would have had. The class carries it; see .cell--words.
  box.classList.toggle("cell--words", !held.symbol);
  box.appendChild(hit);
  /* The word class, worn as the Sammlung says: a fill, a border, or nothing.
   *
   * Two different custom properties rather than one and a class on the grid,
   * because the fill is what decides the *text* colour - a label over a light
   * Fitzgerald fill is dark whatever the theme is, and a label on a bordered
   * cell is the theme's own. ui.css keys both off which property is set, so a
   * cell cannot end up dark text on a dark surface by having the class and not
   * the fill. "off" sets neither, and the cell is left as any other. */
  const colour = classColor(held.wordClass);
  if (colour && wordColor(board()) === "fill") {
    box.style.setProperty("--cell-color", colour);
  } else if (colour && wordColor(board()) === "border") {
    box.style.setProperty("--cell-edge", colour);
  }

  /* The one cell whose look is the viewer's rather than the collection's.
   *
   * Everything else on this board is a word: paper under the picture because
   * AAC symbols are drawn for white, a Fitzgerald tint saying which kind of
   * word, the label spelling it. A start key is none of those, and the tablet
   * draws it as what it is - the picture's luminance on a dark plate, the same
   * two tones the bar controls wear. Until this class existed the editor drew
   * it as a word anyway, so the one cell the editor could not preview was the
   * one cell that does not look like its own picture.
   *
   * The condition is BoardScreen.kt's `chrome`, restated rather than
   * approximated, because the two have to answer alike on the same button:
   *
   *   - a bare `home`. An appending one - a word that is also said on the way
   *     back - really is a word, and keeps its paper and its tint there;
   *   - no fill and no border. A key wearing a colour has been given one on
   *     purpose, and neither renderer takes it away for the sake of a default.
   *
   * The plate comes from HOME_TONES for the reason sheet.ts gives at its own
   * copy of this line: it is the tablet's colour, not a theme token, so it is
   * read from the module that owns what a key looks like rather than written a
   * second time in ui.css. */
  /* Every way back to the start page wears a heavier edge, coloured or not.
   *
   * `.cell--home` below is narrower than this on purpose: it is the plate a
   * key gets when it carries no colour of its own, so a home key somebody has
   * given a Fitzgerald colour keeps that colour and would have had no mark at
   * all. The edge is the mark; the plate is a default.
   *
   * The `home` act rather than a `goto` that happens to point at today's start
   * page. They are different things - see the start key's own comment - and
   * only one of them follows the start page when it moves. */
  if (held.act.kind === "home") box.classList.add("cell--tohome");

  const chrome = held.act.kind === "home" && held.act.alsoAppend !== true
    && !box.style.getPropertyValue("--cell-color")
    && !box.style.getPropertyValue("--cell-edge");
  if (chrome) {
    box.classList.add("cell--home");
    box.style.setProperty("--home-plate", HOME_TONES.plate);
    /* The strokes' tone, for the things on the plate that are not the picture
     * - the act badge in the corner. The picture gets there through the filter
     * instead, which is the same two numbers by the other route. */
    box.style.setProperty("--home-ink", HOME_TONES.light);
  }

  if (held.symbol) {
    const image = document.createElement("img");
    image.className = "cell__pic";
    symbolInto(image, held.symbol);
    // Two different absences, and the words point at different remedies. The
    // reading is shell/sheet.ts's, because the sheet's own preview and both
    // editors' cells all have to make it and it was three copies of one
    // sentence-picking rule.
    image.onerror = () => { image.replaceWith(missing(held.symbol)); };
    // Crossed out, and only then wrapped: the cross has to be the size of the
    // picture rather than of the cell - see .cell__crossed - and an ordinary
    // button keeps the <img> as its own flex item.
    if (held.negated) {
      const crossed = document.createElement("span");
      crossed.className = "cell__crossed";
      crossed.append(image, negationCross());
      box.appendChild(crossed);
    } else {
      box.appendChild(image);
    }
  }

  /* The word, where there is one.
   *
   * A picture with no word is ordinary AAC and the format allows it -
   * exchange/SPEC.md §7.2 - so nothing stands in for the word that is not
   * there. An empty slot on a board is furniture announcing an absence, and
   * the way to fill it is a press away. */
  if (held.label) box.appendChild(wordSpan(held.label));

  // What the button does, where it is not the default. An appending button is
  // the common case and carries no mark: marking every ordinary cell would
  // make the marks worth nothing.
  const badge = actBadge(held.act);
  if (badge) {
    const tag = document.createElement("span");
    tag.className = "cell__act";
    tag.textContent = badge;
    tag.title = t(`ui.app_act_${actKey(held.act.kind)}`);
    box.appendChild(tag);
  }

  /* Hearing it, without opening anything.
   *
   * The five-key editor has had a play button on every key since it was
   * written, and it is what somebody uses while looking at the board to check
   * it reads right. It stands there whenever there is something to hear rather
   * than appearing under the pointer - see .cell__play for why the quieter
   * arrangement was also an unreachable one. A real <button>, because nothing
   * drags it.
   *
   * Only where there is something to say. The four bar controls speak nothing
   * when pressed on the tablet, and nor does a navigation button - unless it
   * is one that carries its word into the sentence on the way, which speaks
   * exactly like the word button it also is. Offering to audition any of the
   * others would be offering silence. */
  const saying = (held.vocalization || held.label).trim();
  if (saying && (appends(held.act) || held.act.kind === "speak")) {
    const play = document.createElement("button");
    play.type = "button";
    /* The ring says the word is spoken at once and the sentence bar is left
     * alone - §7.3's `speak`. It marks the exception, because almost every
     * button on a board feeds the bar and marking that would be marking
     * everything; and it sits on this control because what a press does with
     * the sound is the same question as what the sound is.
     *
     * The words go with it. A ring is a mark and nothing else, so the control's
     * own label is what carries the fact for anybody not looking at it. */
    const atOnce = held.act.kind === "speak";
    play.className = "cell__play" + (atOnce ? " cell__play--now" : "");
    play.textContent = "▶";
    const says = t(atOnce ? "ui.play_at_once" : "ui.play_title");
    play.title = says;
    play.setAttribute("aria-label", says);
    play.onclick = (event) => {
      // The cell behind it opens the sheet; this one does not.
      event.stopPropagation();
      void speak(saying, play);
    };
    box.appendChild(play);
  }

  /* And the corner that follows a navigation button.
   *
   * The row of page tiles over the board is gone, and this is where the half
   * of it that was not duplication went: a `goto` button already carries the
   * name of the page it opens, so the way there belongs on the button rather
   * than on a copy of it two centimetres higher.
   *
   * **Top right, and the play control is top left.** Both seats are fixed and
   * neither moves for the other: a `goto` button that carries its word into
   * the sentence on the way - §7.3's `ext_lautstark_append_on_navigate` - has
   * something to audition *and* a page to follow, and the two used to share one
   * seat with this one stepping aside.
   *
   * The act badge shares this seat rather than the play control's, and that is
   * forced rather than chosen: the play control is the one thing that turns up
   * beside either of the other two, so it needs the seat nobody else uses. A
   * `goto` has carried no badge since this corner replaced its arrow, so these
   * two can never meet. ui.css has the table.
   *
   * The press itself still opens the button's own sheet, for the reason
   * templates/board.ts gives: a `goto` button that navigated when pressed
   * would be the one button on the board nobody could ever edit. */
  if (held.act.kind === "goto") {
    const to = pageById(board(), held.act.page);
    if (to) {
      const follow = document.createElement("button");
      follow.type = "button";
      follow.className = "cell__follow";
      follow.textContent = "›";
      follow.title = t("ui.page_follow", { name: pageName(to) });
      follow.setAttribute("aria-label", follow.title);
      follow.onclick = (event) => {
        event.stopPropagation();
        goToPage(to.id);
      };
      box.appendChild(follow);
    }
  }

  const select = () => { void editButton(held.row, held.col); };
  hit.onclick = select;

  box.draggable = true;
  box.ondragstart = (event) => {
    dragging = held.id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", held.id);
    }
  };
  box.ondragend = () => { dragging = null; clearDragMarks(); };

  /* Alt and an arrow moves a button one cell, which is the same key this
   * product already uses to reorder the talker's sets. The alternative -
   * editor-diy's arm-with-Enter, drop-with-Enter - reads well on four keys in
   * a fixed square and badly on sixty-six, where the two ends of the gesture
   * can be a screen apart.
   *
   * Claimed even where the move has nowhere to go: Alt+Left is history-back in
   * some engines, and rearranging a board must never walk off the page. */
  hit.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight");
  hit.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select();
      return;
    }
    const step = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0],
                    ArrowLeft: [0, -1], ArrowRight: [0, 1] } as const)[
                      event.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"];
    if (!event.altKey || !step) return;
    event.preventDefault();
    const grid = board().grid;
    const to = [held.row + step[0], held.col + step[1]] as const;
    if (to[0] < 0 || to[0] >= grid.rows || to[1] < 0 || to[1] >= grid.columns) return;
    /* The keyboard move stops at the same boundary the drag does, and stopping
     * is all it does: a shared button walks its own column, and a page button
     * may not walk into it. Claimed and then ignored rather than left
     * unclaimed, for the reason the shortcut is claimed at all - Alt+Left is
     * history-back in some engines, and rearranging a board must never walk
     * off the page. */
    if (inColumn(to[1]) !== inColumn(held.col)) return;
    if (inColumn(held.col)) moveShared(board(), held.id, to[0]);
    else moveButton(on, held.id, to[0], to[1]);
    commit();
    // render() rebuilt every cell, so the element that had focus is gone. It
    // follows the button rather than staying at the coordinate, which is what
    // makes a run of presses move one thing across the board.
    (byId("appGrid").children[(to[0] * grid.columns) + to[1]]
      ?.querySelector(".cell__open") as HTMLElement)?.focus();
  };
  return box;
}

/** The word on a cell. One maker, kept as one now that it has a single caller:
 *  it was two because paintCell() also had to put a word there as it was typed
 *  into the panel, and the panel and its live redraw are both gone. */
function wordSpan(text: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "cell__word";
  span.textContent = text;
  return span;
}
