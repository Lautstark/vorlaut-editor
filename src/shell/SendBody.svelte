<script lang="ts">
  /* Where the tablet is, and what went wrong if it did. */
  import { t } from "./live.svelte.js";
  import AddressRow from "./pieces/AddressRow.svelte";
  import type { Send } from "./tabletSend.svelte.js";

  let { s }: { s: Send } = $props();
</script>

<!-- Only where it is news. On a return visit the boxes are already filled and
     the line under them says where from, so this would be a sentence about
     something that has already happened. -->
<p class="send-lead" hidden={!!s.known}>{t("ui.send_lead")}</p>
<span class="lbl">{t("ui.send_address")}</span>
<AddressRow known={s.known} bind:value={s.address} />
<p class="address-row__note" hidden={!s.known}>{t("ui.send_remembered")}</p>
<p class="notice bad" hidden={!s.trouble}>{s.trouble}</p>
