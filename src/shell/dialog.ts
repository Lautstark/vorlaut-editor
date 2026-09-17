/**
 * This app's dialogs, which are @lautstark/design/dialog's — with its two
 * dismissals named once instead of at every call site.
 *
 * The shared module deliberately carries no words: two of the four products are
 * bilingual and a string in the package would be wrong in one of them. So every
 * caller supplies `cancelLabel` and `closeLabel`, and here that meant
 * t("ui.cancel") five times and t("ui.close") twelve — seventeen chances for one
 * of them to drift, the worst count in the family.
 *
 * bildhaft has had this wrapper since the shared module existed; the other three
 * wrote the labels out. The family review of 2026-09-02 counted them.
 *
 * The two dismissals stay named apart, which is the rule this exists to hold
 * rather than a detail it happens to satisfy: the corner ✕ says what it *is*, a
 * footer button says what it *does*, and giving both the same name is the defect
 * design.md §2 recorded.
 *
 * `t` is called per invocation and never captured: this page changes language
 * without reloading, and a label read once would be the previous language's.
 */

import { confirmDialog as ask, openDialog as open } from "@lautstark/design/dialog";
import type { ConfirmOptions, DialogOptions, OpenDialog } from "@lautstark/design/dialog";
import { openSheet as frame } from "@lautstark/design/svelte/sheet";
import type { Handle, SheetOptions } from "@lautstark/design/svelte/sheet";
import { t } from "../core/texts.js";

export type { OpenDialog };
export type { Handle, SheetContent } from "@lautstark/design/svelte/sheet";

export function openDialog(options: Omit<DialogOptions, "closeLabel">): OpenDialog {
  return open({ ...options, closeLabel: t("ui.close") });
}

/** The same frame, opened with components in it rather than elements.
 *
 * Aliased on the way in, because this repository already has an `openSheet` of
 * its own - shell/sheet.svelte.ts's, the picture-column sheet both editors
 * open, which is a whole shape rather than a frame and is built on this one.
 * conventions.md §6.1 names the collision so nobody resolves it by renaming the
 * local one; shell/parts.ts is where this comes back out under the name that
 * keeps the two apart.
 *
 * Here rather than beside that name for the reason the file exists: `closeLabel`
 * is required and has no fallback, and the count above is what a second place
 * naming it would start again.
 */
export function openSheet<S>(options: Omit<SheetOptions<S>, "closeLabel">): Handle {
  return frame({ ...options, closeLabel: t("ui.close") });
}

/** A destructive or confirming question. Resolves true when confirmed. */
export function confirmDialog(
  options: Omit<ConfirmOptions, "cancelLabel" | "closeLabel">
    & Partial<Pick<ConfirmOptions, "cancelLabel" | "closeLabel">>,
): Promise<boolean> {
  return ask({ cancelLabel: t("ui.cancel"), closeLabel: t("ui.close"), ...options });
}
