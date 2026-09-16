/* --- The grid: what a drag is doing, and where a drop may land ------------
 *
 * The drawing is editor-app/Grid.svelte and editor-app/Cell.svelte. What is
 * left here is the two answers a cell cannot work out alone - which button is
 * being dragged, and which cell the pointer is over - because both are about
 * the grid rather than about any one cell of it.
 *
 * `over` is a rune where it was a class swept off the document with
 * `querySelectorAll(".cell.dragover")`. One cell is marked at a time by
 * construction now, which is what that sweep was for: `ondragleave` fires after
 * the next cell's `ondragover` often enough that two cells could be marked at
 * once, and the sweep on drop was the repair.
 */
import { isShared } from "./pages.js";
import { board, cellHolder, inColumn } from "./standing.svelte.js";
import type { AppPage } from "../core/types.js";

/** The button being dragged, by id. Null when nothing is. */
let dragging = $state<string | null>(null);
/** The cell the pointer is over, as `row,col`. Null when none is. */
let over = $state<string | null>(null);

export const dragged = (): string | null => dragging;
export const seat = (row: number, col: number): string => `${row},${col}`;
export const hovering = (row: number, col: number): boolean => over === seat(row, col);

export function startDrag(id: string): void { dragging = id; }
export function endDrag(): void { dragging = null; over = null; }
export function hover(row: number, col: number): void { over = seat(row, col); }
export function unhover(row: number, col: number): void {
  if (over === seat(row, col)) over = null;
}

/** Whether this cell is a drop target for whatever is being dragged.
 *
 * Every cell is one, filled or not: dropping onto an empty one is a move and
 * onto a full one is a swap, and both are the same gesture.
 *
 * Except across the two regions a shared first column makes of the board. A
 * button dragged out of that column would stop being on every page, and one
 * dragged into it would start being on all of them - which is not a move, it is
 * a change of what the button *is*, and no drag should carry that much. So the
 * cell simply does not become a drop target, which is the same silent "no" this
 * function already gives a button dropped where it already sits.
 */
export function takesDrop(on: AppPage, row: number, col: number): boolean {
  if (dragging === null) return false;
  if (isShared(board(), dragging) !== inColumn(col)) return false;
  const already = cellHolder(on, row, col);
  return !(already && already.id === dragging);
}
