<script lang="ts">
  /* The page on screen, as the grid it will be on the tablet. */
  import { page, board } from "./standing.svelte.js";
  import Cell from "./Cell.svelte";

  /* The seats are derived and the layout is not - see the head of
     shell/live.svelte.ts. `on` is the exception that proves the rule: page()
     answers with a *different* page object when somebody moves, which is
     exactly when the cells below need to hear about it. */
  const on = $derived(page());
  const gap = $derived(board().firstColumnGap === true);
  const seats = $derived(Array.from(
    { length: board().grid.rows * board().grid.columns },
    (_unused, at) => ({
      row: Math.floor(at / board().grid.columns),
      col: at % board().grid.columns,
    })));
</script>

<!-- The gap the package asks a viewer for, drawn here too - see
     AppLayout.firstColumnGap. The board on this screen is a picture of the
     board on the tablet, and a hint that only showed up after export would be a
     setting somebody had to take on faith. -->
<div class="grid" id="appGrid" class:grid--gap={gap} style="--rows:{board().grid.rows};--cols:{board().grid.columns}">{#each seats as seat (`${seat.row},${seat.col}`)}<Cell {on} row={seat.row} col={seat.col} />{/each}</div>
