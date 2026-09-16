<script lang="ts">
  /**
   * One of the five keys.
   *
   * All five, and there is no second component for a fifth: what a key shows and
   * what it does are the same questions on every panel. The one thing the seat
   * still decides is the caption - a key on the page-key panel with no word of
   * its own shows the page's name, because that is what the firmware prints
   * there and this cell is meant to look like what is on the table. PAGE_KEY in
   * core/types.ts is the seat, and both export doors write the same fallback.
   *
   * There was a fifth here in another shape - a set key, drawn from `BoardSet`'s
   * own name, symbol and key, opening a different sheet, and doing one thing
   * nothing else could do: go round to the next set, for ever.
   * vorlaut-diy-talker's adr/0020 ended that on the device and core/types.ts is
   * where it ended here.
   */
  import { t } from "../shell/live.svelte.js";
  import { speak } from "../shell/speech.js";
  import Negate from "../shell/pieces/Negate.svelte";
  import Picture from "../shell/pieces/Picture.svelte";
  import { actOf, says } from "../core/types.js";
    import { pageAt } from "./pages.js";
  import { editKey } from "./keySheet.svelte.js";
  import {
    at, board, dragged, endDrag, goToSet, hover, hovering, keyAt, printsName,
    render, seatOf, set, setName, startDrag, swapSlots, unhover,
  } from "./standing.svelte.js";

  let { index }: { index: number } = $props();

  /* A shallow copy of the slot rather than the slot itself, and the set's name
     rather than the set: everything below reads fields off them, and the layout
     is mutated in place - so a `$derived` holding either record would never say
     anything changed. See the head of shell/live.svelte.ts. Nothing here writes
     to a slot; the sheet does, through set() at the moment it is opened. */
  const slot = $derived({ ...set().slots[index]! });
  const own = $derived((slot.text || "").trim());
  // What the panel shows, and what ▶ would play: the key's own word, or the
  // page's name where the page-key panel has none.
  const said = $derived(own || (printsName(index) ? setName(set(), at()) : ""));
  const act = $derived(actOf(slot));

  /* Where this key leads, if it leads anywhere: the page it names, found once
     because both the line over the picture and the corner below it need it, and
     a key pointed at a page that has since been deleted names nothing. */
  const leads = $derived(act.kind === "goto" ? pageAt(board(), act.set) : -1);
  const goesTo = $derived(leads < 0 ? "" : setName(board().sets[leads]!, leads));

  /* The one line above the picture, and the two facts that want it.
   *
   * **Where the key leads, and not only that it leads.** The corner says *that*
   * - and its title says where, which is a fact nobody reads. On a joining game
   * of twelve rounds every round wears the same arrow in the same seat, so the
   * board answered "one of these five carries on" and stopped there; which round
   * it carries on *to* is the other half of the same question, and it was a
   * hover away on the one screen somebody builds the chain on.
   *
   * **And the caption, where the panel decides one.** A key on PAGE_KEY with no
   * word of its own is drawn carrying the page's name. Said once where it
   * happens, or the name reads as a word somebody typed and never did.
   *
   * **Printed and said are two things, and the line says which.** Everywhere
   * else on this board a word on a cell is a word the key speaks - there are no
   * captions - and on this one seat it is what the display shows. The two
   * coincide on a key that speaks and come apart on a key that only leads
   * onward: that key prints the name and says nothing, and the board drew the
   * name with nothing to say so. Not the drawing that was wrong - all three
   * export doors write that label unconditionally and the spoken half only where
   * `says(act)` - but the line above it, which offered the name as though it
   * were a word.
   *
   * **The caption wins the line where both apply**, which is one seat with no
   * word on it. It explains something already drawn on the cell and has no other
   * mark; the target has the corner, and its name is a hover and a press away
   * there. A second line would push the picture down on one cell of five and
   * make the board disagree with the device about how a key is laid out.
   *
   * aria-hidden on the target, because the corner carries that same page name as
   * its accessible name. One fact read out twice is what somebody listening
   * rather than looking hears as two keys. */
  const caption = $derived(printsName(index) && !own
    ? t(says(act) ? "ui.diy_page_name_says" : "ui.diy_page_name_shows") : "");
  const eyebrow = $derived(goesTo ? t("ui.diy_leads_to", { name: goesTo }) : "");

  const open = (): void => { void editKey(index); };

  /* Alt and an arrow moves a key one place, which is the key editor-app uses for
   * the same act. It replaces arm-with-Enter, drop-with-Enter: that gesture had
   * two ends and a state between them, which needed a grip to hang the state on,
   * a mark on the grip, a sentence in the status line and an Escape to let go -
   * all of it for a swap between two panels.
   *
   * Over all five now, where it used to be the 2x2 block of speech keys: the one
   * cell it could not reach was the set key, and there is no set key. A move onto
   * the speaker's corner or off the board does nothing, which keyAt() is what
   * answers - the same six cells CELLS states, so a step can never land somewhere
   * there is no panel.
   *
   * Claimed even where the move has nowhere to go: Alt+Left is history-back in
   * some engines, and rearranging a board must never walk off the page. */
  function pressed(event: KeyboardEvent): void {
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
    const [row, column] = seatOf(index);
    const other = keyAt(row + step[0], column + step[1]);
    if (other < 0) return;
    swapSlots(index, other);
  }
</script>

<!-- Every cell is a drop target, filled or not: the five keys always exist, so
     a drop is always a swap and the other key moves exactly where this one came
     from. The hole has no dragover handler at all, which is what keeps it out of
     it - only a prevented dragover marks an element as a drop target. -->
<div
  class="cell"
  class:cell--namepanel={printsName(index)}
  class:cell--empty={!said && !slot.symbol}
  class:dragover={hovering(index)}
  draggable="true"
  ondragover={(event) => {
    const from = dragged();
    if (from === null || from === index) return;
    event.preventDefault();
    hover(index);
  }}
  ondragleave={() => unhover(index)}
  ondrop={(event) => {
    event.preventDefault();
    const from = dragged();
    endDrag();
    if (from === null || from === index) return;
    swapSlots(from, index);
  }}
  ondragstart={(event) => {
    startDrag(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    }
  }}
  ondragend={endDrag}
  role="presentation"
><!-- The widget inside a cell: what a press lands on. A div wearing
     role="button" rather than a <button>, for the reason editor-app's gives: its
     parent is dragged, and a real button captures the mousedown that would start
     the drag.
     A key with a picture and no sentence is a deliberate key rather than an
     unfinished one, so it is not announced as empty: the number names it, and
     only a key with neither is empty. --><div class="cell__open" role="button" tabindex="0" aria-label={said || (slot.symbol ? t("ui.key_n", { n: index + 1 }) : t("ui.diy_key_add"))} aria-haspopup="dialog" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" onclick={open} onkeydown={pressed}></div>{#if caption}<span class="cell__eyebrow">{caption}</span>{:else if eyebrow}<span class="cell__eyebrow" aria-hidden="true">{eyebrow}</span>{/if}{#if slot.symbol}{#if slot.negated}<!-- A crossed-out key comes back wrapped, because the cross has to be the size
     of the picture rather than of the cell - see .cell__crossed. Only then:
     every key that is not negated is the bare <img> it has always been. --><span class="cell__crossed"><Picture symbol={slot.symbol} className="cell__pic" /><Negate /></span>{:else}<Picture symbol={slot.symbol} className="cell__pic" />{/if}{/if}{#if said}<span class="cell__word">{said}</span>{/if}<!-- Hearing a key without opening it. The five-key board has had this on every
     key since it was written, and it is what somebody uses while looking at the
     board to check it reads right. A real <button>, because nothing drags it.
     Only where there is something to hear. A key that leads onward and says
     nothing has nothing to audition, and offering to play it would be offering
     silence.
     No ring on it, and that is the one place the two editors' cells differ on
     purpose. `.cell__play--now` marks the tablet's exception, the button that
     speaks at once instead of feeding the sentence bar; here that is what every
     speaking key does, and a mark on all of them is a mark on none. -->{#if said && says(act)}<button type="button" class="cell__play" title={t("ui.play_title")} aria-label={t("ui.play_title")} onclick={(event) => { event.stopPropagation(); void speak(said, event.currentTarget); }}>▶</button>{/if}<!-- And the corner that follows a key which leads onward.
     editor-app's `.cell__follow`, in the seat that stylesheet fixes for it - top
     right, with the play control top left, so a key that speaks *and* leads
     wears both without either standing aside. The two are drawn from one rule
     for both editors, which is why neither the class nor the geometry is
     restated here.
     The press switches the strip to that page rather than opening the key's own
     sheet, exactly as it opens a page on a tablet. The cell behind it still
     opens the sheet: a key that navigated when pressed would be the one key on
     the board nobody could ever edit. -->{#if goesTo}<button type="button" class="cell__follow" title={t("ui.page_follow", { name: goesTo })} aria-label={t("ui.page_follow", { name: goesTo })} onclick={(event) => { event.stopPropagation(); goToSet(leads); render(); }}>›</button>{/if}</div>
