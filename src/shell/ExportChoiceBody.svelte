<script lang="ts">
  /* Which file this Sammlung should become: the one it is for, above the fold,
   * and whatever else it can honestly be written as inside a panel that has to
   * be opened.
   *
   * A card fires rather than selects, which is where this differs from
   * askTarget(): that dialog has a second question inside it and this one has
   * none. Nothing is written on the press either - both exports cost minutes,
   * and each opens the sheet that names the Sammlung and asks again before
   * anything is synthesised. */
  import { t } from "./live.svelte.js";
  import type { ExportChoice } from "./collectionExport.js";

  let { s }: { s: ExportChoice } = $props();
</script>

<!-- No aria-pressed, unlike askTarget's cards: these fire rather than hold a
     selection, and a button claiming a pressed state it never keeps is worse for
     somebody reading it out than one that claims nothing. The lead card is
     marked with a class of its own for that reason - it is the one to press,
     which is not the same claim as the one in force. -->
<button type="button" class="btn choice choice--lead" onclick={() => s.take(s.lead)}><strong>{t(`ui.collection_export_for_${s.lead.which}`)}</strong><span>{t(`ui.collection_export_for_${s.lead.which}_note`)}</span></button>

<!-- The fold, and it is design's own <details class="panel"> rather than
     anything invented here: a heading that says what is behind it, the browser's
     own toggle and keyboard behaviour, and no JavaScript of ours in the middle
     of it. Its summary holds text and no button, which that component requires
     and this one has no reason to break.
     Closed on open, every time. The point of the fold is that the Sammlung's own
     export is the only thing to press until somebody says otherwise. -->
<details class="panel">
  <summary><span class="section">{t("ui.collection_export_otherwise")}</span></summary>
  <div class="body">{#each s.otherwise as door (door.which)}<button type="button" class="btn choice" onclick={() => s.take(door)}><strong>{t(`ui.collection_export_for_${door.which}`)}</strong><span>{t(`ui.collection_export_for_${door.which}_note`)}</span></button>{/each}</div>
</details>
