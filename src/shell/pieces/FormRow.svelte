<script lang="ts">
  /** One labelled thing in a sheet: a label, a control, and a sentence under it.
   *
   * A <div> with a <label for>, rather than a <label> wrapped round the whole
   * row. A wrapping label owns every control inside it, which is right for one
   * input and wrong for a radio group or a control with a play button beside it -
   * pressing the caption would then land on whichever the browser picked first.
   * An empty `label` leaves the caption out, for a row that is a button.
   *
   * How the caption names its control is the same three cases it always was,
   * and which one applies is decided by what the caller asks for:
   *
   * - `forId`, for one labelable control. A real <label for>, so pressing the
   *   caption reaches it, which is what a field wants.
   * - neither, for a control that is not labelable. A <button> is not, so `for`
   *   pointed at one silently does nothing - the association has to be
   *   aria-labelledby, and a <label> that labels nothing would be furniture. A
   *   dropdown's trigger is that case.
   * - `names={false}`, for a control that is several controls. The caption
   *   names the box, and nothing carries an association at all.
   *
   * **The ids go out to the snippet rather than being written onto a child
   * from here.** The control is the caller's markup, so this cannot reach it;
   * what it can do is say what the caption and the sentence are called, and let
   * the caller put `aria-labelledby` and `aria-describedby` where they belong.
   * That is a line at each call site and it is the honest one - the version
   * that queried its own subtree for something to label would be this file
   * guessing which of several controls the caption meant.
   */
  import type { Snippet } from "svelte";
  import Hint from "./Hint.svelte";

  let {
    label = "", note = "", forId = "", names = true, caption = false,
    hidden = false, children, extra,
  }: {
    label?: string; note?: string; forId?: string; names?: boolean;
    caption?: boolean; hidden?: boolean;
    children: Snippet<[{ labelledBy: string; describedBy: string }]>;
    extra?: Snippet;
  } = $props();

  /* Counted rather than taken from `$props.id()`, so that the ids read the way
     they have read since these rows were built by hand - `row4`, `note4` - and
     a locator written against one goes on finding it. */
  const mine = ++made;
  const capId = $derived(forId || !names ? "" : `row${mine}`);
  const noteId = $derived(note ? `note${mine}` : "");
</script>

<script lang="ts" module>
  let made = 0;
</script>

<div class="form__row" class:form__row--caption={caption} {hidden}
  >{#if label}{#if forId}<label class="lbl" for={forId}>{label}</label>{:else}<span class="lbl" id={capId}>{label}</span>{/if}{/if}{@render children({ labelledBy: capId, describedBy: noteId })}{#if note}<Hint id={noteId} text={note} />{/if}{#if extra}{@render extra()}{/if}</div>
