<script lang="ts">
  /* The foot: the destructive act on the left, the way onward and the
     confirming press on the right.
     The three presses are shell/sheet.svelte.ts's, because the guard that makes
     the promise settle exactly once lives in that closure. */
  import type { Sheet } from "../sheet.svelte.js";

  let { s }: { s: Sheet<unknown> } = $props();
</script>

{#if s.spec.remove}<button type="button" class="btn destructive" onclick={() => s.remove()}>{s.spec.remove.label}</button>{:else}<!-- The foot puts the destructive act on the left and the confirming one on
     the right; with nothing on the left the spacer is what keeps the right
     where it is on every other sheet. --><span></span>{/if}
<span class="foot__right">{#if s.spec.next}<button type="button" class="btn quiet" onclick={() => s.next()}>{s.spec.next.label}</button>{/if}<button type="button" class="btn primary" onclick={() => s.done()}>{s.spec.done.label}</button></span>
