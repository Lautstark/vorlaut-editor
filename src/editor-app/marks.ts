// How a button's act and its word class show: the glyph in a cell's corner,
// the text-key stem an act is named by, and the Fitzgerald colour of a class.
// Read by the grid, which draws them, and by the button sheet, which names
// them - so they sit in neither.
import type { Act } from "../core/types.js";
import { WORD_CLASSES } from "../core/boot.js";

/** One character for what a press does. Deliberately the glyphs the format's
 *  own actions suggest rather than words: a cell is small, and the panel
 *  spells it out for whichever button is selected. */
export function actBadge(act: Act): string {
  switch (act.kind) {
    /* Two of the seven carry no badge, because each has something better on
     * the same cell.
     *
     * A `goto` has the corner that follows it - a second arrow in the opposite
     * corner said the same thing twice, and the one that does something is the
     * one worth keeping. A `home` has a heavier edge, which marks the whole
     * cell rather than a corner of it: on a board the way back is the one
     * button somebody looks for without reading, and an edge is visible from
     * further away than an 11px glyph. */
    case "goto": return "";
    case "home": return "";
    /* Nothing: the ring on its play control says it, in the one place on the
     * cell already about sound. A badge here as well would be the duplicated
     * arrow again - two marks for one fact. */
    case "speak": return "";
    case "clear": return "✕";
    case "backspace": return "⌫";
    case "sayBar": return "▶";
    case "append": return "";
  }
}

/** The text-key stem for an act. `sayBar` is the one that differs, because the
 *  table spells it the way the sentence reads. */
export const actKey = (kind: Act["kind"]): string => (kind === "sayBar" ? "say_bar" : kind);

export const classColor = (key: string): string =>
  WORD_CLASSES.find((one) => one.key === key)?.color ?? "";
