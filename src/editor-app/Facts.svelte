<script lang="ts">
  /**
   * One line of numbers: what leads here, where it leads, what it costs, how
   * much is on it. Three of the four unfold.
   *
   * **Both directions are real edges.** inboundTo() and opens() are the graph
   * read forwards and backwards; nothing here is derived from a walk that had to
   * pick a parent. That is the whole difference between this line and the five
   * drawings it replaces - a path, a row of tiles, a picker and a count, each of
   * which made a claim about the graph that the graph does not support.
   *
   * **The path went for a reason worth writing down.** `route()` walked
   * breadth-first and took the shortest chain, so where two ways reach a page it
   * showed one of them, arbitrarily, as though it were *the* way. On a graph
   * where a Food page hangs off both Meals and Morning - the ordinary case this
   * editor is built for - a breadcrumb cannot be truthful. What it was really
   * trying to answer is "what leads here", and that question has an exact answer
   * in inboundTo(): all of them, not one.
   *
   * **Only one zero is a fault, and only it is coloured.** Nothing leading to a
   * page that is not the start page is the state that makes it invisible on the
   * tablet. A page leading nowhere is a leaf, and most pages of a board are
   * leaves - a board where every page led onward would be a board with no words
   * on it. Colouring that would be an editor tutting at ordinary work.
   *
   * The start page has nothing leading to it and that is not a fault either: the
   * tablet opens with it. Its zero is left plain and says so when unfolded.
   */
  import { t } from "../shell/live.svelte.js";
  import { opens, sharedColumn } from "./pages.js";
  import { effortByPage, pageEffort } from "./effort.js";
  import { cheapestWay, inboundPages, kindsOf } from "./pageHead.js";
  import { at, board, decimals, goToPage, page, pageName } from "./standing.svelte.js";

  let { found }: { found: Set<string> } = $props();

  /* Every one of these calls board() or page() inside itself rather than
     reading a `$derived` that holds one: the layout is the same object before
     and after an edit, so a derived of it says nothing changed. See the head of
     shell/live.svelte.ts. What is derived here is an answer - a list, a number,
     a Set - which is what a derived is for. */
  const into = $derived(inboundPages(board(), page().id));
  const outOf = $derived(opens(board(), page().id));
  const cost = $derived(effortByPage(board()).get(page().id));
  const column = $derived(sharedColumn(board()));
  const full = $derived(page().buttons.length + column.length);
  const isHome = $derived(page().id === board().home);
  const grid = $derived(board().grid.rows * board().grid.columns);

  /** One number, pressable, with what it says beside it.
   *
   * The button count is the one that reads the other way round - "12 Tasten"
   * rather than "Tasten 12" - because it is a quantity of things and the two
   * before it are directions with a count. So it composes its own words and this
   * takes them whole. */
  const said = (key: string, label: string, value: number): string =>
    key === "full"
      ? t(value === 1 ? "ui.app_pages_buttons_one" : "ui.app_pages_buttons", { n: value })
      : `${label} ${key === "cost" ? decimals.format(value) : String(value)}`;

  function unfold(key: string): void {
    at.unfolded = at.unfolded === key ? null : key;
  }

  /** What the buttons on this page do, counted. By act rather than by word
   *  class: the classes are already on the board, in the colours, so counting
   *  them here would be the same fact twice. */
  const split = $derived(kindsOf([...page().buttons, ...column], column.length));
  const way = $derived(cost === undefined ? [] : cheapestWay(board(), page().id));
  const set = $derived(at.unfolded === "in" ? into : outOf);
</script>

<!-- The separator between two facts. A middot rather than a rule: the line is a
     sentence of numbers, and a rule would make it a toolbar. -->
{#snippet dot()}<span class="facts__dot" aria-hidden="true">·</span>{/snippet}

<div class="facts" id="appFacts"><button type="button" class="facts__one{into.length === 0 && !isHome ? ' facts__zero' : ''}" aria-expanded={at.unfolded === "in"} onclick={(e) => { e.stopPropagation(); unfold("in"); }}>{said("in", t("ui.app_page_here"), into.length)}</button>{@render dot()}<button type="button" class="facts__one" aria-expanded={at.unfolded === "out"} onclick={(e) => { e.stopPropagation(); unfold("out"); }}>{said("out", t("ui.app_page_from_here"), outOf.length)}</button>{@render dot()}{#if cost === undefined}<span class="facts__plain facts__zero">{t("ui.app_page_unreachable")}</span>{:else}<button type="button" class="facts__one" aria-expanded={at.unfolded === "cost"} onclick={(e) => { e.stopPropagation(); unfold("cost"); }}>{said("cost", t("ui.app_page_effort"), cost)}</button>{/if}{@render dot()}<button type="button" class="facts__one" aria-expanded={at.unfolded === "full"} onclick={(e) => { e.stopPropagation(); unfold("full"); }}>{said("full", "", full)}</button></div>

<!--
  What the open number says, under the line.

  Text links with middots between them, not chips: a row of names reads as a
  sentence and a row of boxes reads as a second toolbar, which is the thing this
  whole change is removing.
-->
<div class="factlinks" id="appFactLinks" hidden={at.unfolded === null || (at.unfolded === "cost" && cost === undefined)}>{#if at.unfolded === "full"}<!--
  How full the page is, which is the fact the bare count was missing.
  Twelve buttons means something different on a 3x5 than on a 6x11, and the
  difference is not cosmetic: `field_size` in the effort number grows with every
  button on screen, so how full a page is *is* part of what it costs. The second
  line is the shared first column, which is on this page and on every other one -
  it is counted here because it is drawn here, and said because somebody
  wondering why a page has more buttons than they put on it deserves the answer.
--><span class="factlinks__line">{t("ui.app_page_buttons_fill", { n: full, all: grid })}</span>{#if split.length}<span class="factlinks__line factlinks__sum">{split.map(([label, n]) => `${label} ${n}`).join("  ·  ")}</span>{/if}{:else if at.unfolded === "cost"}{#if cost !== undefined}<!--
  The arithmetic, page by page along the cheapest way here. Shown rather than
  summarised, because a number somebody is asked to act on should be one they
  can check.
--><span class="factlinks__line factlinks__sum">{way.map((step, index) => index ? `+ ${decimals.format(1)} + ${decimals.format(pageEffort(board(), step))} (${pageName(step)})` : `${decimals.format(pageEffort(board(), step))} (${pageName(step)})`).join(" ")}</span><span class="factlinks__line">{t("ui.app_page_effort_what", { n: decimals.format(1) })}</span><!--
  Where the arithmetic comes from, and deliberately nothing more. The CARE
  numbers published beside it average this over English core word lists, so they
  are no yardstick for a German board - see effort.ts.
--><a class="factlinks__line" href="https://www.openaac.org/vocabularies/" target="_blank" rel="noreferrer noopener">{t("ui.app_page_effort_more")}</a>{/if}{:else if !set.length}{#if at.unfolded === "out"}<span class="factlinks__line">{t("ui.app_page_opens_none")}</span>{:else if isHome}<span class="factlinks__line">{t("ui.app_page_here_home")}</span>{:else}<span class="factlinks__line facts__zero">{t("ui.app_page_here_none")}</span>{/if}{:else}{#each set as other, index (other.id)}{#if index}{@render dot()}{/if}<button type="button" class="factlinks__to" onclick={(e) => { e.stopPropagation(); goToPage(other.id); }}>{#if !found.has(other.id)}<span class="tab__lost" title={t("ui.app_page_unreachable")}>⚠</span>{/if}{pageName(other)}</button>{/each}{/if}</div>
