/* symbolInto()'s signal: a withdrawn request touches the image not at all.
 *
 * shell/pieces/Picture.svelte asks for a picture every time its symbol or its
 * element changes, and the answer is a store read away - so two requests on
 * one image can resolve in either order. The component aborts the older one;
 * this is the half that has to honour it. Without it the late answer either
 * draws the earlier symbol under the later one's name, or fires an `error`
 * the component reads as the *later* symbol being missing.
 *
 * Asked through a reference the store does not hold, because that is the path
 * that reaches the image without a canvas, and node has none: a miss is
 * exactly an `error` event and a removed `src`, which is what an aborted call
 * must not do. The image is a stand-in with the four members symbolInto()
 * touches; the real one is an <img> in a browser, which the e2e suite has.
 */

import { describe, expect, it, vi } from "vitest";
import { symbolInto } from "../../src/backend/local.js";

/** The parts of an <img> symbolInto() reaches for, each one recorded. */
function standIn() {
  return {
    dataset: { blobUrl: "blob:earlier" } as Record<string, string>,
    removeAttribute: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe("symbolInto and its signal", () => {
  it("says a miss on the image when nobody withdrew the request", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const image = standIn();
    await symbolInto(image, "not-in-the-store.png");
    expect(image.removeAttribute).toHaveBeenCalledWith("src");
    expect(image.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:earlier");
  });

  it("leaves the image alone once the request is withdrawn", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const image = standIn();
    const run = new AbortController();
    const asked = symbolInto(image, "not-in-the-store.png", run.signal);
    // Withdrawn while the store is still being read - the newer request that
    // replaced it owns the image from here, and the blob on it with it.
    run.abort();
    await asked;
    expect(image.removeAttribute).not.toHaveBeenCalled();
    expect(image.dispatchEvent).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
    expect(image.dataset.blobUrl).toBe("blob:earlier");
  });
});
