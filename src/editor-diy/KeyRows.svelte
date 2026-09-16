<script lang="ts">
  /** One key of the five: what it says, what it does, and where it leads.
   *
   * One text field and not two. A tablet button has an Aufschrift and a
   * Gesprochen because the tablet draws the one and says the other; this device
   * draws no caption at all - the key is the picture - so there is one thing to
   * type and `ui.text_placeholder` has been the words for it since this editor
   * was written.
   *
   * There is one row fewer than on a tablet for a reason that is a fact about
   * this device rather than a simplification of the other one: no word class,
   * because the device draws no colour at all - the five displays carry the
   * picture and nothing round it.
   *
   * What a press does is asked first, above the field it governs, which is
   * editor-app's order and its argument: a key that only leads onward says
   * nothing, so its Was gesagt wird field is a dead control - and asked last it
   * was dead in silence, with nothing on screen saying why typing into it
   * changes nothing.
   */
  import { t } from "../shell/live.svelte.js";
  import { speak } from "../shell/speech.js";
  import Dropdown from "../shell/pieces/Dropdown.svelte";
  import FormRow from "../shell/pieces/FormRow.svelte";
  import Hint from "../shell/pieces/Hint.svelte";
  import type { KeySheet } from "./keySheet.svelte.js";

  let { s }: { s: KeySheet } = $props();
</script>

<!-- The same dropdown editor-app draws, and each answer's own sentence
     following it as a hint. Three boxed options with their notes under them
     would be most of this sheet's height, and the distinction between the first
     two is exactly the thing a bare list of three words gets wrong. -->
<FormRow label={t("ui.button_act")} caption>
  {#snippet children({ labelledBy })}<Dropdown d={s.does} choices={s.kinds} id="diyDoes" {labelledBy} describedBy="diyDoesNote" />{/snippet}
  {#snippet extra()}<Hint id="diyDoesNote" text={s.note} />{/snippet}
</FormRow>

<!-- Which page a key leads to.
     Every page in the Sammlung, this one included: a key pointed at its own page
     is a press that does nothing, which is a board somebody may want and is
     nothing this list has to have an opinion about. There is no "Neue Seite …"
     entry the way the tablet's list has one: making a page is a press on the
     strip that is already on screen behind this sheet, and an entry that could
     be greyed out on the page past the cap is worse than no entry.
     Hidden rather than disabled, editor-app's reading: the question is not
     whether somebody may type into this field, it is whether the key says
     anything at all. -->
<FormRow label={t("ui.goto_page")} hidden={!s.leads}>
  {#snippet children({ labelledBy })}<Dropdown d={s.targets} choices={s.where} id="diyGoto" {labelledBy} />{/snippet}
</FormRow>

<FormRow label={t("ui.text_placeholder")} note={s.spokenNote} forId="diyKeyText" hidden={!s.speaks}>
  {#snippet children({ describedBy })}<div class="form__withplay"><input id="diyKeyText" class="field" type="text" autocomplete="off" placeholder={s.placeholder} aria-describedby={describedBy || undefined} value={s.draft.text} oninput={(e) => { s.draft.text = e.currentTarget.value; }} /><button type="button" class="btn" title={t("ui.play_title")} aria-label={t("ui.play_title")} onclick={(event) => {
    /* What the device would say, which on the page-key panel is the field or
       the name behind it. Auditioning an empty field as silence would
       contradict the sentence under it; both empty is a key that genuinely says
       nothing. */
    if (s.saying) void speak(s.saying, event.currentTarget);
  }}>▶</button></div>{/snippet}
</FormRow>
