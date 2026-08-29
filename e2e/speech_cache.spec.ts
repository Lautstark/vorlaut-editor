import { expect, test, type Page } from "@playwright/test";
import { KEY_CELL, cells, nameSet, put } from "./diy.js";
import { exportForTalker, openPanel, openSettings, openVoices } from "./sheets.js";

/* Pressing ▶ twice on one key, and Microsoft only being asked once.
 *
 * adr/0016. The claim is not that the page is faster - it is that the second
 * press costs nothing, and the only way to say that from outside is to count
 * what left the browser. An `azure:` voice is what makes the count visible:
 * the route below is the whole of the synthesis, so one hit is one synthesis
 * and there is nothing else it could be. On piper the same press is a model
 * inference with no request behind it, invisible to a test at this level and
 * the same code path either way - remember() does not know which backend is
 * under it, which is the point of it being stimmquelle's function.
 *
 * The unit suite has the store and the eviction; what it structurally cannot
 * see is whether anything is wired to them. This is that half: a real page, a
 * real IndexedDB, a real §3 name, and one route counting.
 *
 * Microsoft is played by two routes for the reason app_package.spec.ts states
 * about not speaking: a real piper synthesis fetches tens of megabytes of onnx
 * from a CDN. Everything after the bytes arrive is the real page.
 */

const VOICES_LIST = /tts\.speech\.microsoft\.com\/cognitiveservices\/voices\/list/;
const SYNTHESIS = /tts\.speech\.microsoft\.com\/cognitiveservices\/v1/;

/** A second of 16 kHz mono PCM, which is the shape Azure is asked for. A tone
 *  rather than silence: the levelling chain measures loudness, and a silent
 *  clip is the one input where "it came out quiet" says nothing. */
function wav(seconds = 0.8, hz = 220): Buffer {
  const rate = 16000;
  const frames = Math.round(rate * seconds);
  const out = Buffer.alloc(44 + frames * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + frames * 2, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);          // PCM
  out.writeUInt16LE(1, 22);          // mono
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(frames * 2, 40);
  for (let at = 0; at < frames; at++) {
    out.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * at / rate) * 8000), 44 + at * 2);
  }
  return out;
}

/** Microsoft, and a count of how often it was asked to say anything. */
async function standIn(page: Page): Promise<() => number> {
  let said = 0;
  await page.route(VOICES_LIST, (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([
      { ShortName: "de-DE-KatjaNeural", Locale: "de-DE", Gender: "Female",
        DisplayName: "Katja", LocalName: "Katja" },
    ]),
  }));
  await page.route(SYNTHESIS, (route) => {
    said++;
    // A different tone per sentence, taken from the SSML Azure was sent, so
    // that two sentences are two recordings rather than one by accident.
    const asked = route.request().postData() ?? "";
    route.fulfill({ contentType: "audio/wav", body: wav(0.8, 200 + asked.length) });
  });
  return () => said;
}

/** A Sammlung with a voice that can be spoken without a CDN. */
async function fill(page: Page): Promise<void> {
  await page.goto("./");
  await expect(page.locator("#device .cell")).toHaveCount(6);
  await nameSet(page, "Morgens");
  await put(page, 0, "Ich habe Hunger");
  await put(page, 1, "Ich habe Durst");

  // Two sheets, because they are two scopes: the key stocks the list for every
  // Sammlung on this machine, and the tick binds exactly this one.
  await openSettings(page);
  await openPanel(page, "#azurePanel");
  await page.locator("#azureKey").fill("0000fakekeyfakekeyfakekey0000");
  await page.locator("#azureRegion").fill("westeurope");
  await page.locator("#azureSave").click();

  await openVoices(page);
  await page.locator("#voiceList .voiceRow", { hasText: "Katja" })
    .locator("button.voice").click();
  await expect(page.locator('#voiceList .voice[aria-checked="true"]')).toHaveCount(1);
  await page.locator("#collectionSheetClose").click();
  await expect(page.locator("#collectionSheet")).toBeHidden();
}

/** Press the ▶ on a key and wait for it to finish being pressed.
 *
 * The button says ··· while a sentence is being made and its own label again
 * afterwards, so that is the wait. Without it the second press lands while the
 * first synthesis is still in flight, nothing has been written to the cache
 * yet, and the test would be measuring a race rather than a cache. */
async function play(page: Page, at: number): Promise<void> {
  const button = cells(page).nth(KEY_CELL[at]!).locator(".cell__play");
  await button.click();
  await expect(button).toHaveText("▶", { timeout: 30_000 });
}

test("the same key spoken twice is synthesised once", async ({ page }) => {
  const said = await standIn(page);
  await fill(page);

  await play(page, 0);
  expect(said()).toBe(1);

  /* The assertion this file exists for. Before adr/0016 this was 2: speak()
   * was called fresh on every press, and on an `azure:` voice that is a billed
   * round trip for audio the browser made a moment ago and dropped. */
  await play(page, 0);
  expect(said()).toBe(1);

  // And it is a cache rather than a page that has stopped speaking: a second
  // sentence is a second name, so it costs a synthesis of its own.
  await play(page, 1);
  expect(said()).toBe(2);
});

/* The other end of the same claim, and the one that decides whether the export
 * benefits: the ▶ and the talker's export ask stimmquelle for the same audio -
 * the device's rate, the device's fade and pad - so they ask under the same §3
 * name and share every entry. A carer who has listened to their Sammlung has
 * already paid for its export.
 *
 * If those two ever stop asking for the same recording this test goes red,
 * which is the whole reason it is here rather than in a comment: the two option
 * objects are in one file today and nothing but this holds them together. */
test("a Sammlung listened to is a Sammlung already spoken for", async ({ page }) => {
  const said = await standIn(page);
  await fill(page);

  await play(page, 0);
  await play(page, 1);
  expect(said()).toBe(2);

  /* No picture on either key, and that is not a shortcut. A reference that
   * resolves to nothing is counted rather than refused - the compiler draws
   * its grey cross - so a Sammlung of two sentences and no pictures writes a
   * complete file, and what this test is about is the audio in it. */
  await exportForTalker(page);
  // Nothing new was said. Both sentences were already in the store, under the
  // names the export asks for.
  expect(said()).toBe(2);
});
