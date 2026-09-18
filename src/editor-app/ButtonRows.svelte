<script lang="ts">
  /* What a button has on it, as the right column of the sheet.
   *
   * The frame - the picture column with its search, the foot with the
   * destructive act on the left, and the promise that settles from the presses
   * rather than from `close` alone - is shell/sheet.svelte.ts's, and the head of
   * that file is where the reasoning for each of those lives. This says what a
   * *button* has on it, which is the half that is genuinely the tablet's.
   *
   * The order is the argument. What a press does is asked second, directly
   * under the label, because it decides whether the rows under it mean anything
   * at all: a navigation button says nothing, so its Gesprochen field and its
   * play button are two dead controls - and asked last, as they were, they were
   * dead in silence, with nothing on screen saying why typing into one changes
   * nothing.
   */
  import { t } from "../shell/live.svelte.js";
  import { speak } from "../shell/speech.js";
  import Dropdown from "@lautstark/design/svelte/Dropdown";
  import FormRow from "../shell/pieces/FormRow.svelte";
  import Hint from "../shell/pieces/Hint.svelte";
  import type { ButtonSheet } from "./buttonSheet.svelte.js";

  let { s }: { s: ButtonSheet } = $props();
</script>

<!-- The hint rides on the caption's line rather than under the field. It is a
     qualification of the question - what an empty one means - and it is short
     enough to read as one. Under the control it was a third stacked line saying
     something the placeholder in the field had half said already; beside the
     caption it says the half the placeholder cannot, and costs no height at
     all. -->
<FormRow label={t("ui.app_button_label")} note={t("ui.app_button_label_note")} forId="appLabel" caption>
  {#snippet children({ describedBy })}<input id="appLabel" class="field" type="text" autocomplete="off" placeholder={t("ui.app_button_label_hint")} aria-describedby={describedBy || undefined} value={s.draft.label} oninput={(e) => s.typedLabel(e.currentTarget.value)} />{/snippet}
</FormRow>

<!-- A dropdown rather than the radiogroup it was, which is what makes the move
     affordable: four boxed options with their notes under them were most of this
     sheet's height, and a sheet that has to be scrolled to reach Fertig is worse
     than one asking its questions in the wrong order. What the radiogroup
     carried and a bare dropdown would throw away is each option's own line -
     "says itself and joins the sentence" against "says itself but does not",
     which is the only thing explaining a distinction people otherwise get wrong.
     So the chosen option's note follows the control as a hint.
     Named to the trigger by hand, because this row builds its sentence rather
     than handing FormRow one: it is rewritten on every choice.
     `field` and `start` on every one of these, and both are the shared
     component's props rather than this product's markup: a field wearing a
     chevron because the fields above and below are full width and a trigger
     that stops after "Wort" leaves four controls with no left edge to follow
     down, and the list hanging leftward because these stand at the left of a
     form column. conventions.md §6.10. -->
<FormRow label={t("ui.button_act")} caption>
  {#snippet children({ labelledBy })}<Dropdown field start label={s.does.label} build={s.does.build} id={s.does.id} {labelledBy} describedBy="appDoesNote" />{/snippet}
  {#snippet extra()}<Hint id="appDoesNote" text={s.note} />{/snippet}
</FormRow>

<!-- Where a navigation button leads, with the start page as the first entry
     above the pages themselves. `home` is kept as its own act rather than
     written as a `goto` at whichever page is home today, because the two behave
     differently the moment somebody makes another page the start page.
     Hidden rather than disabled: the question is not whether somebody may type
     into Gesprochen, it is whether this button says anything at all, and a
     greyed field still reads as a field they have failed to reach. -->
<FormRow label={t("ui.goto_page")} hidden={!s.goes}>
  {#snippet children({ labelledBy })}<Dropdown field start label={s.targets.label} build={s.targets.build} id={s.targets.id} {labelledBy} />{/snippet}
</FormRow>

<!-- The same treatment as Aufschrift, and the same sentence about the other
     field: leave it empty and the label is what gets said. It was the field's
     placeholder, which is one place too few and one too many at once. Too few,
     because a placeholder is gone the moment somebody types - and the thing it
     says is about the empty field. Too many, because the row would otherwise say
     it twice.
     What the field *would* say if nothing were typed into it is shown in it
     while nothing is - which is the Aufschrift, by exchange/SPEC.md §7.2's rule.
     A placeholder that is a value rather than a placeholder that is a sentence,
     which is the distinction that makes it safe to have both. -->
<FormRow label={t("ui.app_button_spoken")} note={t("ui.app_button_spoken_note")} forId="appSpoken" caption hidden={!s.speaks}>
  {#snippet children({ describedBy })}<div class="form__withplay"><input id="appSpoken" class="field" type="text" autocomplete="off" placeholder={s.draft.label.trim()} aria-describedby={describedBy || undefined} value={s.draft.vocalization} oninput={(e) => { s.draft.vocalization = e.currentTarget.value; }} /><button type="button" class="btn" title={t("ui.play_title")} aria-label={t("ui.play_title")} onclick={(event) => {
    // What the tablet would say, which is the vocalization where there is one
    // and the label where there is not - exchange/SPEC.md §7.2's rule, said out
    // loud rather than described.
    const saying = (s.draft.vocalization || s.draft.label).trim();
    if (saying) void speak(saying, event.currentTarget);
  }}>▶</button></div>{/snippet}
</FormRow>

<!-- Eleven entries, which is the longest list in the product and the one that
     decides whether an open menu still fits inside a sheet. See fit() in
     @lautstark/design/svelte/fit.js, which the Dropdown calls for itself: it
     opens upward from here and caps itself at what is above, rather than
     hanging out of the body and taking the sheet's own scrollbar with it.
     Wortart stays for all four kinds, which looks like an oversight and is not:
     a page-leading button is coloured as a category on real German boards, and
     BuilderTabletPackageTest asserts exactly that of the navigating button in
     the round-trip sample. -->
<FormRow label={t("ui.app_button_class")}>
  {#snippet children({ labelledBy })}<Dropdown field start label={s.classes.label} build={s.classes.build} id={s.classes.id} {labelledBy} />{/snippet}
</FormRow>
