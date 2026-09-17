<script lang="ts">
  /** The page itself: what it is called.
   *
   * Two rows went out of this sheet on the day it stopped being the set key's as
   * well, and they are not lost - they are in the key sheet, on all five keys
   * instead of on one. What a key says and what it does were asked here with one
   * answer more than a speech key had, **Reihum**, and that answer is what the
   * ring was. The picture column went with them, for the same reason: the
   * picture on the page-key panel is that key's picture, edited where the other
   * four are.
   *
   * **The colour went first**, one change earlier: it was three controls in
   * three places, then one row of swatches held here until the firmware stopped
   * reading it, and `BoardSet.color` outlived the row only because data/obf.ts
   * wrote it into a .obf and tests/reference/obf.lock.json froze both
   * directions.
   *
   * What is left is a name and a way to delete, which is what a tablet's page
   * card holds one editor along.
   */
  import { t } from "../shell/live.svelte.js";
  import { focusOnOpen } from "../shell/parts.js";
  import FormRow from "../shell/pieces/FormRow.svelte";
  import type { PageSheet } from "./pageSheet.svelte.js";

  let { s }: { s: PageSheet } = $props();
  let field: HTMLInputElement;

  /* The one field, so the sheet opens in it. Every sheet with a picture column
     opens in the search instead, and this one has none - see the note at the
     foot of openSheet().
     Through focusOnOpen(), because the frame shows the sheet from an effect of
     its own and this one runs first - shell/parts.ts says why. */
  $effect(() => { focusOnOpen(() => field.focus()); });
</script>

<FormRow label={t("ui.set_name")} note={t("ui.set_name_note")} forId="diySetName">
  {#snippet children({ describedBy })}<input bind:this={field} id="diySetName" class="field" type="text" autocomplete="off" placeholder={t("ui.set_name")} aria-describedby={describedBy || undefined} value={s.draft.name} oninput={(e) => { s.draft.name = e.currentTarget.value; }} />{/snippet}
</FormRow>
