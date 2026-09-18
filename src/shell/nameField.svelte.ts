/* What the work head's name field is told, and the one thing it is asked for.
 *
 * shell/collections.ts paints the sidebar imperatively - the rows are
 * @lautstark/design/collections' drawing and that module writes into a node it
 * was handed. The name beside them is a component now
 * (@lautstark/design/svelte/TitleField, conventions.md §6.5), and a component
 * cannot be written into. So the paint says what the name is and this is where
 * it says it.
 *
 * Three plain runes rather than one replaced object, and deliberately: these
 * are three independent answers to three questions, not a record anybody holds.
 * The layout is the case that needs `$state.raw` and a counter - see the head
 * of shell/live.svelte.ts - because it is mutated in place and handed to
 * structuredClone(); a string is neither.
 *
 * ## The caret is asked for, not taken
 *
 * „+ Neue Sammlung" makes the Sammlung and puts the caret in the name it was
 * given, selected, so the first keystroke replaces the date (§1.5). This used
 * to be `focusName()` reaching through a module singleton at the element; §6.5
 * takes bildhaft's shape instead, because it is the only one of the three that
 * does not couple the producer to the consumer's identity. The controller that
 * made the thing says a caret is owed; whichever field takes it says so.
 */

/** The stored name, as the field should read it. Assigned into the field
 *  through `rename.js`'s `refresh()` and never directly - which is the whole
 *  of what that function is for. */
let shownName = $state("");
/** What an empty field says: whether there is a Sammlung at all, or whether
 *  there is one nobody has named. */
let shownPlaceholder = $state("");
/** Whether there is anything to rename. `.title-input:disabled` is drawn by
 *  components.css, so this is a state the package has. */
let shownOff = $state(false);

export const nameShown = (): string => shownName;
export const namePlaceholder = (): string => shownPlaceholder;
export const nameOff = (): boolean => shownOff;

/** Said by the paint, which is the only thing that knows. */
export function showName(name: string, placeholder: string, off: boolean): void {
  shownName = name;
  shownPlaceholder = placeholder;
  shownOff = off;
}

let owed = $state(false);

/** A caret is owed to the name field. Said by whoever just made the Sammlung. */
export function askName(): void {
  owed = true;
}

/** Handed to TitleField as its `caret`. `asked()` is read inside an effect
 *  over there, so a module-scope rune behind it is what makes it reactive;
 *  `answered()` is said by the field that took it, so the next ask is a new
 *  one. */
export const nameCaret = {
  asked: (): boolean => owed,
  answered: (): void => { owed = false; },
};
