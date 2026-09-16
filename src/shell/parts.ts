/* A dialog whose contents are components.
 *
 * The frame - the head with its ✕, the body, the foot, the backdrop press, the
 * one `close` exit - stays @lautstark/design/dialog's, drawn exactly as every
 * Lautstark programme draws it. What this adds is that the body and (where one
 * is needed) the foot are Svelte components mounted straight into the frame's
 * own containers, sharing one state object the opener made. No wrapper element
 * between the frame and the content, because components.css styles the frame's
 * children directly and a box in between would take those rules away.
 *
 * wochenwerk's `kalender/sheet.svelte.ts`, with two differences that are this
 * product's rather than improvements on it. The dialog comes from
 * shell/dialog.ts rather than from the package directly, so the two dismissal
 * labels are named once instead of at every call site. And the handle carries
 * the dialog element, because three of the callers here add a width class to
 * it - `.sheet--button`, `.sheet--target`, `.sheet--choices` - which is a
 * modifier on the shared component rather than a redefinition of it.
 *
 * The name is `openParts` and not `openSheet` because this repository already
 * has an openSheet: the picture-column sheet both editors open, which is a
 * whole shape rather than a frame and is built on this one. shell/sheet.svelte.ts.
 */
import { mount, unmount, type Component } from "svelte";
import { openDialog, type OpenDialog } from "./dialog.js";

export interface Handle {
  close(): void;
  dialog: HTMLDialogElement;
  /** The body element. Nothing in this repository writes into it - the whole
   *  point of the arrangement is that a component owns what is in there - and it
   *  is handed out because a caller that wanted to measure the sheet would have
   *  nowhere else to ask. */
  body: HTMLElement;
}

type Part<S> = Component<{ s: S; handle: Handle }>;

export function openParts<S>(options: {
  title: string; panels?: boolean; wide?: boolean; state: S;
  body: Part<S>; foot?: Part<S>; onClose?: () => void;
}): Handle {
  const made: OpenDialog = openDialog({
    title: options.title, panels: options.panels, wide: options.wide,
    body: [], footer: options.foot ? [] : undefined,
    onClose: () => { for (const part of parts) void unmount(part); options.onClose?.(); },
  });
  const handle: Handle = {
    close: made.close,
    dialog: made.dialog as HTMLDialogElement,
    body: made.body,
  };
  const props = { s: options.state, handle };
  const parts = [mount(options.body, { target: made.body, props })];
  const foot = made.dialog.querySelector<HTMLElement>(".foot");
  if (options.foot && foot) parts.push(mount(options.foot, { target: foot, props }));
  return handle;
}
