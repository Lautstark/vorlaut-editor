import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  KEY_CELL, PAGE_KEY, cells, choose, chooseNamed, expectSaid, key, keySheet, label,
  nameSet, openBoard, pageMore, press, within, put, search, searchNote, setCard,
  word,
} from "./diy.js";
import { exportForTalker, openSettings, openVoices } from "./sheets.js";

/* The whole editing loop, end to end, in one browser.
 *
 * page.spec.ts asks whether the page opens; this asks whether somebody can
 * actually make a board with it. It exists because the deployed page shipped
 * with the loop broken in two places no smaller test saw: the play button
 * refused every press because the seam forgot that "" means the board's own
 * voice, and a symbol upload had never worked because an unawaited Promise is
 * truthy. Each step below is one of the things a parent sitting down with this
 * for an evening would do.
 *
 * What it deliberately does not do is speak. A real synthesis fetches a piper
 * model from a CDN - tens of megabytes, minutes of onnx - and what it would
 * prove is stimmquelle's business, tested in that repository. The line drawn
 * here is: everything up to the seam, and the page's own answer when there is
 * no voice to speak with.
 *
 * ## What moved, and why so much of it
 *
 * The board stopped being a place you type into. A key was a tile holding a
 * thumb, a sentence field and a play button; it is a cell now, and everything
 * about it is in a sheet a press opens - the same arrangement editor-app has,
 * which is what the convergence was for. So the sentences below are typed
 * through that sheet, by e2e/diy.ts's put(), and what the board is asked for
 * is what it *draws*.
 *
 * That is a better question than the one this file used to ask. A filled field
 * proves the field was filled; a word on a cell proves the editor believes it,
 * which is the thing a person actually looks at.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

const SAVED = label("ui.saved");

/** Opens the Board panel inside the settings sheet, whatever state the
 *  <details> was left in - it keeps its fold across closings of the sheet. */
async function openBoardPanel(page: Page) {
  await openSettings(page);
  const panel = page.locator("#boardPanel");
  if ((await panel.getAttribute("open")) === null) {
    await panel.locator("summary").click();
  }
}

test("the board is the device: a hole and five equal keys", async ({ page }) => {
  /* The arrangement, asserted because it is the thing that was wrong. This
   * editor drew a set tile and four tiles in a row of three while
   * data/obf.ts's grid() exported two rows of three with a hole in it, so the
   * one screen somebody arranges a board on disagreed with the file that board
   * becomes. docs/hardware.md is the authority for both. */
  await openBoard(page);
  await expect(cells(page).nth(0)).toHaveClass(/cell--hole/);
  // The hole is neither a control nor a drop target: nothing in it is
  // focusable and it cannot be dragged.
  await expect(cells(page).nth(0).locator(".cell__open")).toHaveCount(0);
  await expect(cells(page).nth(0)).not.toHaveAttribute("draggable", "true");
  /* And the other five are five of a kind. There used to be four here: the
   * cell under the speaker was a set key, was not a drop target, and opened
   * something else. It is a key. */
  for (const at of KEY_CELL) {
    await expect(cells(page).nth(at)).toHaveAttribute("draggable", "true");
    await expect(cells(page).nth(at).locator(".cell__open")).toHaveCount(1);
  }
  // Every one of them opens the same sheet, the page key included.
  for (const slot of [0, PAGE_KEY, 4]) {
    await key(page, slot).click();
    await expect(keySheet(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(keySheet(page)).toHaveCount(0);
  }
});

test("a page can be named, filled and kept", async ({ page }) => {
  await openBoard(page);

  await nameSet(page, "Morgens");
  await put(page, 0, "Ich will nach draussen");

  /* The page's card is a name and a delete, and nothing else. It held a row of
   * swatches until the firmware stopped reading the colour; it held the set
   * key's own two rows and a picture column until the fifth key stopped being
   * a different kind of thing. The assertion that none of them is there is
   * here rather than in a test of its own: this is the test that opens the
   * card, and a control nobody can find is what the card is for. */
  await pageMore(page).click();
  const card = setCard(page);
  await expect(card.locator(".swatch")).toHaveCount(0);
  await expect(card.locator(".pick")).toHaveCount(0);
  await expect(card.locator("#diySetDoes")).toHaveCount(0);
  await press(card, "ui.done");
  await expect(page.locator("#status")).toHaveText(SAVED, { timeout: 10_000 });

  await page.reload();
  await expect(cells(page)).toHaveCount(6);
  // The name is drawn on the panel the firmware prints it on, because the key
  // there has no word of its own - see PAGE_KEY.
  await expect(cells(page).nth(KEY_CELL[PAGE_KEY]!).locator(".cell__word"))
    .toHaveText("Morgens");
  await expectSaid(page, 0, "Ich will nach draussen");
});

test("a dismissed sheet writes nothing", async ({ page }) => {
  /* The rule the whole draft model exists for, and the one an empty cell makes
   * unavoidable: pressing one must not leave a blank key behind. The tile
   * wrote as you typed, because it was always on screen and there was nothing
   * to dismiss. */
  await openBoard(page);
  await key(page, 0).click();
  await keySheet(page).locator("#diyKeyText").fill("Nicht bestaetigt");
  await page.keyboard.press("Escape");
  await expect(keySheet(page)).toHaveCount(0);
  await expectSaid(page, 0, "");
  await expect(cells(page).nth(KEY_CELL[0])).toHaveClass(/cell--empty/);
});

test("a second set can be added and removed again", async ({ page }) => {
  await openBoard(page);
  const tabs = page.locator("#tabs .tab:not(.add)");
  await expect(tabs).toHaveCount(1);

  await page.locator("#tabs .tab.add").click();
  await expect(tabs).toHaveCount(2);
  // Something on it, so the question below has a number to carry.
  await put(page, 0, "Noch einmal");
  await expect(page.locator("#status")).toHaveText(SAVED, { timeout: 10_000 });

  /* This used to be `page.once("dialog", d => d.accept())` - a native
   * confirm(), which conventions.md §3.4 forbids and which asked "really
   * delete?" with an OK button and no idea what was inside.
   *
   * What replaced it is the shape §1.7 asks for and the one editor-app already
   * uses a floor down: a <dialog> that counts what goes and names the act on
   * the button. Both halves are asserted here, because the count is the whole
   * reason the question exists and a button reading OK would still pass a test
   * that only checked the set disappeared.
   *
   * It is reached from the page's own card now rather than from a red button
   * under the board, which is where every other destructive act in this
   * product sits. */
  await pageMore(page).click();
  await press(setCard(page), "ui.remove_set");
  const asked = page.getByRole("dialog", { name: label("ui.remove_set") });
  await expect(asked).toBeVisible();
  await expect(asked.locator(".body")).toContainText(/(einen Taste|one key)/);

  // Dismissed deletes nothing - the rule this repository keeps everywhere -
  // and it leaves the card it was asked from standing, because a no leaves
  // somebody exactly where they were.
  await asked.locator("button", { hasText: label("ui.cancel") }).click();
  await expect(setCard(page)).toBeVisible();
  await expect(tabs).toHaveCount(2);

  await press(setCard(page), "ui.remove_set");
  await asked.locator("button", { hasText: label("ui.set_delete_go") }).click();
  await expect(tabs).toHaveCount(1);
  // And this time the card goes with the set it was about.
  await expect(setCard(page)).toHaveCount(0);
});

test("tabs and cells answer the keyboard", async ({ page }) => {
  await openBoard(page);

  // A second set, then back to the first, without touching the mouse.
  await page.locator("#tabs .tab.add").focus();
  await page.keyboard.press("Enter");
  const tabs = page.locator("#tabs .tab:not(.add)");
  await expect(tabs).toHaveCount(2);
  await tabs.first().focus();
  await page.keyboard.press("Enter");
  await expect(tabs.first()).toHaveClass(/active/);

  // Enter on a cell opens its sheet, which is the whole of what a press does
  // now - there is nothing on the board to reach past it to.
  await key(page, 0).focus();
  await page.keyboard.press("Enter");
  await expect(keySheet(page)).toBeVisible();
  await page.keyboard.press("Escape");

  // And the ⋯ on the current tab opens the page's own card, which is the only
  // door to it: the cell under the speaker used to open it too, and that was
  // the one cell on the board that did not open what was on it.
  await page.locator("#tabs .tab.active .tab__more").focus();
  await page.keyboard.press("Enter");
  await expect(setCard(page)).toBeVisible();
});

test("the pages do not move, and the keys swap without a mouse", async ({ page }) => {
  await openBoard(page);

  /* A second page, so there is a strip with something in it.
   *
   * **Nothing reorders the pages any more, and that is the assertion.** The
   * order used to be the navigation - the set key went to the next page along,
   * so where a page sat was where its key led - and a tab was dragged or moved
   * with Alt+Arrow to steer it. The ring is targets now, so a move would
   * shuffle the strip and change nothing about what leads where: a gesture
   * that looks like it did something. What it did is done by pointing a key
   * somewhere, in the sheet the cell opens. adr/0023.
   */
  await page.locator("#tabs .tab.add").focus();
  await page.keyboard.press("Enter");
  const tabs = page.locator("#tabs .tab:not(.add)");
  await expect(tabs).toHaveCount(2);
  await nameSet(page, "Zwei");

  await expect(tabs.nth(1)).not.toHaveAttribute("draggable", "true");
  await expect(tabs.nth(1)).not.toHaveAttribute("aria-keyshortcuts", /Alt/);
  await tabs.nth(1).focus();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(tabs.nth(1)).toHaveText(/Zwei/);

  /* Five keys with distinguishable sentences, to see a move by its work.
   *
   * Alt+Arrow on a cell replaces the grip that armed a swap with Enter and
   * completed it with a second Enter. It is the key editor-app uses for the
   * same act, and it needs no state between two ends - so there is nothing to
   * arm, nothing to mark and nothing to let go of with Escape.
   *
   * Over all five, where it used to be the 2x2 block: the one cell it could
   * not reach was the set key, and there is no set key. */
  await put(page, 0, "Eins");
  await put(page, 1, "Zwei");
  await put(page, 2, "Drei");
  await put(page, 3, "Vier");
  await put(page, 4, "Fuenf");

  await key(page, 0).focus();
  await page.keyboard.press("Alt+ArrowRight");
  await expectSaid(page, 0, "Zwei");
  await expectSaid(page, 1, "Eins");
  // Focus follows the key rather than staying at the cell, which is what makes
  // a run of presses carry one key across the board.
  await expect(key(page, 1)).toBeFocused();

  await page.keyboard.press("Alt+ArrowDown");
  await expectSaid(page, 1, "Fuenf");
  await expectSaid(page, 4, "Eins");
  await expect(key(page, 4)).toBeFocused();

  // And across onto the panel under the speaker, which is a place a key can go
  // now and was not while a set key sat there.
  await key(page, 3).focus();
  await page.keyboard.press("Alt+ArrowLeft");
  await expectSaid(page, PAGE_KEY, "Vier");
  await expect(key(page, PAGE_KEY)).toBeFocused();

  /* The speaker's corner is still the whole of where a key may not go: there
   * is a 40 mm cone behind it. */
  const slots = [0, 1, 2, 3, 4];
  const was = await Promise.all(slots.map((slot) => word(page, slot).textContent()));
  await key(page, PAGE_KEY).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await key(page, 0).focus();
  await page.keyboard.press("Alt+ArrowUp");
  expect(await Promise.all(slots.map((slot) => word(page, slot).textContent())))
    .toEqual(was);
});

test("an own picture lands on a key and renders", async ({ page }) => {
  await openBoard(page);

  /* Through the sheet, the way a person does it: the cell opens it and "own
   * image" reaches the hidden file input in its picture column. Uploading
   * exercises the store write and symbolInto's blob rendering - the path that
   * shipped setting img.src to "[object Promise]".
   *
   * There is no second dialog in front of this any more. The picture, its
   * search and the upload are the sheet's left column, which is what a modal
   * over a modal to choose a symbol was replaced by. */
  await key(page, 0).click();
  const box = keySheet(page);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    box.locator(".pick button", { hasText: label("ui.symbol_own") }).click(),
  ]);
  await chooser.setFiles(join(HERE, "fixtures", "symbol.png"));

  // The sheet's own preview takes it first.
  await expect(box.locator(".pick__preview img")).toBeVisible();
  await press(box, "ui.done");

  // And then the cell behind it.
  const image = cells(page).nth(KEY_CELL[0]).locator(".cell__pic");
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty("naturalWidth", 16);
});

test("a picture can be taken off a key again", async ({ page }) => {
  /* The other half of the one above. Until this control existed a picture
   * could only be replaced, never removed: every way out of the sheet either
   * kept the symbol or put a different one in its place, so a key that had
   * been given the wrong picture was stuck with a picture.
   *
   * Nothing downstream had to change for it - `symbol: ""` is what a key
   * without a picture has always been - which is exactly what this asserts:
   * the cell behind the sheet goes back to drawing its word. */
  await openBoard(page);
  await key(page, 0).click();
  const box = keySheet(page);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    box.locator(".pick button", { hasText: label("ui.symbol_own") }).click(),
  ]);
  await chooser.setFiles(join(HERE, "fixtures", "symbol.png"));
  await expect(box.locator(".pick__preview img")).toBeVisible();

  // Only once there is something to take off: with no picture there is nothing
  // for it to do, and a control that is permanently dead reads as broken.
  const off = box.locator(".pick button", { hasText: label("ui.symbol_off") });
  await off.click();
  await expect(box.locator(".pick__preview img")).toHaveCount(0);
  await expect(box.locator(".pick__preview--none")).toBeVisible();
  await expect(off).toBeHidden();
  await press(box, "ui.done");

  await expect(cells(page).nth(KEY_CELL[0]!).locator(".cell__pic")).toHaveCount(0);
});

test("a picture can be crossed out, which is how a key says \"not\"", async ({ page }) => {
  /* German AAC negates by crossing the symbol out rather than by using a
   * picture of its own - METACOM ships no "nicht" and never will. Until this
   * existed the only way to build "kein Brot" here was a picture of bread with
   * nothing on the key to say it meant the opposite.
   *
   * The control is the picture column's, which is one column shared by both
   * editors - see drawPick() in src/shell/sheet.ts. What is editor-specific is
   * the cell, and that is what the last two assertions are about. */
  await openBoard(page);
  await key(page, 0).click();
  const box = keySheet(page);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    box.locator(".pick button", { hasText: label("ui.symbol_own") }).click(),
  ]);
  await chooser.setFiles(join(HERE, "fixtures", "symbol.png"));
  await expect(box.locator(".pick__preview img")).toBeVisible();

  // Nothing to cross out until there is a picture, and something to cross out
  // as soon as there is.
  const negate = box.locator(".pick__negate input");
  await expect(negate).toBeVisible();
  await expect(negate).not.toBeChecked();
  await negate.check();
  // The sheet's own preview says so before anything is kept, because the
  // question somebody is answering is what the key will look like.
  await expect(box.locator(".pick__preview .negate")).toBeVisible();
  await press(box, "ui.done");

  // And the cell behind it. The picture stays - crossing out is not removing.
  const cell = cells(page).nth(KEY_CELL[0]!);
  await expect(cell.locator(".cell__pic")).toBeVisible();
  await expect(cell.locator(".cell__crossed .negate")).toBeVisible();

  // Reopening shows the answer that was given rather than a fresh no, and
  // taking it back takes the cross off the board.
  await key(page, 0).click();
  await expect(box.locator(".pick__negate input")).toBeChecked();
  await box.locator(".pick__negate input").uncheck();
  await press(box, "ui.done");
  await expect(cell.locator(".negate")).toHaveCount(0);
  await expect(cell.locator(".cell__pic")).toBeVisible();
});

/* A test stood here that turned the board into the device's own rendering and
 * measured it at 15.21 mm. The toggle it drove is on the loader page now, as
 * the compiled tiles rather than a prediction of them - adr/0013 - and
 * e2e/loader.spec.ts is where the picture is asserted. Nothing in the editor
 * draws a tile any more, so there is nothing here to replace it with. */

test("a Sammlung leaves as a .obz and comes back beside the others", async ({ page }) => {
  await openBoard(page);
  await put(page, 0, "Das bleibt");
  await expect(page.locator("#status")).toHaveText(SAVED, { timeout: 10_000 });

  /* Exporting is in the work head's ⋯, beside the Sammlung it exports, and
     the sheet behind it leads with the talker - which is what this Sammlung
     is for and, since the document export was dropped from that sheet, the
     door a round trip comes through.

     It writes without speaking, which is why this file may still have it. No
     voice has been chosen here - that is this spec's whole rule, at the top -
     so the export has nothing to synthesise and every key travels silent,
     which is exactly the Sammlung layout.bin's per-slot flag is for. */
  const download = await exportForTalker(page);
  const file = await download.path();
  expect(file).toBeTruthy();

  // Scribble over the sentence. The import must NOT take it back: a file
  // arriving joins what is here rather than replacing it, so the scribble
  // survives and the file arrives beside it as a second Sammlung.
  await put(page, 0, "Uebergeschrieben");
  await expect(page.locator("#status")).toHaveText(SAVED, { timeout: 10_000 });

  const rows = page.locator("#collectionList .collections__item");
  await expect(rows).toHaveCount(1);

  // Importing is inside Einstellungen now: the sidebar holds the list, the way
  // to make one, and the way out of the page.
  await openBoardPanel(page);
  const [importChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#boardImport").click(),
  ]);
  await importChooser.setFiles(file!);

  await page.locator("#voiceClose").click();
  await expect(rows).toHaveCount(2);
  // The one that arrived is open, and it holds what was exported.
  await expectSaid(page, 0, "Das bleibt");

  // And the one it was imported next to still has the scribble.
  await rows.filter({ hasNotText: "board" }).last().click();
  await expectSaid(page, 0, "Uebergeschrieben");
});

/** A Sicherung, as the bytes a file chooser would hand over. Written here
 *  rather than kept as a fixture: what is being tested is the shape the
 *  product itself writes, and a fixture beside it would go stale the day that
 *  shape changes while this file went on passing. */
function sicherung(boards: { id: string; name: string }[]) {
  const page = (label: string) => ({
    id: "start", name: "start",
    buttons: [{
      id: "b1", row: 0, col: 1, label, vocalization: "",
      symbol: "arasaac-2483.png", wordClass: "misc", act: { kind: "append" },
    }],
  });
  return {
    name: "sicherung-2026-08-26.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "vorlaut-backup",
      version: 2,
      exportedAt: "2026-08-26T00:00:00.000Z",
      boards: boards.map(({ id, name }) => ({
        id, name,
        layout: { target: "app", grid: { rows: 3, columns: 5 },
                  pages: [page(name)], home: "start" },
      })),
      current: boards[0]!.id,
      // One picture, so the sentence about pictures has something to count.
      symbols: [{ name: "arasaac-2483.png", data: "iVBORw0KGgo=" }],
      settings: {},
      notice: "",
    })),
  };
}

interface Handed { name: string; mimeType: string; buffer: Buffer }

/** Hands a file to the Board panel's import button. */
async function importFile(page: Page, file: Handed) {
  await openBoardPanel(page);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#boardImport").click(),
  ]);
  await chooser.setFiles(file);
}

test("a Sicherung of one Sammlung comes in beside the others, not over them",
  async ({ page }) => {
  await openBoard(page);
  await put(page, 0, "Das bleibt");
  await expect(page.locator("#status")).toHaveText(SAVED, { timeout: 10_000 });

  const rows = page.locator("#collectionList .collections__item");
  await expect(rows).toHaveCount(1);

  await importFile(page, sicherung([{ id: "kept-id", name: "Kueche" }]));

  // The sentence counts the pictures, because a Sicherung brings its own and
  // an .obz does not.
  await expect(page.locator("#boardState"))
    .toHaveText(label("ui.collection_imported_pictures", { name: "Kueche", n: 1 }));
  await page.locator("#voiceClose").click();

  // Beside, not over: two rows, and the Sammlung that was here still has its
  // sentence.
  await expect(rows).toHaveCount(2);
  // Named for what the file called the Sammlung, not for the file - the file
  // is called sicherung-2026-08-26.
  await expect(rows.filter({ hasText: "Kueche" })).toHaveCount(1);
  await rows.filter({ hasNotText: "Kueche" }).last().click();
  await expectSaid(page, 0, "Das bleibt");
});

test("a Sicherung of the whole library is refused, and says which button reads it",
  async ({ page }) => {
  await openBoard(page);
  const rows = page.locator("#collectionList .collections__item");
  await expect(rows).toHaveCount(1);

  await importFile(page, sicherung([
    { id: "a", name: "Kueche" }, { id: "b", name: "Kinderzimmer" },
  ]));

  await expect(page.locator("#boardState"))
    .toHaveText(label("ui.collection_many", { n: 2 }));
  await page.locator("#voiceClose").click();
  // Refused whole: nothing was added, and nothing was replaced either.
  await expect(rows).toHaveCount(1);
});

test("a voice can be chosen and is still ticked on reopening", async ({ page }) => {
  await openBoard(page);
  // The voice is this Sammlung's, so it is behind this Sammlung's ⋯ rather
  // than in Einstellungen: what a talker sounds like is not a fact about the
  // browser it was built in.
  await openVoices(page);
  const rows = page.locator("#voiceBox .voices__row");
  await expect(rows.first()).toBeVisible();

  // Offered because this page owns the piper runtime, and for no other
  // reason: vits-web can phonemise neither of these two. Kerstin is the one
  // voice that reaches the device at its own 16 kHz with no resample, so her
  // row going missing is broken wiring, not a catalogue opinion.
  await expect(page.locator("#voiceBox .voices__row", { hasText: "Kerstin" }))
    .toHaveCount(1);
  await expect(page.locator("#voiceBox .voices__row", { hasText: "John" }))
    .toHaveCount(1);

  const picked = (await rows.first().locator(".voice__name").textContent())!;
  await rows.first().locator("button.voice").click();
  await expect(page.locator('#voiceBox .voice[aria-checked="true"]')).toHaveCount(1);
  // No Save: choosing wrote it. The board's own status line is the proof,
  // and it is what every other edit on this page already says.
  await expect(page.locator("#status")).toHaveText(SAVED, { timeout: 10_000 });
  await page.locator("#collectionSheetClose").click();
  await expect(page.locator("#collectionSheet")).not.toBeVisible();

  // Reopened, exactly one row is marked and it is the one that was picked.
  // The regression this pins: listVoices() once dropped `chosen`, and the
  // sheet opened with nothing marked every time.
  await openVoices(page);
  const on = page.locator('#voiceBox .voice[aria-checked="true"]');
  await expect(on).toHaveCount(1);
  await expect(on.locator(".voice__name")).toHaveText(picked);
  await page.locator("#collectionSheetClose").click();
});

test("the voice that rushes a single word says so, on its row alone", async ({ page }) => {
  /* The failure this pins is not a wrong string, it is a silent one. The
   * catalogue flags a voice that crams an unpunctuated word into a fixed slot;
   * nothing about that is audible until somebody has recorded a whole board of
   * one-word keys, so if the note stops rendering nothing else here goes red.
   *
   * Two rows are asserted rather than a count, on purpose. The catalogue owns
   * which voices carry the flag, and a second one arriving must not make this
   * test wrong - it would only have to make the note appear in one more place.
   * What is checked is the shape: the flagged voice has it, an unflagged one
   * does not. Nothing here synthesises; the note is drawn from the list. */
  await openBoard(page);
  await openVoices(page);
  await expect(page.locator("#voiceBox .voices__row").first()).toBeVisible();

  const kerstin = page.locator("#voiceBox .voices__row", { hasText: "Kerstin" });
  await expect(kerstin).toHaveCount(1);

  /* Chosen first, and that is not a detour. The line under the facts carries
   * two different notes now: the catalogue's, which is this test's subject,
   * and this product's "nobody picked this one", which lands there too and
   * sits on whichever voice the Sammlung's language happens to start on. With
   * a voice ticked the second note is gone from every row, so what is left on
   * a row is the catalogue's alone and the count below means what it says. */
  await kerstin.locator("button.voice").click();
  await expect(page.locator("#status")).toHaveText(SAVED, { timeout: 10_000 });

  /* The words are @lautstark/stimmquelle/voice-picker's now - it carries the
   * sentence in both languages, and this repository's own copy of it went with
   * the rows. So what is held here is the shape the comment above describes
   * and nothing more: the flagged voice has a line, an unflagged one does not.
   * Which voices carry the flag is the catalogue's, and asserting its wording
   * from here would be this suite holding another repository's prose. */
  await expect(kerstin.locator(".voice__hint")).toHaveCount(1);
  await expect(kerstin.locator(".voice__hint")).not.toBeEmpty();

  // Two Thorstens are offered and neither is flagged, so this counts across
  // both rather than picking one of them.
  const thorsten = page.locator("#voiceBox .voices__row", { hasText: "Thorsten" });
  expect(await thorsten.count()).toBeGreaterThan(0);
  await expect(thorsten.locator(".voice__hint")).toHaveCount(0);

  await page.locator("#collectionSheetClose").click();
});

/* The keyboard in the voice list, which is the half this page never had.
 *
 * Three separate defects, all of them fixed by the list becoming
 * @lautstark/stimmquelle/voice-picker's, and none of them visible in a
 * screenshot - so they are held here.
 *
 * The list used to be a row of plain buttons in a group with no name. With an
 * Azure key that is several hundred tab stops between the search field and the
 * panels underneath, which is the very thing the search field was added to
 * prevent, and a screen reader was told nothing about what the group was for.
 *
 * The third one is the reason this test presses the arrow twice rather than
 * once, and it is a defect the two sibling products still had while having
 * arrow keys: an arrow moves the choice, choosing calls back into the product,
 * the product redraws the list, and the row that had focus is a detached node.
 * Focus lands on the document and the second arrow does nothing at all. Arrows
 * that work exactly once look like arrows that work. The module owns both the
 * keys and the repaint, so it can put the keyboard back where it was standing;
 * that repaint is chooseVoice() in src/shell/voices.ts calling refresh(), so
 * this is a real round trip through this repository and not the module talking
 * to itself.
 */
test("the voice list is one tab stop, is named, and the arrows keep their place",
  async ({ page }) => {
    await openBoard(page);
    await openVoices(page);
    const rows = page.locator("#voiceBox .voices__row");
    await expect(rows.first()).toBeVisible();

    // Named, so a screen reader says what the group is for.
    await expect(page.locator("#voiceBox .voices")).toHaveAttribute("aria-label", /.+/);

    /* One way in, whatever the list is holding. A roving tabindex is what makes
       a group of radios one stop: exactly one row is reachable by Tab and the
       rest are reached by the arrows. */
    const many = await page.locator("#voiceBox .voice").count();
    expect(many).toBeGreaterThan(2);
    await expect(page.locator('#voiceBox .voice[tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('#voiceBox .voice[tabindex="-1"]')).toHaveCount(many - 1);

    /** The id of the row the keyboard is standing on, or what it fell to. */
    const standing = () => page.evaluate(() => {
      const at = document.activeElement as HTMLElement | null;
      return at?.classList.contains("voice") ? at.dataset.id ?? "" : `!${at?.tagName}`;
    });

    await page.locator('#voiceBox .voice[tabindex="0"]').focus();
    const first = await standing();
    expect(first.startsWith("!")).toBe(false);

    // One press: the choice moves with the focus, which is what arrows do in a
    // radio group.
    await page.keyboard.press("ArrowDown");
    const second = await standing();
    expect(second).not.toBe(first);
    expect(second.startsWith("!")).toBe(false);
    await expect(page.locator('#voiceBox .voice[aria-checked="true"]'))
      .toHaveAttribute("data-id", second);

    /* And again, after this repository has redrawn the whole list underneath
       it. Before the move this second press did nothing: the answer here was
       "!BODY". */
    await page.keyboard.press("ArrowDown");
    const third = await standing();
    expect(third).not.toBe(second);
    expect(third.startsWith("!")).toBe(false);
    await expect(page.locator('#voiceBox .voice[aria-checked="true"]'))
      .toHaveAttribute("data-id", third);

    // Still one way in after three repaints, on the row the keyboard is on.
    await expect(page.locator('#voiceBox .voice[tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('#voiceBox .voice[tabindex="0"]'))
      .toHaveAttribute("data-id", third);
    await page.locator("#collectionSheetClose").click();
  });

/* The quality tier is on the name and nowhere else.
 *
 * This page used to translate it - "hohe Qualitaet" - and print it in the facts
 * line beside the download size. Both halves were wrong once the picker shipped
 * inside the package: labelOf() is stimmquelle's own published answer to what a
 * voice is called, and a picker shipped in that package must not be a second
 * one. The ambiguity is in the name, so what resolves it belongs on the name
 * rather than four words away in a line where a reader has to work out which of
 * the two rows differs.
 *
 * It stays the catalogue's code rather than a word, which is the same argument
 * this repository already made for keeping `recommended` off a row: a tier in
 * words reads as a ranking, and Kerstin is `low` for a reason that belongs to
 * vits-web rather than to her.
 */
test("the tier that tells two Thorstens apart is in the name, not in the facts",
  async ({ page }) => {
    await openBoard(page);
    await openVoices(page);
    const thorsten = page.locator("#voiceBox .voices__row", { hasText: "Thorsten" });
    // More than one, or there is no ambiguity for a tier to resolve and this
    // test is asserting nothing.
    expect(await thorsten.count()).toBeGreaterThan(1);

    for (const row of await thorsten.all()) {
      // The code in brackets, straight off the catalogue.
      await expect(row.locator(".voice__name")).toHaveText(/^Thorsten \([a-z_]+\)$/);
      // And not a second time in the line under it, translated or otherwise.
      await expect(row.locator(".voice__facts")).not.toContainText("(");
      await expect(row.locator(".voice__facts")).toHaveText(/MB$/);
    }

    // A voice with no twin keeps its plain name: a list holding one Kerstin has
    // nothing to disambiguate, so nothing is appended.
    await expect(page.locator("#voiceBox .voices__row", { hasText: "Kerstin" })
      .locator(".voice__name")).toHaveText("Kerstin");
    await page.locator("#collectionSheetClose").click();
  });

test("a Sammlung nobody has told anything opens on a voice, and says nobody chose it",
  async ({ page }) => {
    /* What used to be here was the opposite test: pressing play said "no voice
     * chosen yet, pick one in the gear". That sentence has gone, and so has
     * the guard that produced it - a fresh layout's empty `voice` field is not
     * the absence of an answer any more. The Sammlung's language picks one,
     * and the field stays empty because nobody has chosen anything, which is
     * a different fact and is the one the note on the row states.
     *
     * The two halves are asserted together on purpose. A mark with no note
     * would be the page claiming a choice nobody made; a note with no mark
     * would be the preselection not happening at all. */
    await openBoard(page);
    await openVoices(page);
    await expect(page.locator("#voiceBox .voices__row").first()).toBeVisible();

    const on = page.locator('#voiceBox .voice[aria-checked="true"]');
    await expect(on).toHaveCount(1);
    // Under the facts rather than among them. The facts line is four words
    // that compare two voices; this is a clause about how this one came to be
    // marked, and it is the picker's notes() hook that puts it on its own line.
    await expect(on.locator(".voice__hint")).toContainText(within("ui.voice_auto_note"));

    // And the folded heading is the same answer rather than "none chosen yet",
    // which is the one line the panel is read for nine times out of ten.
    await expect(page.locator("#voiceState"))
      .toContainText((await on.locator(".voice__name").textContent())!);
    await expect(page.locator("#voiceState")).not.toHaveText(label("ui.voice_state_none"));
    await page.locator("#collectionSheetClose").click();
  });

test("a whole sentence finds the symbol its words point at", async ({ page }) => {
  // The collection answers for one word only: the lemma. Everything the search
  // is typed at below has to be reduced to it before ARASAAC is ever asked,
  // which is the whole of what bildquelle's German half is for.
  const asked: string[] = [];
  await page.route("**/api.arasaac.org/**", (route) => {
    const term = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop()!);
    asked.push(term);
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(term.toLowerCase() === "durstig"
        ? [{ _id: 4242, keywords: [{ keyword: "durstig" }] }]
        : []),
    });
  });
  await page.route("**/static.arasaac.org/**", (route) =>
    route.fulfill({ contentType: "image/png", body: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }));

  await openBoard(page);
  await key(page, 0).click();
  const box = keySheet(page);
  await expect(box).toBeVisible();

  // Typed as somebody would write it on a key: a sentence, with a full stop.
  // Before this, the raw string went to the collection and came back empty.
  await search(box, "Ich bin durstig.");
  await expect(searchNote(box)).toHaveCount(0);
  await expect(box.locator(".pick__hit")).toHaveCount(1);

  // And it got there by asking for the word, not the sentence.
  expect(asked).toContain("durstig");
  expect(asked).not.toContain("Ich bin durstig.");
});

test("the sheet says what is owed for the pictures it shows", async ({ page }) => {
  /* ARASAAC is CC BY-NC-SA and the wording is a condition of the licence, so
   * it has to appear wherever its pictures do. That used to be one place - the
   * picker dialog - because there was one place pictures were shown. A sheet
   * carries its own search now, in both editors, so the line is part of the
   * picture column rather than of the dialog nothing opens. */
  await openBoard(page);
  await key(page, 0).click();
  const box = keySheet(page);
  await expect(box.locator(".pick__credits")).not.toBeEmpty();
  await expect(box.locator(".pick__credits")).toContainText("ARASAAC");
});

test("a key can say its word, lead onward, or do both", async ({ page }) => {
  /* The three answers the key sheet offers, driven the way a person drives
   * them - which is the whole reason this goes through the sheet rather than
   * writing a layout into the store. The exclusivity lives in that control:
   * `weiter` is a key that says nothing, and a test setting fields directly
   * would never exercise the thing that keeps a board to what a file can hold.
   *
   * The board it builds is the smallest real use of this: a page asking
   * something, and one key of four that is the way on. What the assertions are
   * about is which marks each answer puts on its cell - the play control for a
   * key with something to hear, the corner arrow for one that leads somewhere
   * - because those are what somebody reads the board by.
   */
  await openBoard(page);
  await put(page, 0, "Ich will");

  // Somewhere to lead to, with a name, because the target list is read by it.
  await page.locator("#tabs .tab.add").click();
  const tabs = page.locator("#tabs .tab:not(.add)");
  await expect(tabs).toHaveCount(2);
  await nameSet(page, "Essen");
  await tabs.first().click();

  // Wort & weiter: says itself, then switches page. One press for both.
  await key(page, 0).click();
  const box = keySheet(page);
  await expect(box).toBeVisible();
  await choose(page, "#diyDoes", "ui.diy_does_carry");
  await chooseNamed(page, "#diyGoto", "Essen");
  // Both rows are drawn for this answer, and it is the only one that draws
  // both: it leads somewhere and it has something to say on the way.
  await expect(box.locator("#diyGoto")).toBeVisible();
  await expect(box.locator("#diyKeyText")).toBeVisible();
  await press(box, "ui.done");
  await expect(box).toHaveCount(0);

  const carrying = cells(page).nth(KEY_CELL[0]!);
  await expect(carrying.locator(".cell__play")).toHaveCount(1);
  await expect(carrying.locator(".cell__follow")).toHaveCount(1);
  /* And which page, over the picture. The corner says *that* it leads onward
   * and only its title says where, which on a Sammlung of twelve rounds is the
   * half of the question that was a hover away. */
  await expect(carrying.locator(".cell__eyebrow"))
    .toHaveText(label("ui.diy_leads_to", { name: "Essen" }));

  // The corner follows it, which is what it is for: the strip lands on the
  // page the key names, without the sheet being opened to find out which.
  await carrying.locator(".cell__follow").click();
  await expect(tabs.nth(1)).toHaveClass(/active/);
  await tabs.first().click();

  // weiter: the same navigation with nothing said, so the field it would be
  // said in is not drawn at all - hidden rather than greyed, because the
  // question is not whether somebody may type there.
  await key(page, 1).click();
  await expect(box).toBeVisible();
  await choose(page, "#diyDoes", "ui.diy_does_goto");
  await chooseNamed(page, "#diyGoto", "Essen");
  await expect(box.locator("#diyKeyText")).toBeHidden();
  await press(box, "ui.done");
  await expect(box).toHaveCount(0);

  const leading = cells(page).nth(KEY_CELL[1]!);
  await expect(leading.locator(".cell__follow")).toHaveCount(1);
  await expect(leading.locator(".cell__play")).toHaveCount(0);
  // It leads to the same page and says so the same way. The two answers differ
  // by the play control and by nothing else, which is the reading: one speaks
  // on the way through and one is silent.
  await expect(leading.locator(".cell__eyebrow"))
    .toHaveText(label("ui.diy_leads_to", { name: "Essen" }));

  // And Wort, which is what a key with no answer chosen has always been: the
  // target list goes away with it, and the word comes back.
  await key(page, 1).click();
  await expect(box).toBeVisible();
  await choose(page, "#diyDoes", "ui.diy_does_word");
  await expect(box.locator("#diyGoto")).toBeHidden();
  await expect(box.locator("#diyKeyText")).toBeVisible();
  await press(box, "ui.done");
  await expect(box).toHaveCount(0);
  await expect(cells(page).nth(KEY_CELL[1]!).locator(".cell__follow")).toHaveCount(0);
  // The line over the picture goes with the corner: a key that stays put has
  // nowhere to name.
  await expect(cells(page).nth(KEY_CELL[1]!).locator(".cell__eyebrow"))
    .toHaveCount(0);

  // Key 1 kept its answer across every press above, which is the assertion
  // that it was written rather than merely drawn.
  await page.reload();
  await expect(cells(page)).toHaveCount(6);
  await expectSaid(page, 0, "Ich will");
  await expect(cells(page).nth(KEY_CELL[0]!).locator(".cell__follow")).toHaveCount(1);
});

test("the key under the speaker asks a round's question and stands still",
     async ({ page }) => {
  /* The round of a joining game, built the way somebody builds one.
   *
   * This was the last door that was shut, and it is not a door any more: the
   * fifth key opens the key sheet, so a round's question is written exactly
   * the way an answer is. tests/unit/import_acts.test.ts had to state its
   * boards by hand rather than take them from a fixture, in the sentence "the
   * editor's own writer cannot produce a set key that stays put and that is
   * exactly the board that broke". This is that writer.
   *
   * The board is the round out of Spiegel-und-Ei-device.obz, which runs on the
   * real device: the key under the speaker asks the compound word and does not
   * move, and exactly one of the four answers leads to the next round.
   *
   * ## What used to be a fourth answer
   *
   * There was a **Reihum** on this key alone - go to the next page, for ever,
   * in whatever order the pages sat in - and it was a rule rather than a
   * target. adr/0023 wrote every stored one out as the goto it meant, so the
   * list here is the same three every key has. What is asserted instead is the
   * promise that replaced it: a page nobody has touched keeps a key that says
   * its word and stays put, and opening the sheet and pressing Fertig writes
   * nothing onto it.
   */
  await openBoard(page);

  // Two rounds, so there is somewhere for the winning answer to lead.
  await nameSet(page, "Runde 1");
  await page.locator("#tabs .tab.add").click();
  const tabs = page.locator("#tabs .tab:not(.add)");
  await expect(tabs).toHaveCount(2);
  await nameSet(page, "Runde 2");
  await tabs.first().click();

  await key(page, PAGE_KEY).click();
  const box = keySheet(page);
  await expect(box).toBeVisible();

  /* Wort, which is where a key with no answer chosen stands - the same three
   * answers the other four have, on the same list. It says the round's
   * question and the page stays where it is, so the target list is away. */
  await expect(box.locator("#diyDoes")).toHaveText(label("ui.diy_does_word"));
  await expect(box.locator("#diyGoto")).toBeHidden();
  const says = box.locator("#diyKeyText");
  await expect(says).toBeVisible();

  /* Empty is the page's name, and the name is the placeholder rather than the
   * value: the field offers the fact the editor already has without writing a
   * second copy of it into the Sammlung. This is the one thing the panel still
   * decides - PAGE_KEY - and it is a caption rather than a role. */
  await expect(says).toHaveValue("");
  await expect(says).toHaveAttribute("placeholder", "Runde 1");

  await says.fill("Was wird aus Spiegel und Ei?");
  await press(box, "ui.done");
  await expect(box).toHaveCount(0);
  // Drawn on the panel, and the caption that explained the name goes with it.
  await expect(cells(page).nth(KEY_CELL[PAGE_KEY]!).locator(".cell__word"))
    .toHaveText("Was wird aus Spiegel und Ei?");
  await expect(cells(page).nth(KEY_CELL[PAGE_KEY]!).locator(".cell__eyebrow"))
    .toHaveCount(0);

  // One answer of the four carries the round onward - the same key the game
  // file has, written through the same sheet.
  await put(page, 0, "Spiegelei. Genau!");
  await key(page, 0).click();
  await expect(box).toBeVisible();
  await choose(page, "#diyDoes", "ui.diy_does_carry");
  await chooseNamed(page, "#diyGoto", "Runde 2");
  await press(box, "ui.done");
  await expect(box).toHaveCount(0);
  await expect(cells(page).nth(KEY_CELL[0]!).locator(".cell__follow"))
    .toHaveCount(1);

  /* And it is written, not merely drawn. A reload is the assertion that the
   * question reached the store: it comes back in the field, on the answer that
   * says the key stands still. */
  await page.reload();
  await expect(cells(page)).toHaveCount(6);
  await key(page, PAGE_KEY).click();
  await expect(box).toBeVisible();
  await expect(box.locator("#diyDoes")).toHaveText(label("ui.diy_does_word"));
  await expect(says).toHaveValue("Was wird aus Spiegel und Ei?");

  /* Weiter: pointed at a page rather than at whichever one comes next. It says
   * nothing, so the field it would be said in is away and the list it is
   * pointed with is there. */
  await choose(page, "#diyDoes", "ui.diy_does_goto");
  await expect(says).toBeHidden();
  await expect(box.locator("#diyGoto")).toBeVisible();
  await chooseNamed(page, "#diyGoto", "Runde 2");

  // Wort & weiter draws both, and is the only answer that does.
  await choose(page, "#diyDoes", "ui.diy_does_carry");
  await expect(box.locator("#diyGoto")).toBeVisible();
  // Nothing was cleared on the way through the three answers, so the question
  // typed before somebody changed their mind is still there.
  await expect(says).toHaveValue("Was wird aus Spiegel und Ei?");
  await press(box, "ui.done");
  await expect(box).toHaveCount(0);

  /* The second round's key, which nobody has touched: opened, confirmed with
   * Fertig and reloaded, it still says its word and stays put, and its field
   * is still empty. Anything the sheet wrote onto it - the page's name copied
   * into the field, an act it was never given - would show up here, and would
   * be a Sammlung that exports a file it did not export before. */
  await tabs.nth(1).click();
  await key(page, PAGE_KEY).click();
  await expect(box).toBeVisible();
  await expect(box.locator("#diyDoes")).toHaveText(label("ui.diy_does_word"));
  await expect(says).toHaveValue("");
  await expect(says).toHaveAttribute("placeholder", "Runde 2");
  await press(box, "ui.done");
  await expect(box).toHaveCount(0);

  await page.reload();
  await expect(cells(page)).toHaveCount(6);
  await tabs.nth(1).click();
  await key(page, PAGE_KEY).click();
  await expect(box).toBeVisible();
  await expect(box.locator("#diyDoes")).toHaveText(label("ui.diy_does_word"));
  await expect(says).toHaveValue("");
  // And the page's name is still drawn on the panel behind the sheet, because
  // the key has no word of its own.
  await page.keyboard.press("Escape");
  await expect(cells(page).nth(KEY_CELL[PAGE_KEY]!).locator(".cell__word"))
    .toHaveText("Runde 2");
});

test("the board says which keys carry the page on, and to which page",
     async ({ page }) => {
  /* The other shape a game has, and the one the round test does not cover.
   *
   * Spiegel-und-Ei-device.obz is one of five keys leading on and four staying
   * put; Plauderbuch-device.obz is the inverse - four keys that each say a
   * different thing and all four go to the same next page, and a fifth that
   * asks the question and stands still. Both run on the real device, and the
   * thing being asserted is that somebody looking at the board can tell them
   * apart without opening a single sheet.
   *
   * What the cell answers, and the mark that answers it:
   *
   *   leads onward           the corner arrow, and the page named over it
   *   speaks on the way      the play control beside them
   *   speaks and stays put   the play control alone
   *
   * The name over the picture is the half that used to be a hover. A tablet
   * button is usually *called* the page it opens, so editor-app leaves it at
   * the corner; a talker key says "Rate mal!" and goes to "Tafel 2", and on
   * twelve rounds of those an arrow alone says only that one of them carries
   * on.
   */
  await openBoard(page);
  await nameSet(page, "Tafel 1");
  await page.locator("#tabs .tab.add").click();
  const tabs = page.locator("#tabs .tab:not(.add)");
  await expect(tabs).toHaveCount(2);
  await nameSet(page, "Tafel 2");
  await tabs.first().click();

  const asked = "Ich will dir was sagen.";
  await put(page, PAGE_KEY, asked);
  const onward = [0, 1, 3, 4];
  const words = [
    "Rate mal!",
    "Pass auf!",
    "Danach?",
    "Alles klar!",
  ];
  for (const [n, slot] of onward.entries()) {
    await put(page, slot, words[n]!);
    await key(page, slot).click();
    const box = keySheet(page);
    await expect(box).toBeVisible();
    await choose(page, "#diyDoes", "ui.diy_does_carry");
    await chooseNamed(page, "#diyGoto", "Tafel 2");
    await press(box, "ui.done");
    await expect(box).toHaveCount(0);
  }

  // Four of the five carry the page on, and every one of them names where to.
  for (const slot of onward) {
    const cell = cells(page).nth(KEY_CELL[slot]!);
    await expect(cell.locator(".cell__follow")).toHaveCount(1);
    await expect(cell.locator(".cell__play")).toHaveCount(1);
    await expect(cell.locator(".cell__eyebrow"))
      .toHaveText(label("ui.diy_leads_to", { name: "Tafel 2" }));
  }

  /* And the fifth says its word and stands still, which is the whole of what
   * the board has to show for it: something to hear, and no way out of the
   * page. It has a word of its own, so the panel's caption line is away. */
  const asking = cells(page).nth(KEY_CELL[PAGE_KEY]!);
  await expect(asking.locator(".cell__play")).toHaveCount(1);
  await expect(asking.locator(".cell__follow")).toHaveCount(0);
  await expect(asking.locator(".cell__eyebrow")).toHaveCount(0);
  await expectSaid(page, PAGE_KEY, asked);

  /* The one cell where the two lines want the same seat: the panel the device
   * prints the page's name on, holding a key with no word of its own that
   * leads onward.
   *
   * The caption keeps it. It explains a word that is drawn on the cell and
   * would otherwise read as one somebody typed, and it has nowhere else to go;
   * the target has the corner, which is still there and still names the page
   * to anybody who follows it. A second line would push the picture down on
   * one cell of five and make the board disagree with the device about how a
   * key is laid out.
   */
  await key(page, PAGE_KEY).click();
  const box = keySheet(page);
  await expect(box).toBeVisible();
  await box.locator("#diyKeyText").fill("");
  await choose(page, "#diyDoes", "ui.diy_does_goto");
  await chooseNamed(page, "#diyGoto", "Tafel 2");
  await press(box, "ui.done");
  await expect(box).toHaveCount(0);

  await expect(asking.locator(".cell__follow")).toHaveCount(1);
  await expect(asking.locator(".cell__follow"))
    .toHaveAttribute("aria-label", label("ui.page_follow", { name: "Tafel 2" }));
  /* The name is still drawn, because all three export doors write that label
   * whatever the key does - the firmware prints it on this panel either way,
   * so a cell without it would be a board that is not the one on the table.
   * What the line above it says is which of the two this is: *shows*, not
   * *says*, on a key that only leads onward. Everywhere else on this board a
   * word on a cell is a word the key speaks, and this is the one seat where
   * the two come apart. */
  await expect(asking.locator(".cell__eyebrow"))
    .toHaveText(label("ui.diy_page_name_shows"));
  await expectSaid(page, PAGE_KEY, "Tafel 1");
  // And nothing to audition, which is the same fact by the other mark.
  await expect(asking.locator(".cell__play")).toHaveCount(0);
});

test("a Sammlung of two dozen pages leaves the board on screen", async ({ page }) => {
  /* The regression the cap's move to sixty-four could have shipped.
   *
   * The strip was a plain wrapping row, which was the whole answer while the
   * device held five sets. The collection that started this holds twenty-four,
   * and twenty-four tabs wrapping freely is four rows of chrome standing
   * between the work head and the board - at sixty-four it is ten. So the
   * strip is bounded and scrolls (see `.tabs` in src/styles/ui.css), and what
   * is asserted here is the property that bound is for rather than the number
   * it was set to: every page is still reachable, and the board is still
   * whole and above the fold with the strip as full as this Sammlung makes it.
   *
   * Twenty-four presses rather than sixty-four. It is the number off the real
   * file, it already overflows the strip twice over, and the cap itself is
   * held by tests/unit/collection_cap.test.ts, which does not need a browser.
   */
  await openBoard(page);
  const tabs = page.locator("#tabs .tab:not(.add)");
  for (let made = 1; made < 24; made++) {
    await page.locator("#tabs .tab.add").click();
    await expect(tabs).toHaveCount(made + 1);
  }

  const strip = page.locator("#tabs");
  const box = await strip.evaluate((el) => ({
    shown: el.clientHeight, held: el.scrollHeight,
  }));
  // It overflows - otherwise the rest of this test proves nothing - and what
  // it shows is a small part of what it holds rather than all of it.
  expect(box.held).toBeGreaterThan(box.shown);
  expect(box.shown).toBeLessThan(200);

  /* The board, whole and in the window. `main` scrolls, so a strip that grew
   * without a ceiling would not push the board off the page - it would push it
   * below the fold, which is the same thing to somebody who has just opened
   * their Sammlung and cannot see what is on it. */
  const board = (await page.locator("#device").boundingBox())!;
  const window_ = page.viewportSize()!;
  expect(board.y + board.height).toBeLessThanOrEqual(window_.height);

  /* Every page still reachable. Adding the twenty-fourth scrolled the strip
   * past the first tab, and pressing that tab both opens its page and brings
   * it back into view - which is the property, rather than a scrollTop of
   * zero: the strip carries 2px of padding for the focus ring, so "scrolled
   * home" lands at 2 and an equality against 0 would be asserting the
   * padding. */
  expect(await strip.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await tabs.first().click();
  await expect(tabs.first()).toHaveClass(/active/);
  const home = await strip.evaluate((el) => {
    const first = el.firstElementChild as HTMLElement;
    return { at: el.scrollTop, shown: el.clientHeight,
             top: first.offsetTop, height: first.offsetHeight };
  });
  expect(home.top).toBeGreaterThanOrEqual(home.at);
  expect(home.top + home.height).toBeLessThanOrEqual(home.at + home.shown);

  // And the line under it counts pages rather than places left, which is what
  // it said while five of them was the whole device.
  await expect(page.locator("#slots")).toHaveText(label("ui.sets_count", { used: 24 }));
});
