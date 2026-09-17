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
   *
   * The column itself is `@lautstark/design/svelte/Sidebar` now -
   * conventions.md §6.3. What came with it is four things this page did not
   * have: `aria-expanded` and `aria-controls` on every control that shows or
   * hides it, Escape closing the drawer, focus moving to the ✕ as it opens and
   * back to whatever opened it as it closes, and the ✕ drawn only below the
   * breakpoint rather than drawn always and hidden by an id rule.
   *
   * What stayed here is what §6.3 says is the product's: every section with its
   * own heading and wrapper, the foot's one button, and the collapse control -
   * which lives inside the brand row as its second child, so a component-owned
   * chevron and a product-owned brand could not both be true. The brand snippet
   * is handed the wiring for it, which is the half of that control that is
   * about an element inside the component.
   *
   * None of the four glyphs changes. `✕` is what the component draws, `☰` is
   * `TopBar`'s default and this page passes no icon snippet over it, and `‹`
   * and `›` are on buttons that are still this page's markup.
   */
  import { t } from "./live.svelte.js";
  import { closeDrawer, closeOnPick, columnOpen, drawerOpen, showColumn }
    from "./sidebar.svelte.js";
  import { create } from "./collectionNew.svelte.js";
  import { openSettings } from "./voices.svelte.js";
  import Collections from "./Collections.svelte";
  import Sidebar from "@lautstark/design/svelte/Sidebar";

  /* `showing` is the live breakpoint already applied - the drawer below 820px,
     the remembered column above it - and the reveal and the bar are mounted
     beside this in Shell.svelte and cannot see it. So it is bound through. */
  let { logo, showing = $bindable(false) }:
    { logo: string; showing?: boolean } = $props();
</script>

<Sidebar id="sidebar" label={t("ui.collections")} closeId="sidebarClose"
  closeLabel={t("ui.collections_hide")} drawer={drawerOpen()}
  collapsed={!columnOpen()} bind:showing ondismiss={closeDrawer}>
  <!-- The mark, and the one control that is not the component's. On a phone
       the sidebar is a layer over the work and ✕ dismisses it; on a desktop it
       is a column of the page and ‹ puts the column away for good. The ✕ is
       the component's and is drawn only where its question is being asked; ‹
       is still hidden by a rule, because it is here.
       The two share a word, and so do the two that reveal: which one is on
       screen is a question about the width, not about the words. -->
  {#snippet brand(wired: { "aria-controls": string | undefined; "aria-expanded": boolean })}
    <h1><img src={logo} alt="" class="logo" />vorlaut</h1>
    <button id="sidebarHide" class="btn quiet icon" type="button" {...wired} title={t("ui.collections_hide")} aria-label={t("ui.collections_hide")} onclick={() => void showColumn(false)}>‹</button>
  {/snippet}

  <!-- One snippet for every section, headings and wrappers included, because a
       heading is part of what a search swaps in the product that has one. This
       page has a single section and no search, so what that buys here is
       simply that nothing about the shape of it had to move.
       The <h2> had an id, `#collectionsHeading`, and nothing anywhere has ever
       referenced it - almost certainly minted for an `aria-labelledby` the
       <nav> under it never used. The <nav> names itself, so the id goes rather
       than getting wired. -->
  {#snippet sections()}
    <div class="sidebar__part sidebar__grow">
      <h2>{t("ui.collections")}</h2>
      <Collections />
      <button id="collectionNew" class="btn quiet sm" type="button" onclick={() => { void create(); closeOnPick(); }}>{t("ui.collection_new")}</button>
    </div>
  {/snippet}

  <!-- One entrance, and only it. Importing lives inside the sheet, beside the
       prose that says what the format is: the sidebar holds the list, the way
       to make one, and the way out of the page. There was a gear in a
       page-wide header as well; the header has gone, and design.md §3.4
       settles the placement - two doors to one sheet is two things to keep in
       step for no gain.
       The `.sidebar__foot` around it is the component's, and `margin-top: auto`
       with it - which is the whole of §3.2's placement. -->
  {#snippet foot()}
    <button id="settingsLink" class="btn quiet sm" type="button" onclick={() => void openSettings()}>{t("ui.settings")}</button>
  {/snippet}
</Sidebar>
