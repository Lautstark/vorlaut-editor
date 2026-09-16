// The one thing every module reaches for: the status line.
import { announcer, type Announcer } from "@lautstark/design/toast";
//
// `byId` was the other, and it has gone with the markup it looked into. It was
// re-exported from @lautstark/werkzeuge/dom so that `byId("appGrid")` read the
// same in every module; what it did was find an element some template had
// mounted, by a string the compiler has no opinion about, and the header of
// tests/unit/layers.test.ts is a page and a half about what that costs - an
// element id is a dependency the module graph cannot see, and five of them
// were found when the second editor was written. The templates are components
// now and a component holds its own nodes, so there is nothing left to look
// up. adr/0025.
//
// The ids themselves are still on the elements. They are what e2e/ presses and
// what ui.css draws a handful of rules against, and taking them off would have
// made this conversion a change to the page rather than to how it is drawn.
// What went is anything in src/ *reading* one.
//
// The menu that used to sit below them is @lautstark/design/menu now - it was
// the same file in mitreden, and bildhaft's was the same behaviour in a
// different shape. It is imported where it is used rather than re-exported
// from here, so there is one name for it and one place it comes from.
//
// api() used to be the third. It was a request to app.py, and it went with
// app.py: keeping a fetch helper here would have left one door into the
// network standing open beside the one the seam provides, which is the
// arrangement the seam exists to end. Nothing under static/ has a URL to give
// it any more except the ARASAAC download in backend/local.js.

/** How long a resting status stays lit. Long enough to be read by somebody who
 *  looked over, short enough to be gone by the next time anything happens. */
const RESTS_FOR = 4000;

/* The line in the header, and the one place this page reports anything.
 *
 * The element carries role="status" - see shell/WorkHead.svelte - so writing to
 * it is also announcing it, which it was not before. That rule is
 * @lautstark/design/toast's now: it takes the region this page already mounted
 * and never adds or removes it, which is the failure mitreden and bildhaft
 * each had and this repository got right first.
 *
 * Cancelling a pending rest on anything said is the module's too, and it is
 * the half worth naming: a failed write arriving while "saved" was fading must
 * not inherit its fade.
 *
 * **The element is handed in rather than looked up**, which is the one change
 * this module needed. It used to be `byId("status")`, made lazily because the
 * span arrives with a template and this module is imported before that has
 * run. The span is a component's now, so the component says which node it is -
 * once, as it mounts - and the laziness that guarded against the ordering goes
 * with the ordering.
 *
 * Every call before that point is dropped on purpose. The window is the same
 * one the lazy lookup had and is over before the first round trip; a status
 * said into a page that has not drawn yet is a status nobody could have read,
 * and the alternative - a queue - would replay it into a page that has since
 * moved on. */
let line: Announcer | undefined;

/** Called once, by the component that mounts the region. */
export function useStatus(node: HTMLElement): void {
  line = announcer(node, {
    rest: RESTS_FOR,
    onRest: (one) => one.classList.add("status--rested"),
    /* The inverse, and the reason it is not optional here: a fade that has
       already fired leaves its class behind, so without this the line came
       back reading "not saved yet" still wearing the fade that belonged to
       "saved". The e2e for that is editor_app.spec.ts, "the saved status steps
       back, without taking its words with it". */
    onWake: (one) => one.classList.remove("status--rested"),
  });
}

export const status = (text: string): void => { line?.say(text); };

/**
 * Said, and then allowed to go quiet.
 *
 * For the one status that is true almost always: a Sammlung is saved, and stays
 * saved until the next keystroke says otherwise. A label that reads the same
 * whenever anybody looks is furniture, and the eye stops reading furniture -
 * which is the worst thing that can happen to the one line where a *failed*
 * write would appear.
 *
 * **It fades rather than being cleared, and that is the whole of the
 * difference.** The words stay in the element and stay true, so a reader who
 * comes to the region still hears where the work stands; what goes is the
 * claim on somebody's attention. Clearing would have made the line lie by
 * omission - "nothing to report" and "saved" are not the same - and it would
 * have made two dozen tests race a timer for a fact that had not changed.
 */
export function statusRests(text: string): void {
  line?.rests(text);
}
