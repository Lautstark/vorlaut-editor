<script lang="ts">
  /* The tablet board: the page's own head, one line of numbers about it, and
   * the grid.
   *
   * ## What used to be here, and why none of it is
   *
   * A path, a row of page tiles, a picker and a count. Between them they tried
   * to answer four questions in the strip over the board, and the strip is the
   * wrong place for three of them.
   *
   * **Which pages exist, and getting to one, is the sidebar's.** A list down the
   * side may scroll; a strip across the top may not, which is why every drawing
   * of it had to hide something - fold it, pick a level, choose one parent.
   * Forty pages are nothing to a column and impossible for a bar. The list hangs
   * under the open Sammlung and is editor-app/PageList.svelte, handed to the
   * shell through collectionPages().
   *
   * **Where a page leads is the board's.** A `goto` button already says so - it
   * is a button with the page's name on it, two centimetres below where the row
   * of tiles used to repeat it. It carries a corner that follows the link, so
   * pressing the button still opens the button.
   *
   * **The path went because it could not be truthful.** See Facts.svelte.
   *
   * **The whole-Sammlung act moved into the ⋯ beside the name.** It sat here, as
   * a filled accent button, because the talker's cable transfer sits in that
   * slot and the tablet's package is the same act at the same point in the same
   * sentence. That symmetry is given up deliberately: the button was the loudest
   * thing on the page for something pressed once a sitting.
   *
   * **Selecting a navigation button does not follow it.** In editor-diy a set
   * tab both selects and switches, because there is one axis and no ambiguity.
   * Here there are two: a `goto` button is a thing you edit *and* a way
   * somewhere. If pressing it navigated, it would be the one button on the board
   * nobody could ever change - so the press opens the button's sheet and the
   * corner follows.
   *
   * It is mounted into #editor, which is the hole shell/Shell.svelte leaves -
   * the shell lays out a page, an editor fills the middle of it. app.ts is what
   * mounts it, because which editor a Sammlung needs is not something the shell
   * may know (tests/unit/layers.test.ts).
   */
  import { board } from "./standing.svelte.js";
  import { reachable } from "./pages.js";
  import PageHead from "./PageHead.svelte";
  import Facts from "./Facts.svelte";
  import Grid from "./Grid.svelte";

  const found = $derived(reachable(board()));
</script>

<PageHead {found} />
<Facts {found} />
<Grid />
