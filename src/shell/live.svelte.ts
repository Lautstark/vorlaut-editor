/* What a component is allowed to watch: the layout on screen, and the language
 * the page is in.
 *
 * ## Why the layout is not `$state`
 *
 * `core/state.ts` holds one object and both editors mutate it in place - a key
 * is typed into `slot.text`, a button is pushed onto `page.buttons` - and then
 * call `commit()`, which redraws and writes. That contract is older than this
 * conversion and is not one to change here: `save()` hands the same object to
 * `structuredClone()` and to IndexedDB, and `comparable()` stringifies it.
 * A `$state` object is a Proxy, and a Proxy is exactly what those three
 * refuse - the pilot found that the hard way and wrote it down (wochenwerk's
 * ADR 003: "a record handed to a component becomes a `$state` proxy, and
 * `structuredClone()` and IndexedDB both refuse a proxy").
 *
 * So the layout stays the plain object it has always been, and what is
 * reactive is a *note that it moved*. `seen` is a `$state.raw` box holding the
 * object and a counter; `layout()` reads the box, so anything that draws from
 * it is redrawn when `touched()` replaces it. Nothing is proxied, no write
 * goes through a snapshot, and `state.layout` is byte-for-byte what it was.
 *
 * The counter is not decoration. Replacing the box with `{ layout: the same
 * object }` would be a write of an equal value, and `$state.raw` compares
 * before it notifies - so a mutation in place would go unreported, which is
 * every mutation this page makes. The counter is what makes each box a
 * different value.
 *
 * `touched()` is called from exactly two places per editor, and they are the
 * two that already existed: `render()`, which is what the shell calls after
 * something outside changed the layout, and `commit()`, which is `render()`
 * plus the write. Nothing else has to remember.
 *
 * ## The one rule this arrangement asks for
 *
 * **Never put the layout, or anything inside it, in a `$derived`.** Call
 * `layout()` - or `board()`, `page()`, `set()`, which are it - inside the
 * expression that needs the answer.
 *
 * `$derived` propagates on inequality, and the layout is the same object before
 * and after every edit this page makes: a key is typed into, a button is pushed
 * onto a page's array. So `const layout = $derived(board())` re-runs and then
 * stops, because what it produced is `===` what it produced last time, and
 * everything downstream of it goes on drawing the board from before the press.
 * Nothing warns, nothing throws, and the page looks like an editor that has
 * stopped accepting input - which is exactly how this was found, on a "+ Neue
 * Seite" that added a page to the file and nothing to the strip.
 *
 * A `$derived` that computes an *answer* is fine and is what they are for:
 * `$derived(reachable(board()))` is a new Set each time, `$derived(board().sets.length)`
 * is a number. What must not be cached is the identity. Where a component wants
 * a record to read fields off - one cell's button, one key's slot - it derives a
 * shallow copy, which is a new object every time and so says what changed.
 *
 * That is the price of the layout staying a plain object, and it is the price
 * worth paying: the alternative is `$state` on state.layout, which makes every
 * record a proxy and hands one to `structuredClone()`, to `comparable()` and to
 * IndexedDB.
 *
 * ## And the language
 *
 * `LANG` and `TEXTS` in core/boot.ts are live bindings a language switch
 * reassigns, and `t()` reads them on every call - which is what let
 * `applyTexts()` re-fill a hundred labels without a reload. A component that
 * writes `{t("ui.settings")}` has no way to know that happened.
 *
 * So `t` below is the same lookup with the note attached. It is not a second
 * table and not a second lookup: it reads the rune and then calls
 * core/texts.ts's, which is core/boot.ts's, which is the one table there is.
 * What it adds is that whoever drew the label is on the list to be drawn
 * again when `relanguaged()` says the page has moved.
 *
 * The rune and the wrapping are `@lautstark/werkzeuge/reactive-text`'s now -
 * mitreden's `ui/words.svelte.ts` was the same six lines, and six lines whose
 * subtlety is the whole of them is exactly what is worth holding in one place
 * (conventions.md §6.11). What did **not** move is everything above: this
 * module still owns which table is looked up, when the page has moved, and the
 * import rule below. The factory carries the trick, not the language.
 *
 * **Components import `t` from here; every other module imports it from
 * core/texts.ts.** The rule is worth stating because the two are spelled the
 * same on purpose - a call site should read the same wherever it is - and the
 * cost of getting it wrong is one label that keeps the previous language.
 * e2e/language.spec.ts is what notices: it switches the page and reads the
 * labels back, which is exactly the failure this arrangement can have.
 */
import { reactiveText } from "@lautstark/werkzeuge/reactive-text";
import { state } from "../core/state.js";
import { t as lookUp } from "../core/texts.js";
import type { Layout } from "../core/types.js";

let seen = $state.raw({ layout: state.layout, at: 0 });

/** The layout on screen, read so that the reader is redrawn when it moves. */
export const layout = (): Layout => seen.layout;

/** Something changed in the layout, or a different one is in force. */
export function touched(): void {
  seen = { layout: state.layout, at: seen.at + 1 };
}

/* One lookup goes in, because this product has one: core/texts.ts's `t`, which
 * is core/boot.ts's, which reads the live bindings a language switch
 * reassigns. mitreden passes two in one call for the reason §6.11 gives - `tn`
 * shares the rune and the single writer - and a second call here would make a
 * second rune that `relanguaged()` would have to remember to bump.
 *
 * The three names below are this module's and they stay: `words` and
 * `relanguaged` are what voices.svelte.ts says, and `relanguaged()` in
 * particular is the sentence chooseLanguage() is making. What they are backed
 * by is the factory's `touched()` and `moved()`. The factory's `touched()` is
 * emphatically **not** re-exported under that name - `touched()` above is the
 * layout's, a different subject sharing this file, and two exports spelled the
 * same would be one import line away from a component watching the wrong one
 * and nothing going red. */
const said = reactiveText({ t: lookUp });

/** A label out of the table, drawn by somebody who should be drawn again when
 *  the page changes language. See the head of this file. */
export const t = said.t;

/** The same read on its own, for the two answers that put a word on screen
 *  without going through the table: a language named in its own word, out of
 *  LANGUAGE_NAMES. Written as a call rather than a value so that it cannot be
 *  captured into a local and quietly stop working. */
export const words = said.touched;

/** The page is in a different language now. */
export const relanguaged = said.moved;
