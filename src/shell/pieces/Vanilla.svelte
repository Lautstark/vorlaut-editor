<script lang="ts">
  /* A node built outside Svelte - one of the family's shared panels, which are
     plain DOM by design - standing among components. `display: contents` keeps
     the wrapper out of the layout, so the panel sits in its parent's grid or
     flex as the direct child it would otherwise have been; nothing in the
     stylesheets addresses these panels by parent, which is what makes the
     wrapper safe.

     wochenwerk's, unchanged, and that is the point of it being the same six
     lines twice: @lautstark/sicherung's two panels, @lautstark/bildquelle's
     METACOM panel and @lautstark/stimmquelle's voice picker are the same four
     nodes in both products, and the day they become components they become
     components once. */
  let { node }: { node: Node | null | undefined } = $props();
  let host: HTMLElement;
  $effect(() => { if (node) host.replaceChildren(node); else host.replaceChildren(); });
</script>

<div bind:this={host} style="display:contents"></div>
