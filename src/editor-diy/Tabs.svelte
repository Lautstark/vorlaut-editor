<script lang="ts">
  /* The set strip, and the line under it saying how many pages there are.
   *
   * **Nothing reorders the pages.** Reordering was how the ring was steered, and
   * the ring is gone; the strip draws them in the order the device reaches them
   * instead - editor-diy/pages.ts's pageOrder(). Rearranging did not disappear,
   * it moved: what used to be dragging a tab is now changing where a key points,
   * and that can say things a list of positions never could.
   *
   * **How many pages there are, and the cap only where it bites.** This read
   * "{used} of {max} places on the device taken" while the cap was five, and at
   * five that was the useful sentence: the last page was in sight from the
   * first. At sixty-four it is a meter that never moves, repeating a figure
   * nothing on this screen can act on and, worse, implying scarcity where there
   * is none. So the line says how many pages there are, and the cap turns up only
   * on the press that would have made one too many, where "+ Neue Seite" is no
   * longer in the strip. That absence was self-explanatory at five, because a
   * full strip was five tabs anybody could see at once. At sixty-four the button
   * just stops being there, and a sentence is what is left to say why.
   */
  import { t } from "../shell/live.svelte.js";
  import { limits } from "../core/boot.js";
  import { addPage, pageOrder, unreachable } from "./pages.js";
  import { openPageSheet } from "./pageSheet.svelte.js";
  import { at, board, commit, goToSet, render, setName } from "./standing.svelte.js";

  /* board() inside each answer rather than held in a `$derived`: the layout is
     the same object before and after every edit, so a derived of it propagates
     nothing and the strip would go on drawing the pages from before the press.
     See the head of shell/live.svelte.ts - this is the one that found it. */
  const shown = $derived(pageOrder(board()));
  const lost = $derived(new Set(unreachable(board())));
  const used = $derived(board().sets.length);
  const names = $derived(shown.map((index) => setName(board().sets[index]!, index)));

  let strip: HTMLElement;

  /* The open tab, kept in view.
   *
   * The strip is bounded and scrolls - see `.tabs` in ui.css - so the tab that
   * is open can be outside it after a redraw that nobody scrolled for: opening a
   * Sammlung of twenty-four pages, following a key to a page thirty tabs down,
   * deleting the page above the one that takes its place. `block: "nearest"`
   * scrolls the strip and nothing else, so the page does not jump, and on a strip
   * short enough not to scroll it has nothing to do.
   *
   * Found by where the open page was drawn rather than by its place in the
   * layout: the strip is in reachability order and the two are not the same list.
   *
   * Guarded rather than called outright: scrollIntoView is a layout call and not
   * every environment this module is loaded in has one, and nothing about the
   * strip depends on it having happened. */
  $effect(() => {
    const showing = strip.children[shown.indexOf(at())] as HTMLElement | undefined;
    if (typeof showing?.scrollIntoView === "function") {
      showing.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  });

  function open(index: number): void {
    goToSet(index);
    render();
  }
</script>

<div bind:this={strip} class="tabs" id="tabs">{#each shown as index, place (board().sets[index]?.id ?? index)}<!-- Which tab is the open one is the stylesheet's rather than a colour
     written on the element: it was the set's own colour on the border, with a
     square of the same colour beside the name. Both went with the colour, and
     the square would have been the worse thing to keep - the same value on every
     tab, saying only that a set is a set.
     Not a <button>, although it is pressed like one: it holds the ⋯ below, which
     is pressed itself, and a button inside a button is not a shape the engines
     agree about. So the div stays, and the two things the element would have
     brought - a place in the tab order, acting on Enter and Space - are written
     out.
     It is not dragged any more, and that is the change rather than an oversight.
     Dragging a tab reordered the pages, and reordering was how somebody steered
     the ring. With targets in the file instead, a drag would move a page in the
     strip and change nothing about where anything leads - a gesture that looks
     like it did something. --><div class="tab{index === at() ? ' active' : ''}" role="button" tabindex="0" aria-current={index === at() ? "true" : undefined} onclick={() => open(index)} onkeydown={(event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  open(index);
}}>{#if lost.has(index)}<!-- The mark on a page nothing leads to, which is editor-app's `.tab__lost`
     and the same warning triangle it puts on a crumb. Reported and never
     enforced - pages.ts has the argument - so it is a mark and not a refusal,
     and it names what is wrong on hover rather than only looking wrong. --><span class="tab__lost" title={t("ui.diy_page_unreachable")}>⚠</span>{/if}<span>{names[place]}</span><!-- The way into the page's own card, and now the only one.
     It used to be a second door - the set key opened the same thing - and that
     was the fifth cell being the one cell on the board that did not open what it
     was. It opens its own key now, like the other four, so the page itself has
     one door and this is it.
     A <span> wearing role="button" because it sits inside something that is
     already pressed. Every tab gets the element and only the current one gets
     the control, which is the same reason editor-app's strip had: the strip
     reflowed on every switch. The reserved copies are `visibility: hidden` - the
     box, and nothing in the accessibility tree or the tab order. -->{#if index === at()}<span class="tab__more" role="button" tabindex="0" aria-label={t("ui.set_more")} onclick={(event) => {
  // Or the press falls through to the tab, which would redraw the strip out
  // from under the sheet that is opening.
  event.stopPropagation();
  void openPageSheet();
}} onkeydown={(event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  void openPageSheet();
}}>⋯</span>{:else}<span class="tab__more tab__more--idle" aria-hidden="true">⋯</span>{/if}</div>{/each}{#if used < limits.maxSets}<button class="tab add" type="button" onclick={() => {
  /* Appended, and nothing pointed at it - addPage() is where that decision is
     written out. So it arrives at the end of the strip wearing the mark for a
     page nothing leads to, which is what it is until somebody points a key at
     it, and it is opened at once so that the next press can. */
  const layout = board();
  addPage(layout);
  goToSet(layout.sets.length - 1);
  commit();
}}>{t("ui.add_set")}</button>{/if}</div>

<div class="slots" id="slots">{used < limits.maxSets ? t("ui.sets_count", { used }) : t("ui.sets_full", { used })}</div>
