<script lang="ts">
  /* The body of the sheet both editors open: a sentence across the top where
     there is one, the picture column on the left where there is one, and the
     caller's rows on the right.
     Mounted straight into @lautstark/design/dialog's own `.body`, with no
     wrapper - components.css styles that element's children directly, and a box
     in between would take those rules away. See shell/sheet.svelte.ts. */
  import type { Sheet } from "../sheet.svelte.js";
  import Pick from "./Pick.svelte";

  let { s }: { s: Sheet<unknown> } = $props();
  const Rows = $derived(s.spec.rows);

  /* Enter in a text field is Fertig.
   *
   * A sheet is not a <form> - see the search field's own note - so nothing gave
   * Enter a meaning here, and a sheet whose one remaining act is the primary
   * button had to be finished with the mouse or with four Tabs.
   *
   * On the rows and not on the sheet, which is what keeps this from colliding
   * with the two places Enter already means something: the search field is in
   * the other column, where Enter runs the search, and a tile in the grid is a
   * button, where Enter takes the picture.
   *
   * Text inputs only, and never Weiter. A dropdown's trigger is a button and
   * Enter opens its menu; and Fertig rather than Weiter because Weiter is the
   * one that does not close - a key finished with Enter should be finished, and
   * somebody working through a run has Weiter under the pointer and under Tab.
   */
  function maybeDone(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    const on = event.target;
    if (!(on instanceof HTMLInputElement) || on.type !== "text") return;
    event.preventDefault();
    s.done();
  }
</script>

{#if s.spec.notice}<div class="notice">{s.spec.notice}</div>{/if}
{#if s.spec.pick}<Pick spec={s.spec.pick} held={s.held} />{/if}
<div class="form" onkeydown={maybeDone} role="presentation"><Rows s={s.spec.state} /></div>
