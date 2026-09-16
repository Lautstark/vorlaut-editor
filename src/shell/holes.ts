/* The hole the frame leaves, and the slot in the work head beside it.
 *
 * shell/Shell.svelte lays out a page with a gap in the middle of it - the list
 * of Sammlungen down the side, and #editor - and one editor fills the gap. But
 * *which* editor is a fact about the Sammlung, so the shell cannot name one
 * and tests/unit/layers.test.ts is what says so: nothing outside an editor's
 * own directory may import out of it, except the composition root that
 * installs them.
 *
 * So the shell says where, and app.ts says what. The two nodes below are
 * handed over by the component that draws them, and `mount()` in app.ts's
 * EditorHalf is what puts a component in one - which is the same arrow the
 * templates drew before, with a component in place of a markup string.
 *
 * They throw rather than answering null for the reason `byId` used to: every
 * caller is running inside a page the composition root has already mounted the
 * shell into, so a null here is not a case to handle.
 */
let editorBox: HTMLElement | null = null;
let headBox: HTMLElement | null = null;

/** Called once, by the component that draws the gap. */
export function useEditorHole(node: HTMLElement): void {
  editorBox = node;
}

/** Called once, by the component that draws the work head. */
export function useHeadHole(node: HTMLElement): void {
  headBox = node;
}

/** Where an editor's page goes. */
export function editorHole(): HTMLElement {
  if (!editorBox) throw new Error("the shell is not on screen");
  return editorBox;
}

/** The work head's slot: for the five-key talker, the device preview and the
 *  cable. Empty on both editors as things stand - conventions.md §3.3 and the
 *  note in editor-app's Board - and kept because the shell has to put
 *  *something* there for whichever editor is installed, so the next control
 *  either of them grows has a place to go. */
export function headHole(): HTMLElement {
  if (!headBox) throw new Error("the shell is not on screen");
  return headBox;
}
