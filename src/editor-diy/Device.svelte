<script lang="ts">
  /* The board is 2x3 with a hole in it, and always was.
   *
   * docs/hardware.md: the speaker sits top left, the set key below it, and the
   * four speech keys to the right as a 2x2 block. data/obf.ts's grid() has
   * exported exactly that arrangement - nulls and all - since it was written.
   * What this editor drew was a set tile and four tiles in a row of three, which
   * meant the one screen somebody arranges a board on was the one place the
   * arrangement was wrong. The hole is drawn as the speaker rather than captioned
   * as an absence, because that is what is there.
   *
   * The hole is not a drop target and does not move: it is where the cone is.
   * All five keys trade places, which is what they did not do while one of them
   * was a different kind of thing.
   *
   * --cols and --rows are written here rather than derived: unlike the tablet's,
   * this grid is not a setting - it is the shape of the hardware, and a board
   * that could be a different size is not this device. */
  import { t } from "../shell/live.svelte.js";
  import { at, board, CELLS, useDevice } from "./standing.svelte.js";
  import Key from "./Key.svelte";

  /* A boolean rather than the set itself: the layout is mutated in place, so a
     derived holding the record would never say anything changed. Each Key below
     asks for its own slot, which is where that copy is made. See the head of
     shell/live.svelte.ts. */
  const empty = $derived(!board().sets[at()]);
  let grid: HTMLElement;
  $effect(() => { useDevice(grid); });
</script>

<div bind:this={grid} class="grid" id="device" style="--cols:3; --rows:2">{#if empty}<p style="color:var(--muted)">{t("ui.no_sets")}</p>{:else}{#each CELLS as place, cell (cell)}{#if place === null}<!-- The cell where the speaker is. Not a control, not a drop target, and not
     something anybody can put a key in: it is a hole in the board because there
     is a 40 mm cone behind it. Drawn as the thing rather than captioned as an
     absence - the mock has the glyph. --><div class="cell cell--hole"><span><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" stroke-width="1.5" /><circle cx="20" cy="20" r="11" stroke-width="1.2" /><circle cx="20" cy="20" r="4" stroke-width="1.5" fill="currentColor" /></svg>{t("ui.speaker")}</span></div>{:else}<Key index={place} />{/if}{/each}{/if}</div>
