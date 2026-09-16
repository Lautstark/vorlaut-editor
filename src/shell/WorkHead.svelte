<script lang="ts">
  /* Everything that acts on the open Sammlung, or reports on it.
   *
   * `name · … · status · what the editor puts there · ⋯`, across the whole
   * content column rather than inside the capped one: with no bar above it, it
   * is the top of the page and reads better as a full-width band than as a
   * short row floating over the middle. The gap is where the auto margin is:
   * the name is at one end, and everything that acts on the Sammlung or reports
   * on it is grouped at the other. The status was next to the name, where a
   * word that comes and goes sat a few characters from a field being typed in;
   * it belongs beside the controls it is reporting on. The count is not in it -
   * the sidebar row already carries one per Sammlung.
   */
  import { menuOn } from "@lautstark/design/menu";
  import { t } from "./live.svelte.js";
  import { useStatus } from "./dom.js";
  import { useHeadHole } from "./holes.js";
  import { collectionMenu, useNameField } from "./collections.js";

  let field: HTMLInputElement;
  let line: HTMLElement;
  let slot: HTMLElement;
  let more: HTMLButtonElement;

  $effect(() => {
    useNameField(field);
    useStatus(line);
    useHeadHole(slot);
  });
</script>

<div class="workhead">
  <!-- The name IS the field that renames it - bildhaft's title input. No
       dialog and no menu entry: renaming a thing you are looking at should be
       typing over its name.
       A field with no visible label: the Sammlung's name is its own heading,
       and a word in front of it would be a second one. So the name has to be
       said to whoever cannot see that. -->
  <input bind:this={field} type="text" id="collectionName" class="title-input" autocomplete="off" aria-label={t("ui.collection_name")} />
  <!-- role="status" is aria-live="polite", and it belongs on the element
       rather than being set when there is something to say: a live region
       has to be in the accessibility tree already when the text lands, or
       the reader has nothing to notice a change in.

       Between the name and the editor's slot in the markup, and drawn at
       the far end by the auto margin on it - so what is read out in order
       is what is read across. It is the first of the group at that end,
       which puts it immediately left of whatever the editor puts there. -->
  <span bind:this={line} class="status" id="status" role="status"></span>
  <span bind:this={slot} class="tools" id="collectionAction"></span>
  <!-- One character wide, and that character is not a word, so it is named. -->
  <span class="menu-anchor"><button bind:this={more} id="collectionMenu" class="btn quiet icon" type="button" aria-haspopup="menu" aria-expanded="false" title={t("ui.collection_menu")} aria-label={t("ui.collection_menu")} onclick={(event) => { event.stopPropagation(); menuOn(more, collectionMenu); }}>⋯</button></span>
</div>
