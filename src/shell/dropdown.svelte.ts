/**
 * A button and a menu, which is what this family means by a dropdown - as the
 * answer it is holding, apart from the markup that draws it.
 *
 * Not a `<select>`, and the reason is components.css's rather than this
 * module's: a select's open list is drawn by the operating system, so it is
 * the one control on a page that cannot follow the tokens - survivable while a
 * product committed to one ground and not once the scheme became a choice.
 * The same reasoning replaced the two pickers in the settings sheet, and the
 * sheets are the third and last place in the product that had one.
 *
 * ## Why the answer is a handle and not a `$bindable` prop
 *
 * The obvious Svelte shape is `bind:value`, and it would carry two of the four
 * things a caller asks this control and neither of the other two. The button
 * sheet's word-class guess needs `open` - is somebody looking at this question
 * right now - and `opens` - has anybody looked since I asked - and those are
 * not a value: they are what the control has *been doing* while an answer was
 * in flight. The reasoning is at guessClass() in editor-app/buttonSheet.svelte.ts and
 * it is worth reading before this shape is simplified; the short version is
 * that a guess arriving late must not land on a question somebody has open,
 * and neither must it land a moment after they closed it.
 *
 * So the caller makes a handle, reads all four off it, and hands it to the
 * component. That is also what keeps the two sheets' drafts written the way
 * they were written - `does.value`, `targets.value`, `classes.opens` - which
 * is the half of those files this conversion had no business rewriting.
 */

/** One of the answers a dropdown offers. */
export interface Choice {
  /** What the caller stores, and what it reads back. Never drawn. */
  value: string;
  /** What is drawn - on the trigger while it is closed, and in the list. */
  label: string;
}

export interface Dropdown {
  /** Which answer is in force. Assigning redraws the trigger and calls nobody
   *  back, which is what writing to a select's `.value` did. */
  value: string;
  /** Whether the list is standing open - which is to say whether somebody is
   *  looking at this question right now.
   *
   *  Read off the trigger's own aria-expanded rather than tracked here: the
   *  list is also closed by a press anywhere else on the page, and that press
   *  never comes back through this module. menu.js owns the attribute on both
   *  edges - see its close-all, which clears every open trigger on the page. */
  readonly open: boolean;
  /** How many times this list has been opened, ever.
   *
   *  `open` answers "is somebody looking now", and a question that is answered
   *  late needs the other one: "has anybody looked since I asked". A count
   *  answers it without an event to subscribe to - read it when the question
   *  goes out, compare it when the answer comes back. */
  readonly opens: number;
  /** The component's half, and nobody else's: the trigger, once it exists. */
  useTrigger(node: HTMLButtonElement): void;
  /** The component's half: the list was opened. */
  opened(): void;
  /** The component's half: one of the entries was pressed.
   *
   *  Choosing what is already chosen calls nothing back, which is the one
   *  piece of a select's behaviour worth copying deliberately rather than by
   *  accident: a `change` event that fires on a non-change is how a row that
   *  watches one comes to redraw itself for nothing. */
  choose(value: string): void;
}

export function dropdown(value: string, onChange: (value: string) => void): Dropdown {
  let held = $state(value);
  let times = $state(0);
  let trigger: HTMLButtonElement | null = null;
  return {
    get value() { return held; },
    set value(next: string) { held = next; },
    get open() { return trigger?.getAttribute("aria-expanded") === "true"; },
    get opens() { return times; },
    useTrigger(node) { trigger = node; },
    opened() { times += 1; },
    choose(next) {
      if (next === held) return;
      held = next;
      onChange(next);
    },
  };
}
