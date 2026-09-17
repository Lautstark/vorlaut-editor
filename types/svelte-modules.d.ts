/* What a `.svelte` import is, for the two programs that are checked by `tsc`
 * rather than by `svelte-check`.
 *
 * `npm run typecheck` reads src/ with svelte-check, which compiles each
 * component and knows exactly what its props are - that is the real check and
 * nothing here weakens it. The unit suite and the browser suite are checked by
 * `tsc` instead (tsconfig.test.json and tsconfig.e2e.json both `include`
 * src/, because they import out of it), and `tsc` has never heard of a
 * `.svelte` file: without this, every module those two reach that mounts a
 * component fails to resolve one import and takes the whole program with it.
 *
 * Deliberately outside src/. An ambient `declare module "*.svelte"` inside the
 * tree svelte-check reads would shadow the per-component types it derives, and
 * the check that matters would quietly become this one. So it sits here, and
 * only the two `tsc` projects name it in their `include`.
 *
 * Neither suite mounts a component - they import a module that happens to
 * import one - so the shape below is as narrow as it can be while still
 * type-checking a `mount()` call that nothing in those two suites makes.
 */
declare module "*.svelte" {
  import type { Component } from "svelte";
  const component: Component<Record<string, never>>;
  export default component;
}

/* And the same for a component that arrives by a **bare specifier**, which the
 * pattern above cannot match.
 *
 * `@lautstark/sicherung/svelte/RescueBody` has no `.svelte` written on it: the
 * package's `exports` map is what turns it into one, under the `svelte`
 * condition conventions.md §6.0 requires. `tsc` follows that map, finds a
 * `.svelte` file at the end of it, and has never heard of one - so a
 * `.svelte.ts` module importing a shared component fails to resolve it and
 * takes the whole program down, exactly as before, and with a message about a
 * package rather than about a file.
 *
 * **The shape is `any` here where it is `Record<string, never>` above, and that
 * was measured rather than chosen.** The narrow shape is never actually
 * compared against anything for the relative form - `openParts({ body: X })`
 * has type-checked against it for as long as this file has existed - and it is
 * compared for this one: `Type 'SheetContent<Rescuing>' is not assignable to
 * type 'Record<string, never>'`. There is nothing to be gained by fighting
 * that. The real check on these props is svelte-check, which compiles the
 * component and knows exactly what it takes; these two suites only need the
 * import to resolve, and neither of them mounts one.
 *
 * One pattern rather than `@lautstark/sicherung/svelte/*`, and not for
 * tidiness: `./svelte/rescuing` sits under that same prefix and is a real
 * `.svelte.ts` that `tsc` reads perfectly well, so a wildcard covering the
 * directory would put this shape over the `Rescuing` class beside them. */
declare module "@lautstark/sicherung/svelte/Rescue*" {
  import type { Component } from "svelte";
  const component: Component<any>;
  export default component;
}
