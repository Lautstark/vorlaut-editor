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
