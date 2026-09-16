<script lang="ts">
  /* Abbrechen, the send, and - where sending again cannot help - the other
     door. Which of the last two is on screen is the answer to whether a
     correction could land differently. */
  import { t } from "./live.svelte.js";
  import type { Send } from "./tabletSend.svelte.js";

  let { s }: { s: Send } = $props();

  let go: HTMLButtonElement;
  let instead: HTMLButtonElement;

  /* After a failure, the keyboard goes to whichever door is left: the one that
     can be pressed again where the address may be wrong, and the one that saves
     the file where it cannot. */
  $effect(() => {
    if (!s.failed) return;
    if (s.correctable) go.focus(); else instead.focus();
  });
</script>

<button type="button" class="btn quiet" onclick={() => s.stop()}>{t("ui.cancel")}</button>
<!-- Nothing to send until four numbers say where. Disabled rather than
     pressable-and-scolding: the boxes are what is incomplete and they are the
     thing being looked at.
     design.md §4.3: progress belongs to the control that started it, and goes
     when the work does. No spinner and no bar - §4.2 closes the motion budget at
     130ms for colour and 220ms for size, and an indeterminate loop is neither. -->
<button bind:this={go} type="button" class="btn primary" hidden={s.failed && !s.correctable} disabled={s.running || !s.address} onclick={() => s.go()}>{s.running ? t("ui.send_running") : s.tried ? t("ui.send_again") : t("ui.send_go")}</button>
<button bind:this={instead} type="button" class="btn" hidden={!s.failed || s.correctable} onclick={() => s.instead()}>{t("ui.send_save_instead")}</button>
