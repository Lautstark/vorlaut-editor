<script lang="ts">
  /* Which editor a new Sammlung gets, and the one question that follows from
   * the answer. The argument for the shape is at askTarget() in
   * shell/collectionNew.svelte.ts; what is here is the drawing.
   *
   * The two conditional questions sit *under* the choice they belong to rather
   * than inside it: a control inside a control is markup no keyboard can walk
   * and no validator allows, which is the same reason a cell in the grid is a
   * box holding two widgets rather than a button holding a button.
   */
  import Dropdown from "@lautstark/design/svelte/Dropdown";
  import { t } from "./live.svelte.js";
  import type { Target } from "../core/types.js";
  import type { Asking } from "./collectionNew.svelte.js";
  import Sizes from "./pieces/Sizes.svelte";

  let { s }: { s: Asking } = $props();
</script>

<!-- The tablet first. See the head of askTarget(): this order is the answer to
     "what is somebody most likely making", not the order the two editors were
     written in. -->
{#each ["app", "diy"] as const as one (one)}<button class="btn choice" type="button" aria-pressed={s.target === one ? "true" : "false"} onclick={() => s.pick(one as Target)}><strong>{t(one === "app" ? "ui.collection_target_app" : "ui.collection_target_diy")}</strong><span>{t(one === "app" ? "ui.collection_target_app_note" : "ui.collection_target_diy_note")}</span></button>{/each}

<!-- How much fits on a page, asked only of the target that has pages. Beside
     the choice rather than after the Sammlung exists, because it is the one
     thing about a new board somebody already knows - and it says so of itself
     that it is not final: growing later costs nothing. -->
<div class="sizeask" hidden={s.target !== "app"}><span class="lbl">{t("ui.app_grid_size")}</span><Sizes chosen={s.size} onPick={(picked) => { s.size = picked; }} /><p class="note">{t("ui.app_grid_later")}</p></div>

<!-- The language of the device's own menu, asked only of the target that has
     one to show. The voice is deliberately not here - a new Sammlung starts on
     whatever the catalogue says its language speaks with, which is a sensible
     answer nobody has to give, and the Sammlung's own sheet is where it is
     corrected. -->
<!-- The shared trigger, as a `.btn` and opening leftward - the same two
     answers the Sammlung's own sheet gives for the same control. §6.10. -->
<div class="sizeask" hidden={s.target !== "diy"}><span class="lbl" id="collectionNewLangLabel">{t("ui.collection_language")}</span><Dropdown class="quiet sm" start labelledBy="collectionNewLangLabel" label={s.languageName} build={(add) => {
  for (const one of s.languages) {
    add(one.name, () => { s.language = one.code; }, { checked: one.code === s.language });
  }
}} /><p class="note">{t("ui.collection_language_note")}</p></div>

<!-- The note under the two says it does not change later. That is the one
     thing somebody could reasonably expect to be able to undo, and the moment
     to say so is while they are choosing rather than when they go looking for
     a switch. -->
<p class="note">{t("ui.collection_target_note")}</p>
