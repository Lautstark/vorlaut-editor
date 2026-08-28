import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { label, nameSet, put, sheet } from "./diy.js";
import { openPanel, openSettings, openVoices, pickExport } from "./sheets.js";

/* Sending a finished package to a tablet on the same wifi, driven through the
 * real page.
 *
 * What is genuinely tested here is everything on this side of the wire: the
 * four boxes and how typing moves between them, which of the two failures gets
 * which sentence, what each of them offers next, and whether an address that
 * worked is still there on the following visit. The tablet is played by a
 * route, because the thing this file is about is not a socket.
 *
 * **The two failures are the point.** A browser that refused the way out and a
 * number with nothing at it both arrive as one rejected fetch, and their fixes
 * are opposite - one is a permission in the lock icon, the other is a number
 * to re-read. Two of the tests below are the same abort with the permission
 * answering differently, which is the whole of what the product has to tell
 * them apart by, and they assert that the sentences and the feet both differ.
 */

const VOICES_LIST = /tts\.speech\.microsoft\.com\/cognitiveservices\/voices\/list/;
const SYNTHESIS = /tts\.speech\.microsoft\.com\/cognitiveservices\/v1/;

const SAVED = label("ui.saved");

/** The one route the contract names, at the number these tests type in.
 *
 *  `ANY_TABLET` is what is actually intercepted, and it is a glob rather than
 *  that address on purpose: a test about a *wrong* number types a different
 *  one, and a route pinned to the right number would let that request out to
 *  the real network - where an address nobody in this building has answers
 *  nothing, slowly, and the failure reads as the product hanging rather than
 *  as the test having missed. Nothing here may reach a socket. */
const PAKET = "http://192.168.178.42:8765/paket";
const ANY_TABLET = "**/paket";

/** A second of 16 kHz mono PCM, which is the shape Azure is asked for. */
function wav(seconds = 0.4, hz = 220): Buffer {
  const rate = 16000;
  const frames = Math.round(rate * seconds);
  const out = Buffer.alloc(44 + frames * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + frames * 2, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(frames * 2, 40);
  for (let at = 0; at < frames; at++) {
    out.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * at / rate) * 8000),
                     44 + at * 2);
  }
  return out;
}

/** Microsoft, played by two routes - the same arrangement app_package.spec.ts
 *  states at length. A real synthesis fetches tens of megabytes of onnx. */
async function standIn(page: Page): Promise<void> {
  await page.route(VOICES_LIST, (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([
      { ShortName: "de-DE-KatjaNeural", Locale: "de-DE", Gender: "Female",
        DisplayName: "Katja", LocalName: "Katja" },
    ]),
  }));
  await page.route(SYNTHESIS, (route) => route.fulfill({
    contentType: "audio/wav", body: wav(),
  }));
}

/** The smallest Sammlung that can honestly be packaged: one sentence and a
 *  voice to speak it in. No picture - what is being sent is the archive, and
 *  the archive's contents are app_package.spec.ts's subject rather than this
 *  file's. */
async function ready(page: Page): Promise<void> {
  await page.goto("./");
  await expect(page.locator("#device .cell")).toHaveCount(6);
  await nameSet(page, "Morgens");
  await put(page, 0, "Ich habe Hunger");
  await expect(page.locator("#status")).toHaveText(SAVED, { timeout: 10_000 });

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

/** As far as the two doors: the package is written and nothing has been done
 *  with it yet. */
async function written(page: Page): Promise<Locator> {
  await pickExport(page, "app");
  const asked = sheet(page, "ui.package_title");
  await asked.locator("button", { hasText: label("ui.package_go") }).click();
  await expect(asked.locator("button", { hasText: label("ui.package_send") }))
    .toBeVisible({ timeout: 45_000 });
  return asked;
}

/** As far as the four boxes. */
async function sending(page: Page): Promise<Locator> {
  const asked = await written(page);
  await asked.locator("button", { hasText: label("ui.package_send") }).click();
  const box = sheet(page, "ui.send_title");
  await expect(box).toBeVisible();
  return box;
}

const boxes = (send: Locator) => send.locator(".address-row__box");

/** What the four boxes hold, in order. */
const typed = (send: Locator) => boxes(send).evaluateAll(
  (all) => all.map((one) => (one as HTMLInputElement).value));

/**
 * The tablet, answering the contract.
 *
 * Both methods, because `application/zip` is not a CORS-safelisted content
 * type and so the browser preflights: a route that answered the POST and let
 * the OPTIONS fall through would fail the way a receiver with no OPTIONS route
 * fails, which is not what any of these tests is about.
 */
async function tablet(page: Page, answer: (route: Route) => void): Promise<void> {
  await page.route(ANY_TABLET, (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "content-type",
        },
      });
    }
    return answer(route);
  });
}

/** One of the contract's answers, with the header every one of them must
 *  carry: without it the sender sees a failed fetch rather than a status, and
 *  a refusal that got its own words exactly right would come out as "no tablet
 *  at this address". */
const says = (route: Route, status: number, body: unknown) => route.fulfill({
  status,
  contentType: "application/json",
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body),
});

/** Whatever the permission answers, before the page has run a line.
 *
 * `local-network-access` is the only name touched: everything else on
 * navigator.permissions goes on working, so a stub here cannot quietly change
 * what some other part of the page is allowed to do. */
async function permission(page: Page, state: string): Promise<void> {
  await page.addInitScript(`(() => {
    const real = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (descriptor) =>
      descriptor && descriptor.name === "local-network-access"
        ? Promise.resolve({ state: ${JSON.stringify(state)}, onchange: null })
        : real(descriptor);
  })()`);
}

/* --- the four boxes ------------------------------------------------------ */

test("a number typed straight through lands in four boxes, dots and all",
  async ({ page }) => {
    await standIn(page);
    await ready(page);
    const send = await sending(page);

    // Nothing to send until all four say where.
    const go = send.locator("button", { hasText: label("ui.send_go") });
    await expect(go).toBeDisabled();

    /* Typed the way it is written down. Three digits move on by themselves and
     * so does a dot, which is what lets somebody copy an address off a tablet
     * without ever looking at the keyboard. */
    await boxes(send).first().click();
    await page.keyboard.type("192168178");
    expect(await typed(send)).toEqual(["192", "168", "178", ""]);
    await page.keyboard.type("42");
    expect(await typed(send)).toEqual(["192", "168", "178", "42"]);
    await expect(go).toBeEnabled();

    // Backspace empties the box it is in, and then steps back into the one
    // before it, so a correction is one key held down rather than four clicks.
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    expect(await typed(send)).toEqual(["192", "168", "178", ""]);
    // The box it steps into arrives selected, so the next digit replaces what
    // was in it rather than being appended to a full box.
    await page.keyboard.press("Backspace");
    await page.keyboard.type("9");
    expect(await typed(send)).toEqual(["192", "168", "9", ""]);

    // A letter never appears at all, rather than appearing and being told off.
    await page.keyboard.type("x7");
    expect(await typed(send)).toEqual(["192", "168", "97", ""]);
  });

/* The case the dot rule was got wrong on first, and the one anybody copying a
 * number off a tablet actually types: every octet three digits long, so the
 * caret has already moved on by the time the dot after it is pressed. A dot
 * that always moved would skip the box it had just arrived in, and what came
 * out was three numbers and an empty box. */
test("three-digit numbers and typed dots do not fight over the caret",
  async ({ page }) => {
    await standIn(page);
    await ready(page);
    const send = await sending(page);

    await boxes(send).first().click();
    await page.keyboard.type("192.168.178.42");
    expect(await typed(send)).toEqual(["192", "168", "178", "42"]);
    await expect(send.locator("button", { hasText: label("ui.send_go") }))
      .toBeEnabled();
  });

test("a dot moves on, and a whole address pasted at once fills all four",
  async ({ page }) => {
    await standIn(page);
    await ready(page);
    const send = await sending(page);

    await boxes(send).first().click();
    await page.keyboard.type("10.0.1.7");
    expect(await typed(send)).toEqual(["10", "0", "1", "7"]);

    /* A zero, a dot, and the last box - reported from the first run against a
     * real tablet as not advancing, on the address that run actually used.
     * It advances here, and the events are the browser's own rather than
     * dispatched ones, which is the difference between this and the way that
     * report was typed. Kept as the case it was, so that if real fingers ever
     * do reproduce it, this is the test that was wrong rather than a gap. */
    for (const box of await boxes(send).all()) await box.fill("");
    await boxes(send).first().click();
    await page.keyboard.type("192.168.0.36");
    expect(await typed(send)).toEqual(["192", "168", "0", "36"]);

    /* And the way most of them really arrive. Four numbers with dots between
     * them go in as four numbers - a paste that landed whole in one box would
     * be a box holding "1000107" after the digit filter had had it. */
    await boxes(send).first().click();
    await page.evaluate(`(() => {
      const paste = new DataTransfer();
      paste.setData("text", "192.168.0.176");
      document.activeElement.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: paste, bubbles: true }));
    })()`);
    expect(await typed(send)).toEqual(["192", "168", "0", "176"]);
  });

/* --- it arrives ----------------------------------------------------------- */

test("a package that arrives says so, and the address is there the next time",
  async ({ page }) => {
    await standIn(page);
    let sent: { url: string; type: string; bytes: number } | null = null;
    await tablet(page, (route) => {
      sent = {
        url: route.request().url(),
        type: route.request().headers()["content-type"] ?? "",
        bytes: (route.request().postDataBuffer() ?? Buffer.alloc(0)).length,
      };
      return says(route, 200, { outcome: "installed", name: "Morgens" });
    });
    await ready(page);
    const send = await sending(page);

    await boxes(send).first().click();
    await page.keyboard.type("192.168.178.42");
    await send.locator("button", { hasText: label("ui.send_go") }).click();

    // Both sheets go: the package is on a tablet and there is nothing left to
    // do with it here.
    await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator("#status"))
      .toHaveText(label("ui.send_installed", { name: "Morgens" }));

    // The wire, as the contract writes it: the four numbers that were typed,
    // the port and route the two halves agreed on, the raw bytes, declared as
    // a zip.
    expect(sent!.url).toBe(PAKET);
    expect(sent!.type).toBe("application/zip");
    expect(sent!.bytes).toBeGreaterThan(1000);

    /* And the next visit. The number is filled in, the caret is in the last
     * box - the one that changes - and the two that a house keeps have stepped
     * back to an outline without ceasing to be fields. */
    const again = await sending(page);
    expect(await typed(again)).toEqual(["192", "168", "178", "42"]);
    await expect(again.locator(".address-row__note")).toBeVisible();
    await expect(boxes(again).nth(0)).toHaveAttribute("data-known", "1");
    await expect(boxes(again).nth(1)).toHaveAttribute("data-known", "1");
    await expect(boxes(again).nth(2)).not.toHaveAttribute("data-known", "1");
    await expect(boxes(again).nth(3)).toBeFocused();

    // Touched, and awake. A recessed box is a hint about which numbers move,
    // never a box somebody cannot get into - a router that hands out
    // 192.168.0.x rather than 192.168.178.x has to be reachable from here.
    await boxes(again).nth(0).click();
    await expect(boxes(again).nth(0)).not.toHaveAttribute("data-known", "1");
  });

test("already_current is a success, not a near miss", async ({ page }) => {
  await standIn(page);
  await tablet(page, (route) =>
    says(route, 200, { outcome: "already_current", name: "Morgens" }));
  await ready(page);
  const send = await sending(page);

  await boxes(send).first().click();
  await page.keyboard.type("192.168.178.42");
  await send.locator("button", { hasText: label("ui.send_go") }).click();

  await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator("#status"))
    .toHaveText(label("ui.send_already", { name: "Morgens" }));
});

/* --- and the two ways it does not ----------------------------------------- */

/* The pair this whole path is shaped around. Both are one rejected fetch, and
 * the only thing that can tell them apart is the permission - so these two
 * tests are the same abort with the permission answering differently, and what
 * they assert is that nothing about the two states is the same.
 */

test("nothing at that number keeps the address editable and offers another go",
  async ({ page }) => {
    await standIn(page);
    // Granted, which is Chrome as it ships: the way out was open and there was
    // simply nothing at the other end of it.
    await permission(page, "granted");
    await tablet(page, (route) => route.abort("connectionrefused"));
    await ready(page);
    const send = await sending(page);

    await boxes(send).first().click();
    await page.keyboard.type("192.168.178.51");
    await send.locator("button", { hasText: label("ui.send_go") }).click();

    const said = send.locator(".notice.bad");
    await expect(said).toHaveText(label("ui.send_none"), { timeout: 20_000 });
    // The one failure a second press can land differently, because the boxes
    // are still there to be corrected first.
    await expect(send.locator("button", { hasText: label("ui.send_again") }))
      .toBeVisible();
    // Hidden rather than removed, so this asks what is on screen. A count
    // would be 1 and would pass for the wrong reason on the day the two feet
    // stopped differing at all.
    await expect(send.locator("button", { hasText: label("ui.send_save_instead") }))
      .toBeHidden();
    expect(await typed(send)).toEqual(["192", "168", "178", "51"]);

    // And it is not remembered. An address that answered nothing would come
    // back on the next visit looking exactly like one that had worked.
    await send.locator("button", { hasText: label("ui.cancel") }).click();
    await page.locator("dialog[open] button", { hasText: label("ui.close") }).click();
    const again = await sending(page);
    expect(await typed(again)).toEqual(["", "", "", ""]);
  });

test("a refused permission says so instead, and offers Speichern rather than a retry",
  async ({ page }) => {
    await standIn(page);
    // The same abort, with the browser having refused the way out. Nothing on
    // the wire differs; the permission is the whole of the difference.
    await permission(page, "denied");
    await tablet(page, (route) => route.abort("connectionrefused"));
    await ready(page);
    const send = await sending(page);

    await boxes(send).first().click();
    await page.keyboard.type("192.168.178.42");
    await send.locator("button", { hasText: label("ui.send_go") }).click();

    const said = send.locator(".notice.bad");
    await expect(said).toHaveText(label("ui.send_blocked"), { timeout: 20_000 });
    // Never the other sentence. Somebody told to check the number would check
    // a correct number until they gave up.
    await expect(said).not.toHaveText(label("ui.send_none"));

    /* And no second send. A retry meets the same refused permission until it
     * is taken back in the browser, so the foot offers the door that always
     * works instead - a button that silently does nothing is worse than none. */
    await expect(send.locator("button", { hasText: label("ui.send_again") }))
      .toBeHidden();
    await expect(send.locator("button", { hasText: label("ui.send_go") }))
      .toHaveCount(0);
    const instead = send.locator("button",
                                 { hasText: label("ui.send_save_instead") });
    await expect(instead).toBeVisible();

    // The address stays standing, because it is right, and saying so is half
    // the message.
    expect(await typed(send)).toEqual(["192", "168", "178", "42"]);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      instead.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/-app\.zip$/);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });

test("a tablet that refuses the package is a third thing again",
  async ({ page }) => {
    await standIn(page);
    await tablet(page, (route) => says(route, 422,
      { outcome: "refused", reason: "licence_inconsistent",
        detail: "a sentence this page must not repeat" }));
    await ready(page);
    const send = await sending(page);

    await boxes(send).first().click();
    await page.keyboard.type("192.168.178.42");
    await send.locator("button", { hasText: label("ui.send_go") }).click();

    const said = send.locator(".notice.bad");
    /* The sentence is this repository's and the code is the tablet's, shown as
     * the token it is. The receiver's own prose is deliberately not drawn: a
     * sender that read it would be a sender coupled to the receiver's wording,
     * which is what the closed set of codes exists to prevent. */
    await expect(said).toContainText("licence_inconsistent", { timeout: 20_000 });
    await expect(said).not.toContainText("must not repeat");
    // The number was right - a tablet answered on it - so the same request
    // would be the same request, and the door offered is the other one.
    await expect(send.locator("button", { hasText: label("ui.send_save_instead") }))
      .toBeVisible();
    await expect(send.locator("button", { hasText: label("ui.send_again") }))
      .toBeHidden();
  });

/* --- and the door itself -------------------------------------------------- */

test("no other export has a way to a tablet", async ({ page }) => {
  /* exchange/SPEC.md §5.2 and adr/0010 keep the three writers apart, and the
   * same reasoning decides where a send may be reached from: the talker export
   * writes a document for other AAC software and the device export writes a
   * talker's own input, and neither has a tablet at the end of it.
   *
   * tests/unit/layers.test.ts is the structural half of this - only the app
   * package's export may import the module at all. This is the half a person
   * would see: the sheet the other export ends on offers no such button.
   */
  await standIn(page);
  await ready(page);

  await pickExport(page, "talker");
  const asked = sheet(page, "ui.device_export_title");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    asked.locator("button", { hasText: label("ui.device_export_go") }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-device\.obz$/);

  // Its own ending, and one way on: the page that takes the file to a talker.
  await expect(asked.locator("a")).toBeVisible();
  await expect(asked.locator("button", { hasText: label("ui.package_send") }))
    .toHaveCount(0);
  await expect(asked.locator("button", { hasText: label("ui.send_go") }))
    .toHaveCount(0);
});
