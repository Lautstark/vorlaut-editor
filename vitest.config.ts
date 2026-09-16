import { svelte } from "@sveltejs/vite-plugin-svelte";
import { vitestConfig } from "@lautstark/toolchain/vitest";

/* The checks that are only JavaScript live here.
 *
 * They import the modules under src/ directly, which is the reason vitest owns
 * them rather than plain node: the modules are TypeScript now and node cannot
 * run them without a build in between. Putting a build between a test and the
 * thing it tests is how a frozen reference stops measuring the source.
 *
 * What is NOT here is anything that compiles the firmware's own C++ readers
 * and replays the browser's bytes into them - those stay in tests/run.py, and
 * that is now the whole of what it is for. See tests/run.py's docstring.
 *
 * `environment`, `restoreMocks` and `unstubGlobals` are
 * @lautstark/toolchain/vitest's - the same three every app in the family had
 * written out for itself. What is passed here is what is this repository's:
 * where the tests are, and the in-memory IndexedDB below.
 *
 * The compiler is in the second argument because a handful of these tests
 * import a module that mounts a component - app_blank.test.ts reaches
 * editor-app/editor.ts for app.blank(), which is four lines of object literal
 * at the far end of an import graph that now has .svelte files in it. Nothing
 * here renders one; without the plugin the import simply fails to resolve and
 * the test reads as a broken editor.
 */
export default vitestConfig({
  include: ["tests/unit/**/*.test.ts"],
  // data/store.ts and data/backup.ts talk to a real IndexedDB. An in-memory
  // one lets the licensing checks read what actually landed in it rather
  // than what a mock was told to say.
  setupFiles: ["./tests/unit/setup.ts"],
}, {
  plugins: [svelte()],
});
