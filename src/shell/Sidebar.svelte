<script lang="ts">
  /* The Sammlungen down the side: the list, the way to make one, and the way
   * out of the page.
   *
   * **There is no header on a desktop.** That is not an omission - it is what
   * both siblings do, and this page had invented a third answer. bildhaft's
   * `.topbar` is `display: none` until the mobile breakpoint and mitreden's the
   * same; on a desktop the mark lives at the top of the sidebar, beside the
   * control that puts the sidebar away, and there is nothing spanning the
   * window. So: the mark and the collapse are the sidebar's brand row, and
   * Einstellungen is the sidebar's foot - one entrance, design.md §3.4.
   */
  import { t } from "./live.svelte.js";
  import { closeDrawer, closeOnPick, drawerOpen, showColumn } from "./sidebar.svelte.js";
  import { create } from "./collectionNew.svelte.js";
  import { openSettings } from "./voices.svelte.js";
  import Collections from "./Collections.svelte";

  let { logo }: { logo: string } = $props();
</script>

<aside class="sidebar" id="sidebar" class:open={drawerOpen()}>
  <div class="sidebar__brand">
    <h1><img src={logo} alt="" class="logo" />vorlaut</h1>
    <!-- Two controls, because they answer two different questions: on a phone
         the sidebar is a layer over the work and ✕ dismisses it; on a desktop
         it is a column of the page and ‹ puts the column away for good. Each
         is hidden at the width where its question is not being asked.
         The two share a word, and so do the two that reveal: which one is on
         screen is a question about the width, not about the words. -->
    <button id="sidebarHide" class="btn quiet icon" type="button" title={t("ui.collections_hide")} aria-label={t("ui.collections_hide")} onclick={() => void showColumn(false)}>‹</button>
    <button id="sidebarClose" class="btn quiet icon" type="button" title={t("ui.collections_hide")} aria-label={t("ui.collections_hide")} onclick={closeDrawer}>✕</button>
  </div>

  <div class="sidebar__part sidebar__grow">
    <h2 id="collectionsHeading">{t("ui.collections")}</h2>
    <Collections />
    <button id="collectionNew" class="btn quiet sm" type="button" onclick={() => { void create(); closeOnPick(); }}>{t("ui.collection_new")}</button>
  </div>

  <!-- One entrance, and only it. Importing lives inside the sheet, beside the
       prose that says what the format is: the sidebar holds the list, the way
       to make one, and the way out of the page. There was a gear in a
       page-wide header as well; the header has gone, and design.md §3.4
       settles the placement - two doors to one sheet is two things to keep in
       step for no gain. -->
  <div class="sidebar__foot">
    <button id="settingsLink" class="btn quiet sm" type="button" onclick={() => void openSettings()}>{t("ui.settings")}</button>
  </div>
</aside>
