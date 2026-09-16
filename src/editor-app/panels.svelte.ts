// What the two panels this editor adds to the Sammlung's sheet are called, and
// the three answers behind Bedienung. Handed to the shell through
// collectionSheetPanel() in wireEditor(), because the shell may not import this
// directory.
//
// The panels themselves are editor-app/GridPanel.svelte and
// editor-app/AccessPanel.svelte. What is here is what both of them and the
// shell need: the heading each panel states when it is folded, which is read off
// the layout rather than out of whatever the panel is holding.
import type { AppLayout } from "../core/types.js";

import { t } from "../shell/live.svelte.js";
import { board } from "./standing.svelte.js";
import type { SheetPanel } from "../shell/voices.svelte.js";
import GridPanel from "./GridPanel.svelte";
import AccessPanel from "./AccessPanel.svelte";

/**
 * The three ways a board can answer a touch, and the two milliseconds each one
 * means.
 *
 * **The same three the tablet offers, with the same names and the same
 * numbers**, and that is the whole point of them being here rather than two
 * lists of millisecond steps. Those lists could not express two of these modes
 * at all - 600 was not among the pauses and 400 was not among the holds - so a
 * Sammlung authored here could never carry what the viewer's own settings did,
 * and the viewer, asked to name what a package wanted, had to guess at the
 * nearest one and could land on "Sofort" for a board with an 800 ms hold on it.
 *
 * The split that produced that was invented: an author who thinks in
 * milliseconds and a parent who does not are, here, the same person. So there is
 * one vocabulary, and this is it.
 *
 * Ordered by what each costs. Once is a pause after a press and is not felt
 * until the *next* word; Held adds a wait before every word there is. Somebody
 * walks down the list and stops at the first that works.
 *
 * Every value stays inside MAX_PRESS_TIMING_MS, where SPEC.md §7.5 clamps.
 */
export const PRESS_MODES = [
  { key: "at_once", hold: 0, release: 0 },
  { key: "once", hold: 0, release: 600 },
  { key: "held", hold: 400, release: 800 },
] as const;

/** Which mode a layout is at. Absent counts as the first, which is what absent
 *  means in the format too (SPEC.md §7.5: 0 is off). A layout carrying anything
 *  else - hand-edited, or from an older build of this editor - matches none and
 *  the panel says so rather than pretending. */
export function pressModeOf(layout: AppLayout): string | null {
  const hold = layout.holdTimeMs ?? 0;
  const release = layout.releaseTimeMs ?? 0;
  return PRESS_MODES.find((m) => m.hold === hold && m.release === release)?.key
    ?? null;
}

/* Written out one key at a time rather than built from the mode's own, because
   tests/test_texts_used.py reads this file for literal keys and one assembled
   from a variable is a key nothing can find. */
export const pressName = (key: string): string =>
  key === "at_once" ? t("ui.app_press_at_once")
  : key === "once" ? t("ui.app_press_once")
  : t("ui.app_press_held");

export const pressNote = (key: string): string =>
  key === "at_once" ? t("ui.app_press_at_once_note")
  : key === "once" ? t("ui.app_press_once_note")
  : t("ui.app_press_held_note");

/** The two panels, in the order they are drawn: the grid first, because it is
 *  what somebody opens this sheet for, and Bedienung is set once for a user and
 *  then left alone. */
export const sheetPanels = (): SheetPanel[] => [
  {
    name: "collectionEditor",
    section: () => t("ui.app_grid"),
    /* The heading says the size the Sammlung *is* at, not the one that is
       pending: a state line is what a panel would answer folded, and folded
       there is no pending anything. Which size is picked is said where it is
       picked, by the pressed option, and what pressing the button would cost is
       said by the notices between the two. */
    state: () => `${board().grid.rows} × ${board().grid.columns}`,
    body: GridPanel,
  },
  {
    name: "collectionAccess",
    section: () => t("ui.app_press"),
    /* The mode's own name, or - for a layout carrying values no mode has - the
       two numbers, because naming the nearest mode would be telling somebody
       their board does something it does not. */
    state: () => {
      const layout = board();
      const now = pressModeOf(layout);
      return now !== null
        ? pressName(now)
        : t("ui.app_press_own", { hold: layout.holdTimeMs ?? 0,
                                  release: layout.releaseTimeMs ?? 0 });
    },
    body: AccessPanel,
  },
];
