<script lang="ts">
  /* The list of Sammlungen, and the pages of the open one under it.
   *
   * The rows are @lautstark/design/collections' - a vanilla drawing, like the
   * four shared panels in the two sheets - so what this component owns is the
   * box they go in and the moment the list is handed over. shell/collections.ts
   * still decides what a row says.
   *
   * The pages under the open row are an editor's, and they are a component the
   * editor registered: the sidebar is the shell's, an editor may import the
   * shell and not the other way round (tests/unit/layers.test.ts), and what
   * belongs in that list is entirely the editor's business - the talker passes
   * nothing and gets no list at all.
   */
  import { t } from "./live.svelte.js";
  import { useList } from "./collections.js";

  let list: HTMLElement;
  $effect(() => { useList(list); });
</script>

<!-- Filled by shell/collections.ts on every change to the list. Written empty
     and never touched again from here: what is inside it is the package's
     rows, and Svelte owning half of a box somebody else fills is the one way
     these two idioms can hurt each other. -->
<nav bind:this={list} class="collections sidebar__list" id="collectionList" aria-label={t("ui.collections")}></nav>
