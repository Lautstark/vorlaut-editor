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
  import { status } from "./dom.js";
  import { reason } from "../core/errors.js";

  /* Both answers are a read of the store, and keepMine() a write after it, so
     either can fail - a store closed by another tab's upgrade, a quota. Each was
     `void` here, which made the failure an unhandled rejection and the press a
     button that did nothing at all. The banner stays up, because the conflict
     it describes is still true; the status line says why the answer did not
     take, in the sentence the rest of the page uses for a store that refused. */
  function answer(act: () => Promise<void>): void {
    act().catch((error: unknown) => {
      status(t("ui.data_failed", { error: reason(error) }));
    });
  }
</script>

<div class="conflict" id="conflict" class:show={conflict.shown}>
  <span id="conflictText">{conflict.text}</span>
  <button id="overwriteBtn" class="btn" type="button" onclick={() => answer(keepMine)}>{t("ui.keep_mine")}</button>
  <button id="reloadBtn" class="btn" type="button" onclick={() => answer(load)}>{t("ui.reload")}</button>
</div>
