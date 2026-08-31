// The five-key talker's editor: the set tabs, the board as the device really
// lays it out, and the two sheets a press opens - one for a speech key, one
// for the set.
//
// This is the device-specific half. Four keys to a set, a hole where the
// speaker is, and a cap on the sets that is the device's own: none of that is
// true of AAC in general and all of it is true of this hardware, which is why
// it sits under editor-diy/ and why nothing in the shell may import it. The
// shell reaches it through core/editor.ts instead, and `diy` at the foot of
// this file is what it reaches.
//
// dragSet, dragSlot and `current` live here and nowhere else.
//
// ## The board is 2x3 with a hole in it, and always was
//
// docs/hardware.md: the speaker sits top left, the set key below it, and the
// four speech keys to the right as a 2x2 block. data/obf.ts's grid() has
// exported exactly that arrangement - nulls and all - since it was written.
// What this editor drew was a set tile and four tiles in a row of three, which
// meant the one screen somebody arranges a board on was the one place the
// arrangement was wrong. The hole is drawn as the speaker rather than captioned
// as an absence, because that is what is there.
//
// The hole and the set key are not drop targets and do not move: their
// positions are the hardware's. Only the four speech keys trade places.
//
// ## The tile is gone and there are two sheets instead
//
// A press opens everything about the thing pressed, which is the arrangement
// editor-app already had and design's docs/mocks/vorlaut-editor-sheet.html
// draws for both. The scaffolding is shell/sheet.ts's - an editor may not
// import out of another editor, so what the two share lives one floor down -
// and what is left here is the rows, which are the part that is genuinely this
// device's. There is one fewer of them on a key than on a tablet button: no
// word class, because the device draws no colour at all - the five displays
// carry the picture and nothing round it.
//
// ## What a press does, on a device with no sentence bar
//
// The row for that is here, and it asks the same question editor-app asks in
// the same place with the same control. What differs is the answers, and the
// difference is one fact about the hardware: there is no sentence bar, so
// nothing composes. `append`, `clear`, `backspace` and `sayBar` are four of
// Act's seven and all four are about a bar; `home` is the fifth and belongs to
// the start page a ring of sets does not have. What is left is saying the key
// and leading onward, which is three answers once the two are allowed to
// happen on one press:
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
// The marks on the cell are editor-app's, not new ones. A key that leads
// onward wears the corner arrow that follows it, a key that speaks wears the
// play control that auditions it, and one that does both wears both - which is
// the same table a tablet cell reads, with the rows this device has. Nothing
// lands in `.cell__act`: that badge is for the acts with no better mark of
// their own, and neither of these is one.
import { $, negationCross } from "../shell/dom.js";
import { symbolInto } from "../backend/index.js";
import { state } from "../core/state.js";
import type { Editor } from "../core/editor.js";
import { actOf, isDiy, says } from "../core/types.js";
import type { BoardSet, DiyLayout, Layout, SlotAct } from "../core/types.js";
import { LANG, limits } from "../core/boot.js";
import { t } from "../core/texts.js";
import { save } from "../core/save.js";
import { paintOpenCollection } from "../shell/collections.js";
import { speak } from "../shell/speech.js";
import { dropdown, formRow, hint, missing, openSheet, textField }
  from "../shell/sheet.js";
import type { Choice, Left } from "../shell/sheet.js";
import { confirmDialog } from "@lautstark/design/dialog";

let dragSet: number | null = null;    // index of the dragged set
let dragSlot: number | null = null;   // index of the dragged speech key
/* Which set is being edited. It was `state.current` while the page held one
 * board and every module that touched a set index was allowed to know about
 * it. Now it is an index into whichever board is open, so it belongs to the
 * thing that draws the sets, and it is reset by adopt() rather than clamped by
 * the save loop. */
let current = 0;

/* state.layout, as the shape this editor is the editor for.
 *
 * The shell holds one layout and it may be either kind - core/types.ts's union
 * - and this file may only ever be looking at the DIY half, because the
 * composition root installs it for a DIY Sammlung and for nothing else. So
 * this is that guarantee written down once instead of a cast at each of the
 * forty places below.
 *
 * It throws for the reason $() throws: reaching here with a tablet Sammlung on
 * screen is not a case to handle, it is a composition root that has installed
 * the wrong editor, and the complaint should say so once. */
function board(): DiyLayout {
  const held = state.layout;
  if (!isDiy(held)) throw new Error("the five-key editor was given a tablet Sammlung");
  return held;
}

/** The set on screen. */
function set(): BoardSet {
  return board().sets[current]!;
}

/**
 * Redrawn now, written after - the same order and the same reason as
 * editor-app's commit(), which is where the argument is written out: an
 * IndexedDB round trip between a press and the page reflecting it is merely
 * slow for most of these, and for a sheet that has just written a key it is
 * long enough for a test driving the page to see the old board.
 *
 * Nothing is risked by drawing first. save() does not touch state.layout, and
 * the writes are serialised in a chain inside it.
 */
function commit(): void {
  render();
  /* The sidebar row for this Sammlung counts its sets, off the layout this has
   * just changed - so adding or removing one leaves the row at its old number
   * until something redraws it. Cheap by construction: the open row is the one
   * row paintOpenCollection() need not go to the store for. See there for why
   * it is not hung off the save instead. */
  paintOpenCollection();
  void save();
}

/* --- The board ------------------------------------------------------------
 *
 * The six cells in reading order: `null` is the hole where the speaker sits,
 * `"set"` is the set key, and a number is that one of the four speech slots.
 *
 *     .        key 1    key 2
 *     set      key 3    key 4
 *
 * The one place this arrangement is written down in this editor, so that the
 * grid, the drop targets and where Alt+Arrow may go cannot drift apart. It is
 * the same table data/obf.ts's grid() exports; the two agreeing is the point
 * of the change that made this file look like this.
 */
const CELLS: (null | "set" | number)[] = [null, 0, 1, "set", 2, 3];

/** Which cell in the grid holds a speech slot. */
const cellOf = (slot: number): number => CELLS.indexOf(slot);

/** The three answers a key's sheet offers, in the words on its list: **Wort**,
 *  **Wort & weiter**, **weiter**. Two members of SlotAct and the modifier on
 *  one of them, which is where the union puts them and why - see there. */
type Does = "word" | "carry" | "goto";

/** Which of the three an act reads as. Total, unlike editor-app's, because
 *  every act this device can hold is one of the three: there is no bar control
 *  a key could have been given before the list stopped offering it. */
const chosenAs = (act: SlotAct): Does =>
  act.kind === "speak" ? "word" : act.alsoSpeak ? "carry" : "goto";

/** An id for a set, minted when a key first names one. crypto.randomUUID() for
 *  store.ts's reason at its own: two of them made in two tabs must not collide,
 *  and nothing about a set - not its name, which may be empty on every one of
 *  them at once - is unique enough to derive one from. */
const mint = (): string => crypto.randomUUID();

/** The set a `goto` names, or undefined where it names one that has been
 *  deleted since. */
const setById = (layout: DiyLayout, id: string): BoardSet | undefined =>
  (layout.sets ?? []).find((one) => one.id === id);

/** What a set is called in a list, which is its name until somebody gives it
 *  one. The tab, the set key and the delete question all say this; so do the
 *  target list and the corner that follows it. */
const setName = (entry: BoardSet, index: number): string =>
  entry.name || t("ui.set_n", { n: index + 1 });

function clearDragMarks(): void {
  for (const one of document.querySelectorAll(".dragover")) {
    one.classList.remove("dragover");
  }
}

// Where a set lands, whether dropped or moved by Alt+Arrow. The moved set
// becomes the edited one, as it always has on drop; focus follows its tab
// because render() rebuilds the row, and the keyboard would otherwise be
// left standing on nothing.
function moveSet(from: number, to: number): void {
  const moved = board().sets.splice(from, 1)[0]!;
  board().sets.splice(to, 0, moved);
  current = to;
  commit();
  ($("tabs").children[to] as HTMLElement).focus();
}

/** Where a swap of two speech keys lands, whether dropped or made with
 *  Alt+Arrow. Focus follows the key rather than staying at the cell, which is
 *  what makes a run of presses carry one key across the block. */
function swapSlots(a: number, b: number): void {
  const slots = set().slots;
  [slots[a], slots[b]] = [slots[b]!, slots[a]!];
  commit();
  ($("device").children[cellOf(b)]
    ?.querySelector(".cell__open") as HTMLElement)?.focus();
}

/* A new set, made by the press on "+ Neue Seite".
 *
 * Nameless, and that is the change: it minted "Set 3" into the data, in a
 * product whose every word for the thing is Seite. It was the one English
 * string left on this screen and the only one a language switch could never
 * reach, because it was not a text key at all - it had been written into the
 * layout at the moment of the press and was still there in English after the
 * switch, on a tab beside four that had followed it.
 *
 * Every reader of a set's name already has the fallback: the tab, the set key
 * and the delete question all say `entry.name || t("ui.set_n", ...)`. So an
 * empty name is not a set without a name, it is a set that has not been
 * renamed - which is what it is - and it is drawn "Seite 3" in whichever
 * language the page is in. blank() at the foot of this file has made its one
 * set this way since it was written; this is the same set, made by a different
 * press, and the two agreeing is the point.
 *
 * What it costs is that an unnamed set is told apart by its position alone, so
 * reordering two of them changes nothing in the strip. That is honest rather
 * than regrettable - there is nothing else to call a set nobody has named -
 * and it is why e2e/happy.spec.ts names one before it moves it.
 *
 * The index went with the name. Nothing else in here numbered anything.
 */
function emptySet(): BoardSet {
  return {
    name: "",
    symbol: "",
    slots: [0, 1, 2, 3].map(() => ({ text: "", symbol: "" })),
  };
}

/* There was a toggle here that drew every key the way the display draws it -
 * scaled to 128x128, rounded to RGB565, life-size at 15.21 mm - and it is on
 * the loader page now, after a compile, showing the tiles that are about to go
 * down the cable rather than a prediction of them. adr/0013 has the decision
 * and states what the move costs, which is that the picture arrives later than
 * it used to. docs/split-crossings.md has the costing behind it.
 *
 * What is left on a cell is the stored symbol, which is what this board drew
 * before the preview existed and what a tablet cell has always drawn. */

/** The picture on a cell: the symbol, as it was put there.
 *
 * A crossed-out key comes back wrapped, because the cross has to be the size
 * of the picture rather than of the cell - see .cell__crossed. Only then:
 * every key that is not negated is the bare <img> it has always been. */
function picture(symbol: string, negated = false): HTMLElement {
  const image = document.createElement("img");
  image.className = "cell__pic";
  image.alt = "";
  symbolInto(image, symbol);
  // Two different absences, and the words point at different remedies. The
  // reading is shell/sheet.ts's, because both editors' cells and the sheet's
  // own preview all have to make it.
  image.onerror = () => { image.replaceWith(missing(symbol)); };
  if (!negated) return image;
  const box = document.createElement("span");
  box.className = "cell__crossed";
  box.append(image, negationCross());
  return box;
}

/** The widget inside a cell: what a press lands on.
 *
 * A div wearing role="button" rather than a <button>, for the reason
 * editor-app's opener() gives: its parent is dragged, and a real button
 * captures the mousedown that would start the drag. So the two things the
 * element would have brought - a place in the tab order, and acting on Enter
 * and Space - are written out at each call site. */
function opener(label: string): HTMLElement {
  const hit = document.createElement("div");
  hit.className = "cell__open";
  hit.setAttribute("role", "button");
  hit.tabIndex = 0;
  hit.setAttribute("aria-label", label);
  hit.setAttribute("aria-haspopup", "dialog");
  return hit;
}

/** Hearing a key without opening it. The five-key board has had this on every
 *  key since it was written, and it is what somebody uses while looking at the
 *  board to check it reads right. A real <button>, because nothing drags it. */
function playButton(saying: string): HTMLElement {
  const play = document.createElement("button");
  play.type = "button";
  play.className = "cell__play";
  play.textContent = "▶";
  play.title = t("ui.play_title");
  play.setAttribute("aria-label", t("ui.play_title"));
  play.onclick = (event) => {
    // The cell behind it opens the sheet; this one does not.
    event.stopPropagation();
    void speak(saying, play);
  };
  return play;
}

/** The cell where the speaker is. Not a control, not a drop target, and not
 *  something anybody can put a key in: it is a hole in the board because there
 *  is a 40 mm cone behind it. Drawn as the thing rather than captioned as an
 *  absence - the mock has the glyph. */
function holeCell(): HTMLElement {
  const box = document.createElement("div");
  box.className = "cell cell--hole";
  const line = document.createElement("span");
  line.innerHTML =
    `<svg viewBox="0 0 40 40" aria-hidden="true">`
    + `<circle cx="20" cy="20" r="17" stroke-width="1.5"/>`
    + `<circle cx="20" cy="20" r="11" stroke-width="1.2"/>`
    + `<circle cx="20" cy="20" r="4" stroke-width="1.5" fill="currentColor"/></svg>`;
  line.append(t("ui.speaker"));
  box.appendChild(line);
  return box;
}

/** The set key, which is a display like the other four and is also the set
 *  itself: it carries the set's picture and name on the device, and a press on
 *  the device cycles to the next set. So pressing it here opens the set's own
 *  card - the same one the ⋯ on its tab opens, because they are one thing
 *  drawn twice. */
function setCell(entry: BoardSet): HTMLElement {
  const box = document.createElement("div");
  box.className = "cell cell--setkey";

  const name = setName(entry, current);
  const hit = opener(t("ui.set_more"));
  const open = () => { void openSetSheet(); };
  hit.onclick = open;
  hit.onkeydown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  };
  box.appendChild(hit);

  const eyebrow = document.createElement("span");
  eyebrow.className = "cell__eyebrow";
  eyebrow.textContent = t("ui.set_key");
  box.appendChild(eyebrow);

  if (entry.symbol) box.appendChild(picture(entry.symbol));
  const word = document.createElement("span");
  word.className = "cell__word";
  word.textContent = name;
  box.appendChild(word);
  return box;
}

/** One of the four speech keys. */
function keyCell(entry: BoardSet, index: number): HTMLElement {
  const slot = entry.slots[index]!;
  const said = (slot.text || "").trim();
  const act = actOf(slot);
  const box = document.createElement("div");
  box.className = "cell";

  /* Every speech cell is a drop target, filled or not: the four slots always
   * exist, so a drop is always a swap and the other key moves exactly where
   * this one came from. The hole and the set key have no ondragover at all,
   * which is what keeps them out of it - only a prevented dragover marks an
   * element as a drop target. */
  box.ondragover = (event) => {
    if (dragSlot === null || dragSlot === index) return;
    event.preventDefault();
    box.classList.add("dragover");
  };
  box.ondragleave = () => box.classList.remove("dragover");
  box.ondrop = (event) => {
    event.preventDefault();
    clearDragMarks();
    if (dragSlot === null || dragSlot === index) return;
    const from = dragSlot;
    dragSlot = null;
    swapSlots(from, index);
  };

  if (!said && !slot.symbol) box.classList.add("cell--empty");
  /* A key with a picture and no sentence is a deliberate key rather than an
   * unfinished one, so it is not announced as empty: the number names it, and
   * only a key with neither is empty. Reading editor-app's cell() makes of the
   * same two cases. */
  const hit = opener(said || (slot.symbol ? t("ui.key_n", { n: index + 1 })
                                          : t("ui.diy_key_add")));
  box.appendChild(hit);

  if (slot.symbol) box.appendChild(picture(slot.symbol, slot.negated));
  if (said) {
    const word = document.createElement("span");
    word.className = "cell__word";
    word.textContent = said;
    box.appendChild(word);
  }
  /* Only where there is something to hear. A key that leads onward and says
   * nothing has nothing to audition, and offering to play it would be offering
   * silence - editor-app's cell() makes the same reading of the same fact.
   *
   * No ring on it, and that is the one place the two editors' cells differ on
   * purpose. `.cell__play--now` marks the tablet's exception, the button that
   * speaks at once instead of feeding the sentence bar; here that is what every
   * speaking key does, and a mark on all of them is a mark on none. */
  if (said && says(act)) box.appendChild(playButton(said));

  /* And the corner that follows a key which leads onward.
   *
   * editor-app's `.cell__follow`, in the seat that stylesheet fixes for it -
   * top right, with the play control top left, so a key that speaks *and*
   * leads wears both without either standing aside. The two are drawn from one
   * rule for both editors, which is why neither the class nor the geometry is
   * restated here.
   *
   * The press switches the strip to that page rather than opening the key's
   * own sheet, exactly as it opens a page on a tablet. The cell behind it still
   * opens the sheet, for templates/board.ts's reason: a key that navigated when
   * pressed would be the one key on the board nobody could ever edit. */
  if (act.kind === "goto") {
    const to = setById(board(), act.set);
    if (to) {
      const at = board().sets.indexOf(to);
      const follow = document.createElement("button");
      follow.type = "button";
      follow.className = "cell__follow";
      follow.textContent = "›";
      follow.title = t("ui.page_follow", { name: setName(to, at) });
      follow.setAttribute("aria-label", follow.title);
      follow.onclick = (event) => {
        event.stopPropagation();
        current = at;
        render();
      };
      box.appendChild(follow);
    }
  }

  const open = () => { void editKey(index); };
  hit.onclick = open;

  box.draggable = true;
  box.ondragstart = (event) => {
    dragSlot = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    }
  };
  box.ondragend = () => { dragSlot = null; clearDragMarks(); };

  /* Alt and an arrow moves a key one place, which is the key editor-app uses
   * for the same act and the one this editor already used to reorder sets. It
   * replaces arm-with-Enter, drop-with-Enter: that gesture had two ends and a
   * state between them, which needed a grip to hang the state on, a mark on
   * the grip, a sentence in the status line and an Escape to let go - all of
   * it for a swap inside a square of four.
   *
   * Within the 2x2 block only. Slot n sits at row n>>1, column n&1 of it, and
   * a move that would leave the block does nothing: the cells around it are
   * the speaker and the set key, and neither is a place a key can go.
   *
   * Claimed even where the move has nowhere to go: Alt+Left is history-back in
   * some engines, and rearranging a board must never walk off the page. */
  hit.setAttribute("aria-keyshortcuts",
                   "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight");
  hit.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
      return;
    }
    const step = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0],
                    ArrowLeft: [0, -1], ArrowRight: [0, 1] } as const)[
                      event.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"];
    if (!event.altKey || !step) return;
    event.preventDefault();
    const to = [(index >> 1) + step[0], (index & 1) + step[1]] as const;
    if (to[0] < 0 || to[0] > 1 || to[1] < 0 || to[1] > 1) return;
    swapSlots(index, (to[0] * 2) + to[1]);
  };
  return box;
}

/* --- The set strip -------------------------------------------------------- */

function drawTabs(): void {
  const tabs = $("tabs");
  tabs.innerHTML = "";
  board().sets.forEach((entry, index) => {
    const tab = document.createElement("div");
    // Which tab is the open one is the stylesheet's now rather than a colour
    // written on the element: it was the set's own colour on the border, with
    // a square of the same colour beside the name. Both went with the colour,
    // and the square would have been the worse thing to keep - the same value
    // on every tab, saying only that a set is a set.
    tab.className = "tab" + (index === current ? " active" : "");
    const name = document.createElement("span");
    name.textContent = setName(entry, index);
    tab.appendChild(name);
    const open = () => { current = index; render(); };
    tab.onclick = open;
    // Not a <button>, although it is pressed like one: the tab is dragged to
    // reorder, and engines disagree on what dragging a button means. So the
    // div stays, and the two things the element would have brought - a place
    // in the tab order, acting on Enter and Space - are written out.
    tab.setAttribute("role", "button");
    tab.tabIndex = 0;
    if (index === current) tab.setAttribute("aria-current", "true");
    tab.setAttribute("aria-keyshortcuts", "Alt+ArrowLeft Alt+ArrowRight");
    tab.onkeydown = (event) => {
      if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        // Claimed even when the move has nowhere to go: Alt+Left is history
        // back in some engines, and reordering must never walk off the page.
        event.preventDefault();
        const to = index + (event.key === "ArrowRight" ? 1 : -1);
        if (to >= 0 && to < board().sets.length) moveSet(index, to);
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    };

    /* The second way into the set's own card, on the tab that is already open.
     *
     * The same ⋯ editor-app puts on the last crumb of its path, and the same
     * card behind it. Here it is genuinely a second door - the set key opens
     * the same thing - and that is not what conventions.md §3.2 forbids: the
     * tab and the set key are the same set drawn twice, once as a card index
     * and once as what is on the device. Both lead to the thing itself.
     *
     * A <span> wearing role="button" for the reason the tab is a <div>: it is
     * inside something that is already pressed and dragged.
     *
     * Every set tab gets the element and only the current one gets the
     * control, which is editor-app's drawPages() and the same reason: the
     * strip reflowed on every switch, and here the tabs are also dragged to
     * reorder, so a row that resizes under the pointer is a row that resizes
     * mid-drag. The reserved copies are `visibility: hidden` - the box, and
     * nothing in the accessibility tree or the tab order. */
    const more = document.createElement("span");
    more.className = "tab__more";
    more.textContent = "⋯";
    if (index === current) {
      more.setAttribute("role", "button");
      more.tabIndex = 0;
      more.setAttribute("aria-label", t("ui.set_more"));
      const edit = (event: Event) => {
        // Or the press falls through to the tab, which would redraw the strip
        // out from under the sheet that is opening.
        event.stopPropagation();
        void openSetSheet();
      };
      more.onclick = edit;
      more.onkeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        edit(event);
      };
    } else {
      more.classList.add("tab__more--idle");
      more.setAttribute("aria-hidden", "true");
    }
    tab.appendChild(more);

    // Reorder sets: the order determines how the set key cycles through, so on
    // this device it is the navigation rather than the presentation - the
    // firmware advances with `rtcCurrentSet = (rtcCurrentSet + 1) %
    // layout.setCount`.
    tab.draggable = true;
    tab.ondragstart = (event) => {
      dragSet = index;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      }
    };
    tab.ondragover = (event) => {
      if (dragSet === null || dragSet === index) return;
      event.preventDefault();
      tab.classList.add("dragover");
    };
    tab.ondragleave = () => tab.classList.remove("dragover");
    tab.ondrop = (event) => {
      event.preventDefault();
      clearDragMarks();
      if (dragSet === null || dragSet === index) return;
      const from = dragSet;
      dragSet = null;
      moveSet(from, index);
    };
    tab.ondragend = () => { dragSet = null; clearDragMarks(); };

    tabs.appendChild(tab);
  });

  if (board().sets.length < limits.maxSets) {
    const add = document.createElement("button");
    add.className = "tab add";
    add.type = "button";
    add.textContent = t("ui.add_set");
    add.onclick = () => {
      board().sets.push(emptySet());
      current = board().sets.length - 1;
      commit();
    };
    tabs.appendChild(add);
  }

  /* The open tab, kept in view.
   *
   * The strip is bounded and scrolls now - see `.tabs` in ui.css - so the tab
   * that is open can be outside it after a redraw that nobody scrolled for:
   * opening a Sammlung of twenty-four pages, following a key to a page thirty
   * tabs down, deleting the page above the one that takes its place. `block:
   * "nearest"` scrolls the strip and nothing else, so the page does not jump,
   * and on a strip short enough not to scroll it has nothing to do.
   *
   * Guarded rather than called outright: scrollIntoView is a layout call and
   * not every environment this module is loaded in has one, and nothing about
   * the strip depends on it having happened. */
  const showing = tabs.children[current] as HTMLElement | undefined;
  if (typeof showing?.scrollIntoView === "function") {
    showing.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

export function render(): void {
  // A drag does not survive a redraw: the element that carried it is thrown
  // away with the rest of the board.
  dragSet = null;
  dragSlot = null;
  drawTabs();

  /* How many pages there are, and the cap only where it bites.
   *
   * This read "{used} of {max} places on the device taken" while the cap was
   * five, and at five that was the useful sentence: the last page was in
   * sight from the first, so the count and the room left were one number worth
   * watching. At sixty-four it is a meter that never moves, repeating a
   * figure nothing on this screen can act on and, worse, implying scarcity
   * where there is none - somebody counting places would stop adding pages
   * long before the device would.
   *
   * So the line says how many pages there are, and the cap turns up only on
   * the press that would have made one too many, where "+ Neue Seite" is no
   * longer in the strip. That absence was self-explanatory at five, because a
   * full strip was five tabs anybody could see at once. At sixty-four the
   * button just stops being there, and a sentence is what is left to say why.
   */
  const used = board().sets.length;
  $("slots").textContent = used < limits.maxSets
    ? t("ui.sets_count", { used })
    : t("ui.sets_full", { used });

  const device = $("device");
  device.innerHTML = "";
  const entry = board().sets[current];
  if (!entry) {
    device.innerHTML = '<p style="color:var(--muted)"></p>';
    device.firstChild!.textContent = t("ui.no_sets");
    return;
  }
  for (const place of CELLS) {
    device.appendChild(place === null ? holeCell()
      : place === "set" ? setCell(entry)
      : keyCell(entry, place));
  }
}

/* --- The two sheets -------------------------------------------------------
 *
 * The frame is shell/sheet.ts's - the picture column with its search, the foot
 * with the destructive act on the left, and the promise that settles from the
 * presses rather than from `close` alone. What is here is the rows, and there
 * are fewer of them than on a tablet for reasons that are facts about this
 * device rather than simplifications of the other one.
 *
 * **Nothing is written until Fertig.** Both sheets edit a draft and copy it
 * back on the confirming press, so every way out that is not that press costs
 * nothing. The tile wrote as you typed because it was always on screen and
 * there was nothing to dismiss.
 */

/** One speech key: its picture, what it says, and hearing it.
 *
 * One text field and not two. A tablet button has an Aufschrift and a
 * Gesprochen because the tablet draws the one and says the other; this device
 * draws no caption at all - the key is the picture - so there is one thing to
 * type and `ui.text_placeholder` has been the words for it since this editor
 * was written.
 */
function openKeySheet(index: number): Promise<Left> {
  const layout = board();
  const sets = layout.sets;
  const entry = set();
  const slot = entry.slots[index]!;
  const held = actOf(slot);
  const draft = { text: slot.text, symbol: slot.symbol, negated: Boolean(slot.negated) };

  const spoken = textField(draft.text, (value) => { draft.text = value; });
  spoken.id = "diyKeyText";
  const play = document.createElement("button");
  play.type = "button";
  play.className = "btn";
  play.textContent = "▶";
  play.title = t("ui.play_title");
  play.setAttribute("aria-label", t("ui.play_title"));
  play.onclick = () => {
    const saying = draft.text.trim();
    if (saying) void speak(saying, play);
  };
  const withPlay = document.createElement("div");
  withPlay.className = "form__withplay";
  withPlay.append(spoken, play);
  const spokenRow = formRow(t("ui.text_placeholder"), withPlay,
                            t("ui.diy_key_spoken_note"), spoken.id);

  /* --- what a press does, and the two rows that follow from it -----------
   *
   * Asked first, above the field it governs, which is editor-app's order and
   * its argument: a key that only leads onward says nothing, so its Was gesagt
   * wird field is a dead control - and asked last it was dead in silence, with
   * nothing on screen saying why typing into it changes nothing.
   *
   * The same dropdown that editor draws, and each answer's own sentence
   * following it as a hint. Three boxed options with their notes under them
   * would be most of this sheet's height, and the distinction between the
   * first two is exactly the thing a bare list of three words gets wrong.
   */
  const kinds: Choice[] = (["word", "carry", "goto"] as const)
    .map((kind) => ({ value: kind, label: t(`ui.diy_does_${kind}`) }));
  const note = hint();
  note.id = "diyDoesNote";
  const does = dropdown(kinds, chosenAs(held), () => { follow(); });
  does.button.id = "diyDoes";
  /* Named to the trigger by hand, because this row's sentence is rewritten on
   * every choice and so cannot be handed to formRow() once. "Wort" on its own
   * does not say what a word does. */
  does.button.setAttribute("aria-describedby", note.id);
  const actRow = formRow(t("ui.button_act"), does.anchor, "", does.button);
  actRow.classList.add("form__row--caption");
  actRow.appendChild(note);

  /* Which page a key leads to.
   *
   * Every set in the Sammlung and nothing else. There is no "Neue Seite …"
   * entry the way the tablet's list has one: making a page is a press on the
   * strip that is already on screen behind this sheet, and an entry that could
   * be greyed out on the page past the cap is worse than no entry.
   *
   * Where the key already leads is where the list stands. Where it leads
   * nowhere - a page deleted since, which nothing in this change prevents -
   * the list stands on the page the key is on, and Fertig writes that. It is
   * the fallback editor-app states for a `goto` with no target: a navigating
   * key is never left pointing at nothing, because that exports as a key which
   * does not navigate at all, and the list said otherwise.
   */
  const where: Choice[] = sets.map((one, at) =>
    ({ value: String(at), label: setName(one, at) }));
  const leadsTo = held.kind === "goto"
    ? sets.findIndex((one) => one.id === held.set) : -1;
  const targets = dropdown(where, String(leadsTo < 0 ? current : leadsTo),
                           () => {});
  targets.button.id = "diyGoto";
  const targetRow = formRow(t("ui.goto_page"), targets.anchor, "",
                            targets.button);

  /** The rows that depend on the answer above them, and the note under it.
   *
   * Hidden rather than disabled, editor-app's reading: the question is not
   * whether somebody may type into this field, it is whether the key says
   * anything at all, and a greyed field still reads as one they have failed to
   * reach.
   *
   * Nothing is cleared on a change of answer. The draft reaches the slot on
   * Fertig, so a sentence typed before somebody changed their mind is still
   * there if they change it back.
   */
  function follow(): void {
    note.textContent = t(`ui.diy_does_${does.value}_note`);
    targetRow.hidden = does.value === "word";
    spokenRow.hidden = does.value === "goto";
  }
  follow();

  /** What the two lists come to, as an act.
   *
   *  The one place a set is given an id, and it happens on the press that
   *  writes the key which needed it - so a sheet somebody closes another way
   *  leaves the Sammlung exactly as they found it, ids included. See
   *  BoardSet.id. */
  const chosen = (): SlotAct => {
    if (does.value === "word") return { kind: "speak" };
    const to = sets[Number(targets.value)] ?? entry;
    to.id ??= mint();
    // Absent rather than false where the key only leads onward - SlotAct's own
    // note, and what keeps a key written before this existed byte-identical.
    return does.value === "carry"
      ? { kind: "goto", set: to.id, alsoSpeak: true }
      : { kind: "goto", set: to.id };
  };

  const keep = () => {
    slot.text = draft.text;
    slot.symbol = draft.symbol;
    // Present only when it is true, never a stored false: an ordinary key goes
    // on being written exactly as it was before this field existed, so nothing
    // that has never been crossed out looks changed to changed.ts.
    if (draft.negated) slot.negated = true;
    else delete slot.negated;
    // The same rule one field along, and the reason is the same one: absent is
    // what `speak` means, so a key nobody has given a second job to is written
    // as it always was.
    const act = chosen();
    if (act.kind === "speak") delete slot.act;
    else slot.act = act;
    commit();
  };

  return openSheet({
    title: t("ui.diy_key_title"),
    pick: {
      symbol: draft.symbol,
      seed: draft.text,
      negated: draft.negated,
      /* Only fill a field that is still empty, never write over one somebody
       * typed: the symbol is called "zustimmen", but your key should say
       * "Ja!". The same rule editor-app keeps, and it has been this editor's
       * since the picker had it.
       *
       * The typed word before the collection's caption, which is the other
       * half of the same complaint: a search for "trinken" answered by a
       * pictogram filed under "Getraenk" wrote "Getraenk" onto the key. The
       * caption is still what fills it for a picture that was not searched
       * for - an upload has no word at all, and takes none. */
      onPick: (symbol, caption, typed) => {
        draft.symbol = symbol;
        const word = typed || caption;
        if (word && !draft.text.trim()) {
          draft.text = word;
          spoken.value = word;
        }
      },
      onNegate: (negated) => { draft.negated = negated; },
    },
    rows: [actRow, targetRow, spokenRow],
    /* Emptied and not deleted, and only where there is something to empty.
     * A slot is one of a fixed four and cannot go; what the button does is put
     * it back the way an untouched key is, which is why its label says so - see
     * ui.diy_key_clear. No question in front of it, for editor-app's reason:
     * what goes is one key on the set somebody is looking at, and putting it
     * back is one press in the cell it came from. */
    ...((slot.text || slot.symbol || slot.act) ? {
      remove: {
        label: t("ui.diy_key_clear"),
        onPress: (settle: () => void) => {
          slot.text = "";
          slot.symbol = "";
          // Putting a key back the way an untouched one is, and an untouched
          // key is not crossed out. A cross left behind on an empty key is
          // invisible - there is no picture under it - and comes back the
          // moment somebody picks the next picture.
          delete slot.negated;
          // An untouched key says its word, which is what no act at all means.
          // A key left leading onward with nothing on it is the one shape this
          // board can hold that nobody can see: no picture, no sentence, and a
          // press that changes the page.
          delete slot.act;
          settle();
          commit();
        },
      },
    } : {}),
    /* The sheet's one cost bought back. Four keys is a smaller run than a
     * tablet page of sixty-six, but it is still a run, and stopping at the
     * last one rather than wrapping is the same choice editor-app made:
     * walking off the end back to the first is a surprise. */
    ...(index < 3 ? { next: { label: t("ui.diy_key_next"), onPress: keep } } : {}),
    done: { label: t("ui.done"), onPress: keep },
    /* No `focus`: the sheet opens in the picture column's search field. See
     * SheetSpec.focus - the word is typed once, and the picture it finds
     * writes it into the empty field behind. */
  });
}

/** The sheet, and then the next key's, for as long as somebody keeps pressing
 *  "next". */
async function editKey(index: number): Promise<void> {
  for (let at = index; ; at += 1) {
    const how = await openKeySheet(at);
    if (how !== "next" || at + 1 >= 4) break;
  }
}

/**
 * The set itself: its picture, its name, its colour and deleting it.
 *
 * Reached from the ⋯ on the current tab and from the set key on the board,
 * which are the same set drawn twice. Everything in it stood in a tile beside
 * the board before - a thumb, a name field, a row of swatches, a colour input,
 * a hex field and a red button under all of it - and none of it was a cell.
 * With it gone the board is tabs and a grid and nothing else, which is what
 * the mock's last note asks for.
 *
 * **The colour has gone, and so has its row.** It was three controls in three
 * places, then one row of swatches held here until the firmware stopped
 * reading it. The firmware has, so the row went with it: what is left is a
 * name and a picture, which are what a set is told apart by on the device.
 *
 * BoardSet.color went with it, one change later. It outlived the row because
 * data/obf.ts wrote it into a .obf as ext_vorlaut_color and read it back, and
 * tests/reference/obf.lock.json froze both directions; narrowing that lock is
 * what let the field go.
 */
function openSetSheet(): Promise<void> {
  const entry = set();
  const draft = { name: entry.name, symbol: entry.symbol };

  const name = textField(draft.name, (value) => { draft.name = value; });
  name.id = "diySetName";
  name.placeholder = t("ui.set_name");

  return openSheet({
    title: t("ui.set_title"),
    /* A picture column, where the tablet's page card has none: this page has a
     * key on the device that shows one. */
    pick: {
      symbol: draft.symbol,
      seed: draft.name,
      // What was typed before what the collection calls it - see the key
      // sheet above, which has the argument.
      onPick: (symbol, caption, typed) => {
        draft.symbol = symbol;
        const word = typed || caption;
        if (word && !draft.name.trim()) {
          draft.name = word;
          name.value = word;
        }
      },
    },
    rows: [
      formRow(t("ui.set_name"), name, t("ui.set_name_note")),
    ],
    remove: {
      label: t("ui.remove_set"),
      // The question is askDelete's, and it draws a dialog of its own over
      // this one. Only a yes closes this sheet, because a no leaves somebody
      // exactly where they were.
      onPress: (settle) => {
        void askDelete().then((gone) => { if (gone) settle(); });
      },
    },
    done: {
      label: t("ui.done"),
      onPress: () => {
        entry.name = draft.name;
        entry.symbol = draft.symbol;
        commit();
      },
    },
    // No `focus`: the search field, as on every sheet with a picture column.
  }).then(() => undefined);
}

/**
 * The question asked before a set goes.
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
 * What is counted is the keys with something on them rather than the four
 * slots, which are always four. An empty set is the case where there is
 * genuinely nothing to lose, and it says so instead of counting to zero.
 *
 * The same shape as editor-app's page delete, deliberately: they are the same
 * act on the same kind of object, one editor apart.
 */
async function askDelete(): Promise<boolean> {
  const sets = board().sets;
  if (!sets.length) return false;
  const entry = sets[current]!;
  const name = setName(entry, current);
  const n = (entry.slots || []).filter(
    (slot) => (slot.text || "").trim() || (slot.symbol || "").trim()).length;

  if (!await confirmDialog({
    title: t("ui.remove_set"),
    body: t(n === 0 ? "ui.set_delete_ask_none"
             : n === 1 ? "ui.set_delete_ask_one" : "ui.set_delete_ask",
            { name, n }),
    confirmLabel: t("ui.set_delete_go"),
    cancelLabel: t("ui.cancel"),
    // Never the same word as the button beside it: two dismissals sharing an
    // accessible name is ambiguous to anyone navigating by it.
    closeLabel: t("ui.close"),
    danger: true,
  })) return false;

  sets.splice(current, 1);
  current = Math.max(0, current - 1);
  commit();
  return true;
}

/* wireEditor() stood here and bound one control: the preview toggle, which
 * went to the loader page with the picture it drew (adr/0013). There is
 * nothing on this editor's own markup left to bind - every control it has is
 * built by render() or by a sheet, with its handler attached as it is made -
 * so app.ts passes a wire step that does nothing rather than this file
 * exporting a function that does nothing. */

/* What the shell is handed, and the whole of what it may ask for.
 *
 * Seven members, and each one is a question the shell has that only the device
 * can answer - see core/editor.ts for what each is and why it is not a general
 * "do something to the board" hook. app.ts registers this object against the
 * "diy" target; nothing in src/shell/ imports this file, and
 * tests/unit/layers.test.ts is what says so.
 */
export const diy: Editor = {
  /* What a new board starts as, and it is a fact about this hardware: one set
   * of four empty keys. app.py seeded
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
      sets: [{
        name: "",
        symbol: "",
        slots: [0, 1, 2, 3].map(() => ({ text: "", symbol: "" })),
      }],
    };
  },

  /* A different board is in force. Back to its first set rather than clamped
   * to where the last board happened to be standing: set three of the kitchen
   * board and set three of the nursery board have nothing to do with each
   * other, and landing on one because the other was open reads as the page
   * having lost its place. */
  adopt(): void {
    current = 0;
    render();
  },

  render,

  /* A sentence somebody actually wrote, from the set on screen, so that trying
   * a voice out is heard on the content rather than on a specimen. "" when
   * this board has nothing typed on it yet; the settings sheet has its own
   * specimen for that, in the reader's language, which is not this file's to
   * choose. */
  sample(): string {
    const entry = board().sets[current];
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

  /* Sets, because a set is a fixed four keys here: the number of sets and the
   * amount of work in a Sammlung move together, so one number does both of the
   * jobs conventions.md §1.8 gives it. That is not true on a tablet, where a
   * page holds anything from nothing to sixty-six - see editor-app. */
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
