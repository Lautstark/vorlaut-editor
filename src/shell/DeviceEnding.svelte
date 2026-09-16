<script lang="ts">
  /* The hand-off is the reason this export keeps its sheet open. Everything
   * before it happens on this page and the last step does not: the file is on
   * somebody's disk and the talker is on the table, and the page that joins the
   * two is a second address they have no reason to know. A link, at the moment
   * the file exists, is the whole of what stands between "exported" and a
   * device. */
  import { t } from "./live.svelte.js";
  import { TALKER_PAGE } from "./packageExport.svelte.js";
  import type { Exporting } from "./packageExport.svelte.js";
  /* Nothing is read off it: the sentence and the address are the same on every
     device export. The prop is here because the sheet hands one to whichever
     ending it is given, and a component that refused it would be the one shape
     the other ending could not also have. */
  let { s: _sheet }: { s: Exporting } = $props();
</script>

<!-- A new tab, because the Sammlung on this one is still open and going back to
     it should not be a reload of everything. -->
<p>{t("ui.device_export_next")} <a href={TALKER_PAGE} target="_blank" rel="noopener">{t("ui.device_export_open")}</a></p>
