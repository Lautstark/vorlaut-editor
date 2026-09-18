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
  import TitleField from "@lautstark/design/svelte/TitleField";
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

  /* The hand-rolled guard is gone, and that is what this adoption is for.
     It checked one of refresh()'s three conditions - it declined while the
     field was focused, but not while a keystroke was waiting out its debounce
     and not when the value already agreed. That is the in-flight-repaint bug
     rename.js was written for, and it was still live in the product that found
     it (conventions.md §6.5). refresh() is the only way the field is assigned
     now, and it holds all three.

     A page made from the list under the sidebar was made in order to be filled
     in, so the field is the next thing under the hand. The press is in another
     component and the field is this one's; the flag stays exactly as it was and
     is `caret` now, which is the same handover said in the component's words.

     `select` is false: the name this field opens on is a placeholder - "Seite
     3" - rather than a name somebody would want replaced wholesale. */
  const caret = {
    asked: (): boolean => at.wantName,
    answered: (): void => { at.wantName = false; },
  };

  /* Typed straight into the page, saved on the debounce that every other field
     here uses - no sheet, no Fertig, nothing to dismiss.
     render() and not commit(): the two lists that carry this same name are
     drawn from the layout and have to be told it moved, but the writing on this
     path is saveSoon()'s, which is what makes it a keystroke rather than a
     structural change.

     This is the `oninput` echo §6.5 corrects itself to allow, and it is the
     reason it exists: rename.js binds with addEventListener rather than taking
     the property precisely so a product can keep its own listener, and a
     component with only the debounced write would move these repaints to 400ms
     after typing stops. The e2e types and then asserts, so that is not a
     latency question. */
  function typed(value: string): void {
    page().name = value;
    render();
    saveSoon();
  }

  /* And the debounced write, which on this page is the same assignment arriving
     late. It is not a second act: the name lives in the layout and the echo
     above has already put it there, and persistence is saveSoon()'s rather than
     this callback's - so nothing here re-arms a timer or repaints. What it buys
     is the window: while it is owed, refresh() declines, which is the condition
     the hand-rolled guard did not have. */
  function written(value: string): void {
    page().name = value;
  }
</script>

<div class="pagehead"><span class="pagehead__home" id="appPageHome" hidden={!isHome} title={t("ui.app_page_home")}>⌂</span><TitleField id="appPageName" class="pagehead__name" label={t("ui.app_page_name")} placeholder={t("ui.app_page_n", { n: position })} value={named} select={false} write={written} oninput={(e) => typed(e.currentTarget.value)} {caret} /><span class="pagehead__warn" id="appPageWarn" hidden={reachableHere} title={t("ui.app_page_unreachable")}>⚠</span><button class="pagehead__act" id="appPageStart" type="button" hidden={isHome} onclick={() => { board().home = page().id; commit(); }}>{t("ui.app_page_home_set")}</button><button class="pagehead__del" id="appPageDelete" type="button" onclick={() => { void askDelete(page()); }}>{t("ui.app_page_delete")}</button></div>
