<script lang="ts">
  /* One press out of this dialog, and it is the one that makes something.
   *
   * Both cards set rather than resolve - a tablet Sammlung has a second
   * question inside the first, and a button that made the Sammlung on the way
   * past would ask it too late - so the talker goes through this same press for
   * one press more, because two ways out of one sheet is two things to keep in
   * step. */
  import { t } from "./live.svelte.js";
  import type { Asking } from "./collectionNew.svelte.js";

  let { s }: { s: Asking } = $props();
</script>

<button class="btn primary" type="button" disabled={!s.target} onclick={() => s.make()}>{t("ui.collection_create")}</button>
