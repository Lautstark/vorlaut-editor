<script lang="ts">
  /* Before the press: the act, and Abbrechen beside it. After it: the one that
     dismisses the sheet, and whatever doors the export's ending brought.
     Abbrechen keeps its label and its job - before the press it declines, after
     it it stops. One button, because they are the same sentence. */
  import { t } from "../live.svelte.js";
  import type { Exporting } from "../packageExport.svelte.js";

  let { s }: { s: Exporting } = $props();
  const Doors = $derived(s.what.doors);

  let close: HTMLButtonElement;
  let doorBox: HTMLElement;

  /* design.md §4.3 allows one primary per view. Where the ending brought doors,
     one of them is the act and dismissing steps back to quiet; where it brought
     none, dismissing is the only thing left to press. */
  $effect(() => {
    if (!s.made) return;
    const doors = [...doorBox.querySelectorAll<HTMLElement>("button, a")];
    (doors[doors.length - 1] ?? close).focus();
  });
</script>

{#if !s.made}<button type="button" class="btn primary" disabled={s.running} onclick={() => s.start()}>{s.what.go}</button><button type="button" class="btn" onclick={() => s.stop()}>{t("ui.stop")}</button>{/if}<button bind:this={close} type="button" class={Doors ? "btn quiet" : "btn primary"} hidden={!s.made} onclick={() => s.dismiss()}>{t("ui.close")}</button><!-- Where an ending's doors go, and it is in the foot from the start because an
     ending is built too late to be passed to openDialog(). `display: contents`
     in ui.css, so that the buttons are the foot's own flex items and an empty
     one adds no gap - a wrapper drawn as a box would space the foot differently
     in the two exports for no reason anybody could see. --><span bind:this={doorBox} class="doors">{#if s.made && Doors}<Doors {s} />{/if}</span>
