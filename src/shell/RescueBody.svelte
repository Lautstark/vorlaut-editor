<script lang="ts">
  import { t } from "./live.svelte.js";
  import type { Rescue } from "./rescue.svelte.js";
  let { s }: { s: Rescue } = $props();
</script>

<p>{t("ui.rescue_body", { from: s.from })}</p>
<p class="hint">{s.said}</p>
