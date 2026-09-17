/* A dialog whose contents are components.
 *
 * The frame - the head with its ✕, the body, the foot, the backdrop press, the
 * one `close` exit - is @lautstark/design's, and since the extraction it is the
 * package's markup rather than this repository's arrangement of it:
 * `@lautstark/design/svelte/sheet` mounts the body and (where one is needed)
 * the foot into the regions `Sheet.svelte` draws, sharing one state object the
 * opener made. conventions.md §6.1.
 *
 * **What this file used to be, and what is left of it.** It built the same
 * thing by hand: `openDialog()` for the frame, `mount()` into `made.body` and
 * into a `.foot` found with querySelector, and an `onClose` that unmounted both
 * again. Every line of that is in the package now, including the ordering rule
 * the version here had not found - the unmount has to happen *after* the close
 * event rather than inside it, because `close` arrives from inside the
 * browser's own call stack.
 *
 * What is left is the name, and the name is the whole reason this file is still
 * here. It is `openParts` and not `openSheet` because this repository already
 * has an openSheet: the picture-column sheet both editors open, which is a
 * whole shape rather than a frame and is built on this one -
 * shell/sheet.svelte.ts. conventions.md §6.1 names that collision and says
 * where it must not be resolved: the shared opener keeps the obvious name, and
 * vorlaut's local one is not renamed.
 *
 * shell/dialog.ts is what it comes through, for that file's own reason: the two
 * dismissals are named once there instead of at every call site.
 */
import { tick } from "svelte";

export { openSheet as openParts } from "./dialog.js";
export type { Handle, SheetContent } from "./dialog.js";

/**
 * Focus, taken once the frame has the sheet on screen.
 *
 * `showModal()` puts focus on the first thing it finds, which is the corner ✕ -
 * not what somebody who has just opened a thing is about to do to it - so three
 * of the bodies in this product move it: the picture column into its search,
 * the talker's set card into its one field, and the send sheet into the octet
 * that changes.
 *
 * **Why that needs saying at all, when it used to be one line.** Taking focus
 * as the body mounted was the same moment as "after the sheet is shown", because
 * the frame was built by hand: `openDialog()` made the dialog and called
 * `showModal()`, and only then were the bodies mounted into it. The shared frame
 * shows the sheet from an `$effect` instead, and Svelte runs a child's effects
 * before its parent's - so a body focusing at mount is focusing inside a dialog
 * that is still `display: none`, where a focus() does nothing at all, and
 * `showModal()` then lands on the ✕ a moment later. Measured on
 * e2e/send.spec.ts, which is the one of the three with an assertion on it; the
 * other two had none and are given one in this change.
 *
 * One `tick`, which is the first moment after the frame's own effect has run.
 * Not a frame, not a timeout: those would be a guess at how long, where this is
 * the exact point Svelte defines as "the DOM has caught up".
 *
 * A sheet dismissed before the tick fires leaves a detached element, and
 * focusing one is a no-op - so there is nothing to guard.
 */
export function focusOnOpen(take: () => void): void {
  void tick().then(take);
}
