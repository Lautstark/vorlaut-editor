/* The save conflict, as the two facts the banner over the board draws from.
 *
 * core/save.ts reached four elements by id for this - the banner, its sentence
 * and the two buttons - which was the one piece of markup the save loop knew
 * about. It knows a sentence and a flag now, and shell/Conflict.svelte is what
 * draws them; the two answers are still save.ts's, because both are about
 * `layoutVersion`, which does not leave that file.
 *
 * A `$state` object rather than two exported `let`s, for the reason
 * core/state.ts gives: an importer of `export let` gets a live view of it and
 * cannot assign to it.
 */
export const conflict = $state({
  /** Whether the banner is up. */
  shown: false,
  /** What it says. Held rather than derived, because the two sentences are
   *  about different failures - somebody else wrote, or the file came back
   *  holding something other than what went out - and only save.ts can tell
   *  them apart. */
  text: "",
});
