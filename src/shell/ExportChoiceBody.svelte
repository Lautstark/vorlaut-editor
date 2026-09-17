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
  import Panel from "@lautstark/design/svelte/Panel";

  let { s }: { s: ExportChoice } = $props();
</script>

<!-- No aria-pressed, unlike askTarget's cards: these fire rather than hold a
     selection, and a button claiming a pressed state it never keeps is worse for
     somebody reading it out than one that claims nothing. The lead card is
     marked with a class of its own for that reason - it is the one to press,
     which is not the same claim as the one in force. -->
<button type="button" class="btn choice choice--lead" onclick={() => s.take(s.lead)}><strong>{t(`ui.collection_export_for_${s.lead.which}`)}</strong><span>{t(`ui.collection_export_for_${s.lead.which}_note`)}</span></button>

<!-- The fold, and it is @lautstark/design/svelte/Panel now: a heading that says
     what is behind it, the browser's own toggle and keyboard behaviour, and no
     JavaScript of ours in the middle of it. Its summary holds text and no
     button, which that component requires and this one has no reason to break.
     Closed on open, every time. The point of the fold is that the Sammlung's own
     export is the only thing to press until somebody says otherwise.

     **`group=""` is the whole reason this was the one panel round 2 left
     hand-written.** `Panel`'s `group` defaults to `"settings"`, which is the
     accordion the nine panels of the settings sheet are members of - and both
     sheets are in this one document, so adopting the component naively would
     have enrolled this fold in that group. Opening it would then have folded
     whichever settings panel was open, and opening a settings panel would have
     folded this - across two dialogs, one of which is not even on screen.

     The empty string is the platform's own way of saying "member of no group",
     and it is not a trick played on the component: `name=""` is what the
     `<details>` exclusivity algorithm returns early on, so a lone `<details>`
     that carries it belongs to nothing. Measured in Chromium on 2026-09-17
     rather than read off a specification - two `name=""` panels open together,
     two `name="g"` panels do not. It has to be the empty string and cannot be
     `undefined`: a prop left undefined is a prop that takes its default, which
     is the group this must not join.

     `state` is left off, not passed empty, for the reason three panels on the
     settings sheet leave it off: this summary says what is behind the fold and
     has no answer to carry, and an empty span is a second grid row and two
     pixels below 560px. §6.2. -->
<Panel group="" section={t("ui.collection_export_otherwise")}
  >{#each s.otherwise as door (door.which)}<button type="button" class="btn choice" onclick={() => s.take(door)}><strong>{t(`ui.collection_export_for_${door.which}`)}</strong><span>{t(`ui.collection_export_for_${door.which}_note`)}</span></button>{/each}</Panel
>
