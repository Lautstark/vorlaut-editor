<script lang="ts">
  /* **Two doors at the end of it, where there used to be none.** The file was
   * downloaded the moment it existed and the sheet closed itself, which was the
   * right shape for a step with one possible outcome. There are two now - the
   * Downloads folder, or a tablet on the same wifi - and a question cannot be
   * answered by doing one of the two before it is asked. Sending would otherwise
   * leave a stray zip behind every single time. */
  import { t } from "./live.svelte.js";
  import type { Exporting } from "./packageExport.svelte.js";

  let { s }: { s: Exporting } = $props();
  let sending = $state(false);
</script>

<button type="button" class="btn" onclick={() => s.save()}>{t("ui.package_save")}</button>
<button type="button" class="btn primary" disabled={sending} onclick={() => void (async () => {
  // Two presses would be two sheets, stacked, each holding the same bytes: the
  // sheet is opened after a read of the remembered address, so there is a gap
  // between the press and anything appearing.
  if (sending) return;
  sending = true;
  try {
    // The sheet behind it goes only if the package got there. Every other way
    // out of that one leaves this one standing, with Speichern on it.
    if (await s.send()) s.dismiss();
  } finally {
    sending = false;
  }
})()}>{t("ui.package_send")}</button>
