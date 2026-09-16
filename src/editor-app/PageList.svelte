<script lang="ts">
  /**
   * The pages of the open Sammlung, down the sidebar under its row.
   *
   * **Navigation and nothing else.** No ⋯, no menu, nothing that changes
   * anything: a row is a mark, a name and a number. That is what makes the
   * keyboard behaviour below unambiguous - one row, one stop, one target - and
   * it is why everything that acts on a page sits over the board instead.
   *
   * ⌂ on the start page and ⚠ on a page nothing leads to, both at the left where
   * a column of them can be read down. The number on the right is what the page
   * costs to reach, by effort.ts; it is the only thing here that is not a name,
   * and it is the same number the facts line over the board unfolds.
   *
   * Handed to the shell through collectionPages() and mounted under the open
   * Sammlung's row: the sidebar is the shell's, an editor may import the shell
   * and not the other way round (tests/unit/layers.test.ts), and a talker
   * Sammlung registers nothing and gets no list at all.
   */
  import { t } from "../shell/live.svelte.js";
  import { addPage, reachable } from "./pages.js";
  import { effortByPage } from "./effort.js";
  import { at, board, commit, decimals, goToPage, page, pageName } from "./standing.svelte.js";

  /* board() inside each answer rather than held in a `$derived` - see the head
     of shell/live.svelte.ts. `pages` is a shallow copy for the same reason:
     addPage() pushes onto the array that is already there, so the array's own
     identity never moves and an each block reading it would never redraw. */
  const pages = $derived([...board().pages]);
  const found = $derived(reachable(board()));
  const cost = $derived(effortByPage(board()));
  const homeId = $derived(board().home);
  const hereId = $derived(page().id);

  let box: HTMLElement;

  /* Keeps the keyboard where it was.
   *
   * The rows are keyed by page id, so a redraw no longer throws the focused
   * element away - which is what the old `wantFocus` dance was mostly repairing.
   * What is left is the one case where focus genuinely has to move: an arrow
   * key walks to the *next* page, and the row that should now hold the keyboard
   * is a different row. goToPage() sets the flag when the press came from this
   * list; this is what acts on it. */
  $effect(() => {
    at.here;
    if (!at.wantFocus) return;
    at.wantFocus = false;
    (box.querySelector('.pagelist__item[aria-current="true"]') as HTMLElement | null)?.focus();
  });

  /* Up and down walk the list, which is what replaces the "previous page" and
     "next page" a bar would have needed. Bound to the row rather than to the
     document on purpose: in the name field over the board, and in every other
     field on this page, those two keys belong to the field. */
  function walk(event: KeyboardEvent, index: number): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const next = board().pages[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (next) goToPage(next.id);
  }

  /* And the way to make one, under the list rather than over the board. It
     belongs to the set of pages, not to the page on screen, which is the same
     argument that puts "+ Neue Sammlung" under the list of Sammlungen. */
  function make(): void {
    const made = addPage(board());
    /* Straight onto it, so the name field over the board is the next thing
       under the hand - the page was made in order to be filled in. */
    at.here = made.id;
    at.unfolded = null;
    at.wantFocus = false;
    at.wantName = true;
    commit();
  }
</script>

<div bind:this={box} class="pagelist" id="collectionPages" role="listbox" aria-label={t("ui.app_pages_list")}>{#each pages as one, index (one.id)}<button type="button" class="pagelist__item" role="option" aria-selected={one.id === hereId} aria-current={one.id === hereId ? "true" : undefined} data-page={one.id} onclick={() => goToPage(one.id)} onkeydown={(event) => walk(event, index)}>{#if one.id === homeId}<span class="pagelist__home" title={t("ui.app_page_home")}>⌂</span>{/if}{#if !found.has(one.id)}<span class="tab__lost" title={t("ui.app_page_unreachable")}>⚠</span>{/if}<span class="pagelist__name">{pageName(one)}</span><span class="pagelist__cost">{cost.get(one.id) === undefined ? "—" : decimals.format(cost.get(one.id)!)}</span></button>{/each}<button type="button" class="pagelist__new" onclick={make}>{t("ui.app_page_new")}</button></div>
