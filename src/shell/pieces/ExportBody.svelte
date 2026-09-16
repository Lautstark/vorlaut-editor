<script lang="ts">
  /* Two steps in one dialog, which does not close between them: what is about
     to be written, then the writing, then whatever the export has to say once
     the bytes exist. */
  import type { Exporting } from "../packageExport.svelte.js";
  let { s }: { s: Exporting } = $props();
  const Ending = $derived(s.what.ending);
</script>

{#if s.made}<Ending {s} />{:else}<p>{s.line}</p>{/if}
