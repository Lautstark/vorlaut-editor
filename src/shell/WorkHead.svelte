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
  import Overflow from "@lautstark/design/svelte/Overflow";
  import TitleField from "@lautstark/design/svelte/TitleField";
  import { t } from "./live.svelte.js";
  import { useStatus } from "./dom.js";
  import { useHeadHole } from "./holes.js";
  import { collectionMenu, writeName } from "./collections.js";
  import { nameCaret, nameOff, namePlaceholder, nameShown } from "./nameField.svelte.js";

  let line: HTMLElement;
  let slot: HTMLElement;

  $effect(() => {
    useStatus(line);
    useHeadHole(slot);
  });

  /* The one thing §6.5's component does not carry, and it is a real state
     rather than a nicety: components.css draws `.title-input:disabled`, so a
     page with no Sammlung open has a field the package has an answer for and
     TitleField has no prop for. The input is the component's element now, so
     the only handle left on it is the id this call site gives it.

     Written here rather than worked around, because §6.0's own test says an
     adopter that cannot use a component as specified has found a defect in the
     spec: design owes TitleField a `disabled` prop, and this is the line that
     goes when it arrives. It is not reachable in ordinary use -
     ensureCollection() guarantees there is always one (§1.9) - which is
     presumably why the audit read the markup and not the paint. */
  $effect(() => {
    const node = document.getElementById("collectionName");
    if (node instanceof HTMLInputElement) node.disabled = nameOff();
  });
</script>

<div class="workhead">
  <!-- The name IS the field that renames it - @lautstark/design/svelte/TitleField
       now, over the same rename.js it was always over. No dialog and no menu
       entry: renaming a thing you are looking at should be typing over its
       name.
       A field with no visible label: the Sammlung's name is its own heading,
       and a word in front of it would be a second one. So the name has to be
       said to whoever cannot see that, which is `label`.
       `select` is left at its default: the caret arrives here from
       „+ Neue Sammlung", and the name it arrives on is a date somebody is
       meant to type over. No `oninput` either - nothing on this page is drawn
       from the Sammlung's name except the sidebar row, and that row is
       repainted by the write. conventions.md §6.5. -->
  <TitleField id="collectionName" label={t("ui.collection_name")}
              value={nameShown()} placeholder={namePlaceholder()}
              write={writeName} caret={nameCaret} />
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
  <!-- One character wide, and that character is not a word, so it is named -
       which is the whole of `label` on the shared component: the title and the
       accessible name are one string there rather than two written out beside
       each other. conventions.md §6.10.
       The `event.stopPropagation()` this handler carried is gone with the
       markup, and it was never doing anything: menu.js attaches its
       press-outside listener after the list is open, and that listener already
       leaves a click inside a `.menu-anchor` alone. The other three triggers
       in this product never had it. -->
  <Overflow id="collectionMenu" label={t("ui.collection_menu")} build={collectionMenu} />
</div>
