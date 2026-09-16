<script lang="ts">
  /**
   * Bedienung: when a press on the tablet counts. exchange/SPEC.md §4.1 and
   * §7.5, written into the package as ext_lautstark_hold_time_ms and
   * ext_lautstark_release_time_ms.
   *
   * **Its own panel rather than a third block under Raster**, which was the
   * cheaper option and the wrong one. That panel's heading is "Raster" and its
   * state line is a grid size, so a motor-access setting filed under it is filed
   * where nobody looking for it would look. It also holds its changes behind an
   * apply button, which exists there because resizing a grid throws buttons away
   * - these destroy nothing, so they apply on touch like every other setting on
   * this sheet.
   *
   * Drawn as the bordered .opts rows the word colour uses rather than as the
   * chip row this panel had: three choices that each need a sentence explaining
   * them are what that component is for, and it is what the viewer's own screen
   * draws the same three in.
   */
  import { t } from "../shell/live.svelte.js";
  import { board, commit } from "./standing.svelte.js";
  import { PRESS_MODES, pressModeOf, pressName, pressNote } from "./panels.svelte.js";

  const layout = $derived(board());
  const now = $derived(pressModeOf(layout));

  function choose(mode: typeof PRESS_MODES[number]): void {
    /* Absent rather than 0, so a Sammlung asking for nothing carries no such
       field - which is what data/app_package.ts reads when it decides whether to
       write the manifest entry at all, and what keeps 1.3.0 a minor version for
       every package written before it. */
    if (mode.hold) layout.holdTimeMs = mode.hold;
    else delete layout.holdTimeMs;
    if (mode.release) layout.releaseTimeMs = mode.release;
    else delete layout.releaseTimeMs;
    commit();
  }
</script>

<p class="note">{t("ui.app_press_tablet_only")}</p>
<div class="opts" role="radiogroup" aria-label={t("ui.app_press")}>{#each PRESS_MODES as mode (mode.key)}<label class="opts__opt"><input type="radio" name="appPressMode" value={mode.key} checked={mode.key === now} onchange={(e) => { if (e.currentTarget.checked) choose(mode); }} /><b>{pressName(mode.key)}</b><small>{pressNote(mode.key)}</small></label>{/each}</div>
