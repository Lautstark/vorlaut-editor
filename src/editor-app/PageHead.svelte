<script lang="ts">
  /**
   * The page's own head: the name, and the two things that can be done to it.
   *
   * **The name is the field that renames it.** shell/WorkHead.svelte settles
   * that for a Sammlung - "renaming a thing you are looking at should be typing
   * over its name" - and a page was the last name in this editor that had to go
   * through a menu to change. With renaming out of it, the ⋯ that used to sit
   * beside the path held two entries, and then one, and a menu with one entry is
   * not a menu.
   *
   * **The ⌂ appears only on the start page.** It is a mark for a state, not a
   * switch for one: on any other page it would be a house standing over a page
   * that is not the start page, which is the sort of thing a reader has to test
   * by pressing. Getting there is an act, so it is an act - a quiet word at the
   * right end, and only where it would do something.
   */
  import { t } from "../shell/live.svelte.js";
  import { saveSoon } from "../core/save.js";
  import { askDelete } from "./pageHead.js";
  import { at, board, commit, page, render } from "./standing.svelte.js";

  let { found }: { found: Set<string> } = $props();

  /* board() and page() are called where they are read rather than held in a
     `$derived`: the layout is the same object before and after every edit, so a
     derived of it propagates nothing. See the head of shell/live.svelte.ts. */
  const named = $derived(page().name);
  const isHome = $derived(page().id === board().home);
  const position = $derived(board().pages.indexOf(page()) + 1);
  const reachableHere = $derived.by(() => found.has(page().id));
  let name: HTMLInputElement;

  /* The value is written back only when this is not the field somebody is
     typing in: assigning under the caret moves it to the end on every
     keystroke. `value` rather than `bind:value` for exactly that - a binding
     would write the page's name into the element on every redraw, which is the
     assignment this guard exists to prevent. */
  $effect(() => {
    named;
    if (document.activeElement !== name) name.value = page().name;
  });

  /* A page made from the list under the sidebar was made in order to be filled
     in, so the field is the next thing under the hand. The press is in another
     component and the field is this one's, so the answer travels as a flag -
     which is what replaced `byId("appPageName").focus()`. */
  $effect(() => {
    if (!at.wantName) return;
    at.wantName = false;
    name.focus();
  });

  /* Typed straight into the page, saved on the debounce that every other field
     here uses - no sheet, no Fertig, nothing to dismiss.
     render() and not commit(): the two lists that carry this same name are
     drawn from the layout and have to be told it moved, but the writing on this
     path is saveSoon()'s, which is what makes it a keystroke rather than a
     structural change. */
  function typed(value: string): void {
    page().name = value;
    render();
    saveSoon();
  }
</script>

<div class="pagehead"><span class="pagehead__home" id="appPageHome" hidden={!isHome} title={t("ui.app_page_home")}>⌂</span><input bind:this={name} type="text" id="appPageName" class="pagehead__name" autocomplete="off" aria-label={t("ui.app_page_name")} placeholder={t("ui.app_page_n", { n: position })} oninput={(e) => typed(e.currentTarget.value)} /><span class="pagehead__warn" id="appPageWarn" hidden={reachableHere} title={t("ui.app_page_unreachable")}>⚠</span><button class="pagehead__act" id="appPageStart" type="button" hidden={isHome} onclick={() => { board().home = page().id; commit(); }}>{t("ui.app_page_home_set")}</button><button class="pagehead__del" id="appPageDelete" type="button" onclick={() => { void askDelete(page()); }}>{t("ui.app_page_delete")}</button></div>
