<script lang="ts">
  /* The markup half of shell/dropdown.svelte.ts, which is where the argument
     for the shape is. What is here is what the control looks like. */
  import { menuOn } from "@lautstark/design/menu";
  import { fit } from "../fit.js";
  import type { Choice, Dropdown } from "../dropdown.svelte.js";

  let { d, choices, id = "", labelledBy = "", describedBy = "" }: {
    d: Dropdown; choices: Choice[];
    id?: string; labelledBy?: string; describedBy?: string;
  } = $props();

  let anchor: HTMLElement;
  let trigger: HTMLButtonElement;
  $effect(() => { d.useTrigger(trigger); });

  /* The trigger says what is chosen, which a select did for free and a button
     does not. That is the defect this shape shipped with the first time it
     replaced a select here - the trigger went on naming the answer somebody
     had just switched away from - and a derived read is what ends it: there is
     no second copy to keep in step. */
  const shown = $derived(choices.find((one) => one.value === d.value)?.label ?? "");

  function open(): void {
    d.opened();
    menuOn(trigger, (add) => {
      for (const one of choices) {
        /* `checked` is set on every item rather than only the one in force. It
           is tri-state on purpose - see docs/lib/menu.d.ts - and these are
           alternatives, so leaving it off would make them read as a list of
           equal commands and put the current answer beyond anything but the
           drawing. */
        add(one.label, () => d.choose(one.value), { checked: one.value === d.value });
      }
    });
    fit(anchor, trigger);
  }
</script>

<!-- .start, because these stand at the left of a form column: the default
     hangs the list rightward off its trigger, which suits the overflow menu at
     the right edge of a row and nothing here. -->
<!-- A field wearing a chevron, not a button wearing one. components.css draws
     `.dropdown` on a `.btn`, which is as wide as the word on it - right for the
     ⋯ at the end of a row, and for a picker standing on its own in a settings
     panel. In a column of questions it is wrong: the fields above and below are
     full-width, so a trigger that stops after "Wort" leaves four controls
     reading as four kinds of thing with no left edge to follow down.
     `.dropdown` asks nothing of `.btn` - it sets a custom property and an
     `::after`, and both work on whatever they are put on. So this composes two
     shared classes rather than restating either one's geometry here, which is
     what `.dropdown`'s own comment warns against: an earlier version of that
     rule set radius and padding and silently outranked `.btn`.
     Worth promoting to a named variant in @lautstark/design the next time a
     second product wants a dropdown inside a form - the same test `.dropdown`
     and `.menu-anchor.start` were each promoted on. -->
<span bind:this={anchor} class="menu-anchor start"><button bind:this={trigger} {id} type="button" class="field dropdown" aria-haspopup="menu" aria-expanded="false" aria-labelledby={labelledBy || undefined} aria-describedby={describedBy || undefined} onclick={open}>{shown}</button></span>
