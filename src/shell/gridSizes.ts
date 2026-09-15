import { GRID } from "../core/boot.js";
import { t } from "../core/texts.js";
import type { GridSize } from "../core/types.js";

/** The four sizes, drawn rather than named, with the one on `chosen` pressed.
 *
 * A row of pictures instead of two number fields, because what somebody is
 * choosing is how much fits on a page - "6 x 11" is the answer to that, not
 * the question - and because a number field is a place to mistype 1 for 11 and
 * lose two pages of buttons.
 *
 * On the shell side because it is drawn in two places that are a whole
 * Sammlung apart: in collectionNew.ts while one is being made, and in the grid
 * panel editor-app puts in that Sammlung's own sheet once it exists. The arrow
 * only runs one way (tests/unit/layers.test.ts), so the shared control lives
 * here and the editor reaches for it - the same direction editor-app takes for
 * every other thing it borrows from the shell.
 *
 * The mini grid is an `<i>` per cell rather than a picture, so that 3x5 and
 * 6x11 differ in the way the real thing does: the same width, smaller cells,
 * more of them. `aria-pressed` says which one is in force, and the accessible
 * name spells the pair out - "3 x 5" read aloud is a multiplication.
 */
export function sizeChoices(chosen: GridSize,
                            onPick: (size: GridSize) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "sizes";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", t("ui.app_grid_size"));

  for (const size of GRID.sizes) {
    const one = document.createElement("button");
    one.type = "button";
    one.className = "size";
    const held = size.rows === chosen.rows && size.columns === chosen.columns;
    one.setAttribute("aria-pressed", held ? "true" : "false");

    const mini = document.createElement("span");
    mini.className = "size__mini";
    mini.setAttribute("aria-hidden", "true");
    mini.style.setProperty("--c", String(size.columns));
    mini.style.setProperty("--r", String(size.rows));
    for (let n = 0; n < size.rows * size.columns; n++) {
      mini.appendChild(document.createElement("i"));
    }

    const pair = document.createElement("b");
    pair.textContent = `${size.rows} × ${size.columns}`;
    const many = document.createElement("small");
    many.textContent = t("ui.app_grid_size_buttons", { n: size.rows * size.columns });
    one.setAttribute("aria-label",
      `${size.rows} ${t("ui.app_grid_rows")} × `
      + `${size.columns} ${t("ui.app_grid_columns")}, ${many.textContent}`);

    one.append(mini, pair, many);
    one.onclick = () => onPick(size);
    row.appendChild(one);
  }
  return row;
}
