// Only the ui.* entries of the chosen language - see texts.py. Every label on
// this page goes through t(), so no string sits in the markup twice.
//
// ## What this file used to be, and why almost none of it is left
//
// applyTexts() was two hundred lines naming a hundred elements by id -
// `byId("dsgAzureHead").textContent = t("ui.dsg_azure_head")` and ninety-nine
// more - because the markup was a template string in another file and the
// words were here. Which sentence went where was therefore a fact spread
// across two files with nothing holding it together, and the way it failed is
// recorded in tests/test_texts_used.py: twenty-nine entries outlived the screen
// that drew them and read exactly like the live ones around them.
//
// The labels are where they are drawn now. A component writes `{t("ui.close")}`
// and that is the whole of it - one place, and the compiler is what says the
// element exists. What arrives with them is the half this pass could not do: a
// component is redrawn when the table underneath it moves, which is
// shell/live.svelte.ts's `t` and a line in chooseLanguage(). adr/0025.
//
// So what is left here is the two things that are not markup.
import { LANG } from "./boot.js";
import { editor, haveEditor } from "./editor.js";

/* t() itself is core/boot.ts's, beside the table it reads, and is re-exported
 * here so that every `import { t } from "../core/texts.js"` in the editor stays
 * what it was. It moved for a second page that needed the same labels and none
 * of the markup this file filled in; that page left with adr/0012, and the
 * arrangement is kept because the reason it is right - the lookup belongs
 * beside the table - never depended on there being two.
 *
 * Components import `t` from shell/live.svelte.ts instead, which is this one
 * with a note attached so that whoever drew a label is redrawn when the page
 * changes language. One table, one lookup, two subscriptions. */
export { t } from "./boot.js";

/** The two things a language switch has to do that no component can.
 *
 * Called once at the first paint and again on every switch.
 *
 * **The editor's own labels**, because the controls an editor owns are the
 * editor's to name and this file may not know what a set or a cable is - see
 * core/editor.ts. Guarded, and it is the one place a missing editor is a real
 * state rather than a broken page: this runs at the first paint so that the
 * shell's own labels are up before the first round trip, and at that moment no
 * editor is on screen, because which editor is a fact about a Sammlung that has
 * not been read yet. showEditorFor() calls labels() itself when one arrives.
 *
 * **And the document's language**, which is an attribute on <html> - outside
 * every component there is, and the one thing on this page a screen reader
 * reads before anything else. */
export function applyTexts() {
  if (haveEditor()) editor().labels();
  document.documentElement.lang = LANG;
}
