/* A listen that never started still gives its recording back.
 *
 * speak() makes a blob URL of the synthesised WAV and used to revoke it only
 * on `ended` - which is never fired for a sound whose play() rejected, under an
 * autoplay rule or on a format the browser will not decode. Each such press
 * kept seconds of audio for the life of the page.
 *
 * node has no Audio, so it is a stand-in whose play() refuses; the URL calls
 * are spied rather than stubbed out, since what is asserted is that the URL
 * made is the URL let go of.
 */

import { expect, it, vi } from "vitest";

const status = vi.hoisted(() => vi.fn());
vi.mock("../../src/shell/dom.js", () => ({ status }));
vi.mock("../../src/core/texts.js", () => ({ t: (key: string) => key }));
vi.mock("../../src/backend/index.js", () => ({
  synthesise: () => Promise.resolve(new Blob([new Uint8Array(4)], { type: "audio/wav" })),
}));

const { speak } = await import("../../src/shell/speech.js");

it("revokes the recording when play() is refused", async () => {
  const made = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:sentence");
  const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal("Audio", class {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    play() { return Promise.reject(new Error("NotAllowedError")); }
  });

  await speak("Hallo", null);

  expect(made).toHaveBeenCalledTimes(1);
  expect(revoked).toHaveBeenCalledWith("blob:sentence");
  expect(status).toHaveBeenCalledWith("ui.play_failed");
});
