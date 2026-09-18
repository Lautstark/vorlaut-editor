<script lang="ts">
  /** The four sizes, drawn rather than named, with the one on `chosen` pressed.
   *
   * A row of pictures instead of two number fields, because what somebody is
   * choosing is how much fits on a page - "6 x 11" is the answer to that, not
   * the question - and because a number field is a place to mistype 1 for 11 and
   * lose two pages of buttons.
   *
   * On the shell side because it is drawn in two places that are a whole
   * Sammlung apart: in collectionNew.svelte.ts while one is being made, and in the grid
   * panel editor-app puts in that Sammlung's own sheet once it exists. The arrow
   * only runs one way (tests/unit/layers.test.ts), so the shared control lives
   * here and the editor reaches for it - the same direction editor-app takes for
   * every other thing it borrows from the shell.
   *
   * The mini grid is an `<i>` per cell rather than a picture, so that 3x5 and
   * 6x11 differ in the way the real thing does: the same width, smaller cells,
   * more of them. `aria-pressed` says which one is in force, and the accessible
   * name spells the pair out - "3 x 5" read aloud is a multiplication.
   *
   * The expression is a boolean and not `? "true" : "false"`, which is
   * conventions.md §6.0's one form. The ternary here was defensive coding
   * against a vanilla helper writing a bare attribute, and Svelte markup
   * cannot do that: `aria-pressed={x}` compiles to `set_attribute`, which
   * removes only on `null`, so `false` reaches the DOM as the string "false"
   * and components.css's `[aria-pressed="true"]` is unaffected either way.
   * That last part is what makes the change safe rather than merely tidier -
   * ui.css records that absent and "false" are different things here, and the
   * export cards carry neither on purpose.
   */
  import { GRID } from "../../core/boot.js";
  import { t } from "../live.svelte.js";
  import type { GridSize } from "../../core/types.js";

  let { chosen, onPick }: { chosen: GridSize; onPick: (size: GridSize) => void } = $props();

  const many = (size: GridSize): string =>
    t("ui.app_grid_size_buttons", { n: size.rows * size.columns });
  const named = (size: GridSize): string =>
    `${size.rows} ${t("ui.app_grid_rows")} × ${size.columns} ${t("ui.app_grid_columns")}, ${many(size)}`;
</script>

<div class="sizes" role="group" aria-label={t("ui.app_grid_size")}>{#each GRID.sizes as size (`${size.rows}x${size.columns}`)}<button type="button" class="size" aria-pressed={size.rows === chosen.rows && size.columns === chosen.columns} aria-label={named(size)} onclick={() => onPick(size)}><span class="size__mini" aria-hidden="true" style="--c:{size.columns};--r:{size.rows}">{#each Array(size.rows * size.columns) as _cell, n (n)}<i></i>{/each}</span><b>{size.rows} × {size.columns}</b><small>{many(size)}</small></button>{/each}</div>
