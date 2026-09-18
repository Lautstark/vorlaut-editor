/**
 * The answer a dropdown is holding, apart from the markup that draws it.
 *
 * The markup went. `@lautstark/design/svelte/Dropdown` draws the trigger and
 * opens the list now, and `field` and `start` - the two things
 * shell/pieces/Dropdown.svelte existed to add - are props on it: this file's
 * own comment asked for the field variant "the next time a second product
 * wants a dropdown inside a form", and conventions.md §6.10 is that time.
 * `.field.dropdown` draws its chevron as of design v1.38.1, which is what the
 * copy here was waiting on.
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
 * So the caller makes a handle, reads all four off it, and hands the shared
 * component the two things it asks for - `label` and `build`. That is also
 * what keeps the two sheets' drafts written the way they were written -
 * `does.value`, `targets.value`, `classes.opens`.
 *
 * ## Why the handle knows the trigger's id
 *
 * `opens` is counted where the list is built, because `menuOn` calls `build`
 * once per opening and returns early on the press that dismisses one - so the
 * count needs nothing from the DOM. `open` does: the list is also closed by a
 * press anywhere else on the page, and that press never comes back through
 * this module. The shared component does not hand its trigger out, so the one
 * element this file needs is found by the id it was given - which is the same
 * id the call site passes the component, named once and read twice.
 *
 * That is the one thing §6.10's component does not carry, and it is a handle
 * on a live question rather than a defect in the spec: nothing else in the
 * family asks whether a menu is standing open.
 */
import type { AddItem } from "@lautstark/design/menu";

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
  /** The trigger's id, which is also how `open` finds it. Passed to the
   *  component rather than written at the call site a second time. */
  readonly id: string;
  /** What the trigger says: the chosen answer's own label.
   *
   *  Read from the answer rather than kept as a second copy. That is the
   *  defect this shape shipped with the first time it replaced a select here -
   *  the trigger went on naming the answer somebody had just switched away
   *  from - and a derived read is what ends it. */
  readonly label: string;
  /** Builds the list, and counts the opening while it is at it. Handed to
   *  `@lautstark/design/svelte/Dropdown`, which hands it to `menuOn`. */
  build(add: AddItem): void;
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
  /** One of the entries was pressed.
   *
   *  Choosing what is already chosen calls nothing back, which is the one
   *  piece of a select's behaviour worth copying deliberately rather than by
   *  accident: a `change` event that fires on a non-change is how a row that
   *  watches one comes to redraw itself for nothing. */
  choose(value: string): void;
}

export function dropdown(
  id: string, choices: Choice[], value: string,
  onChange: (value: string) => void,
): Dropdown {
  let held = $state(value);
  let times = $state(0);
  const one = (): Choice | undefined => choices.find((it) => it.value === held);
  /* A closure rather than a method reached through `this`: `build` is handed
     to the component as a bare function, so a `this` inside it would be the
     one thing about this handle that only breaks once it is passed on. */
  const choose = (next: string): void => {
    if (next === held) return;
    held = next;
    onChange(next);
  };
  return {
    get value() { return held; },
    set value(next: string) { held = next; },
    get id() { return id; },
    get label() { return one()?.label ?? ""; },
    build(add) {
      times += 1;
      for (const item of choices) {
        /* `checked` is set on every item rather than only the one in force. It
           is tri-state on purpose - see docs/lib/menu.d.ts - and these are
           alternatives, so leaving it off would make them read as a list of
           equal commands and put the current answer beyond anything but the
           drawing. */
        add(item.label, () => { choose(item.value); },
            { checked: item.value === held });
      }
    },
    get open() {
      return document.getElementById(id)?.getAttribute("aria-expanded") === "true";
    },
    get opens() { return times; },
    choose,
  };
}
