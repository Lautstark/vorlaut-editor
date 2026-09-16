<script lang="ts">
  /* **Disabled, and this is the whole enforcement of "given their data before
   * anything is destroyed".**
   *
   * A second <dialog> asking "are you sure" was the other way to do it, and it
   * would be showModal() on top of showModal() - which browsers allow and which
   * this repository has no other instance of. A button that cannot be pressed
   * until the file has been taken says the same thing earlier, and it names the
   * act rather than asking about it (§1.7). */
  import { t } from "./live.svelte.js";
  import type { Rescue } from "./rescue.svelte.js";
  let { s }: { s: Rescue } = $props();
</script>

<button type="button" class="btn primary" onclick={() => s.keep()}>{t("ui.rescue_download")}</button>
<button type="button" class="btn destructive" disabled={!s.taken} onclick={() => s.discard()}>{t("ui.rescue_discard", { from: s.from })}</button>
