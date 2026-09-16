<script lang="ts">
  /* Two tabs writing to one store, and the two ways out of it.
   *
   * The banner was four elements core/save.ts reached by id - the box, its
   * sentence and the two buttons - and it was the one piece of markup the save
   * loop knew about. What the save loop knows now is a sentence and a flag
   * (shell/conflict.svelte.ts); the two answers are still its own, because both
   * are about `layoutVersion`, which does not leave that file. */
  import { t } from "./live.svelte.js";
  import { conflict } from "./conflict.svelte.js";
  import { keepMine, load } from "../core/save.js";
</script>

<div class="conflict" id="conflict" class:show={conflict.shown}>
  <span id="conflictText">{conflict.text}</span>
  <button id="overwriteBtn" class="btn" type="button" onclick={() => void keepMine()}>{t("ui.keep_mine")}</button>
  <button id="reloadBtn" class="btn" type="button" onclick={() => void load()}>{t("ui.reload")}</button>
</div>
