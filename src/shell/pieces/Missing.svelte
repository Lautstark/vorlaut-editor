<script lang="ts">
  /** A sentence where a picture should have been.
   *
   * Two different absences, and the words point at different remedies - which
   * is the one piece of reading about a symbol that both editors and the
   * sheet's own preview all have to make. A `metacom:` reference resolves out
   * of the licensed folder, so its picture being unreachable means the folder
   * is not connected in this browser, which is remediable in the gear. Anything
   * else is a file this browser's store does not hold, which is what a board
   * imported from elsewhere looks like. */
  import { t } from "../live.svelte.js";
  let { symbol }: { symbol: string } = $props();
</script>

<span class="blank">{t(symbol.startsWith("metacom:") ? "ui.symbol_needs_folder" : "ui.symbol_missing")}</span>
