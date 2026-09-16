import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/* TypeScript inside components, and nothing else: no adapter, no kit, no
 * routing. This is one page - index.html - and vite.config.ts already knows
 * which one.
 *
 * The same file wochenwerk's pilot carries, deliberately unchanged: two
 * products on one Svelte major with two different preprocessor settings is the
 * drift @lautstark/toolchain exists to prevent one floor down, and a compiler
 * option is exactly the kind of thing that would be noticed a year later as a
 * component that builds in one repository and not the other. */
export default { preprocess: vitePreprocess() };
