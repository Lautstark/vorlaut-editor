import type { DiyLayout, Layout } from "../../src/core/types.js";

/** A Layout this test already knows is a five-key one, narrowed by asking.
 *
 * `Layout` is `DiyLayout | AppLayout`, and it is a union rather than one
 * interface with optional halves on purpose. core/types.ts says why, in the
 * sentence this helper exists to keep true in the tests as well:
 *
 * > `layout.sets` on an app Sammlung would type-check and answer undefined,
 * > which is how the sidebar came to count every Sammlung with whichever
 * > editor happened to be installed.
 *
 * The store hands back a `Layout`, so a test that wrote a diy board and then
 * reads `.sets` off what came back is doing exactly what the union forbids -
 * and until 2026-08-28 nothing said so, because tests/ was in no tsconfig.
 *
 * A cast would silence that and give back the hole. This asks instead: it
 * throws if what came back is not the shape the caller said it was, so a test
 * that is wrong about its own fixture fails on that rather than on a confusing
 * `undefined` three lines later.
 */
export function diy(layout: Layout | undefined | null): DiyLayout {
  if (!layout) throw new Error("expected a Sammlung, and there was none");
  if (layout.target === "app") {
    throw new Error("expected a five-key Sammlung, and this one is a tablet board");
  }
  return layout;
}
