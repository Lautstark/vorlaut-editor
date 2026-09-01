import { expect, type Locator, type Page } from "@playwright/test";
import { LANGUAGES, TEXTS } from "../src/core/boot_data.js";

/* Driving the five-key board, for the eleven specs that have to open one.
 *
 * It is one module because the board stopped being a place you type into. A
 * key's sentence used to be an <input> in a tile, so every spec that wanted a
 * board with something on it wrote `#device .tile input` and was done; now it
 * is a field in a sheet that a press opens and Fertig closes, and eleven
 * copies of that sequence is eleven places to fix the next time it moves.
 *
 * The same reasoning e2e/obz.ts is here for, and the same shape: helpers only,
 * no tests, so `playwright test` does not pick it up as a spec.
 *
 * What it deliberately does not hide is the assertions. `put()` drives the
 * controls a person drives - it does not write a layout into the store -
 * because the sheet is exactly what these specs are now covering on the way
 * past.
 */

const table = TEXTS as Record<string, Record<string, string>>;

/** A label in whichever language the runner's browser picked, from the same
 *  table the page reads - asserting a literal here would pass on a German
 *  machine and fail in CI, or the other way round. */
export const label = (key: string, params: Record<string, string | number> = {}) =>
  new RegExp(`^(${LANGUAGES.map((l) => {
    // Filled in before the escaping, not after: a value is plain text and
    // wants escaping too, while an unfilled {n} is a brace the pattern has to
    // match literally.
    let text = table[l][key]!;
    for (const name in params) text = text.split(`{${name}}`).join(String(params[name]));
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("|")})$`);

/** The same, unanchored: for the lines that join several labels into one -
 *  a voice's facts are five of them with separators between. Anchoring one of
 *  those against the whole line only ever asserts that the line holds nothing
 *  else, which is not what the caller means by "it says this". */
export const within = (key: string) => new RegExp(
  `(${LANGUAGES.map((l) => table[l][key]!
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);

/** The six cells of the board: the hole where the speaker is, and the five
 *  keys, in the reading order src/editor-diy/editor.ts's CELLS lays them out in.
 *
 *      0 hole     1 key 0    2 key 1
 *      3 key 2    4 key 3    5 key 4
 */
export const cells = (page: Page) => page.locator("#device .cell");

/** The cell index a key is drawn in: the five in reading order, after the hole
 *  where the 40 mm cone is - docs/hardware.md. BoardSet.slots' own order. */
export const KEY_CELL = [1, 2, 3, 4, 5] as const;

/** What a press on a key lands on. The cell is the box around it. */
export const key = (page: Page, slot: number) =>
  cells(page).nth(KEY_CELL[slot]!).locator(".cell__open");

/** Which of the five sits on the panel the device prints the page's name on -
 *  core/types.ts's PAGE_KEY. A key like the other four: it opens the key sheet
 *  and it is only its caption that the panel decides. */
export const PAGE_KEY = 2;

/** The page's own card, which is behind the ... on the tab that is open - and
 *  only there, since every cell opens its own key. */
export const pageMore = (page: Page) => page.locator(".tab.active .tab__more");

/** The one open sheet, named by its heading rather than by its whole text.
 *
 * `hasText` matches against everything inside the element, so an anchored
 * label matched against a <dialog> is matched against its title *and* its body
 * *and* its buttons - which never matches, and reads like the dialog failing
 * to open. The heading is the part that names it. */
export const sheet = (page: Page, key: string) => page.locator("dialog[open]")
  .filter({ has: page.getByRole("heading", { name: label(key) }) });

/** The sheet a press on a speech key opens. */
export const keySheet = (page: Page) => sheet(page, "ui.diy_key_title");
/** The card the ⋯ on the current tab opens. */
export const setCard = (page: Page) => sheet(page, "ui.set_title");

/** An entry in an open dropdown menu, matched by the words on it.
 *
 * `menuitemradio` rather than `button`: these are alternatives with one in
 * force, which is what `checked` on every item buys - see shell/sheet.ts's
 * dropdown().
 *
 * The tick a chosen entry wears is generated content and joins the accessible
 * name, so it is *matched* rather than excluded. Choosing what is already
 * chosen is a no-op in the control, so the entry in force is a perfectly good
 * answer to "click the one that says this" - and excluding it is a race with
 * nothing to end it. e2e/editor_app.spec.ts has the long version of that
 * argument at its own copy of this helper.
 *
 * Anchored, because these labels are not prefix-free: "Wort" is also the
 * beginning of "Wort & weiter", and unanchored the two are one entry.
 */
const menuEntry = (page: Page, words: string) =>
  page.getByRole("menuitemradio",
                 { name: new RegExp(`^(${words})(\\s*\u2713)?$`) });

/** Chooses from one of the sheet's dropdowns, by the text key its answer comes
 *  from. Nothing is pressed where the answer is already the answer. */
export async function choose(page: Page, trigger: string, key: string) {
  const now = (await page.locator(trigger).textContent() || "").trim();
  if (label(key).test(now)) return;
  await page.locator(trigger).click();
  await menuEntry(page, label(key).source.slice(2, -2)).click();
}

/** The same, for a list whose entries are content rather than interface: the
 *  pages of the Sammlung, named by whoever named them. */
export async function chooseNamed(page: Page, trigger: string, name: string) {
  await page.locator(trigger).click();
  await menuEntry(page, name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).click();
}

/** Presses a foot button by its label. */
export const press = (box: Locator, key: string) =>
  box.locator(".foot button", { hasText: label(key) }).click();

/** A board, open and drawn. Six cells, which is the assertion that the editor
 *  came up at all - it was five tiles before the board became the device's own
 *  2x3 with the speaker's hole in it. */
export async function openBoard(page: Page): Promise<void> {
  await page.goto("./");
  await expect(cells(page)).toHaveCount(6);
}

/** The word one key is drawn with.
 *
 * Read off the cell rather than out of a field, because there is no field on
 * the board any more: the word on a cell is what the editor believes, which is
 * the thing worth asserting. An empty key has no word element at all, so the
 * locator resolves to nothing rather than to "".
 */
export const word = (page: Page, slot: number) =>
  cells(page).nth(KEY_CELL[slot]!).locator(".cell__word");

/** What one key says, once it says it.
 *
 * A retrying assertion rather than a read, and that is not a detail: switching
 * Sammlung and reloading both go through IndexedDB, so the board on screen at
 * the moment of a bare `textContent()` is still the previous one about half
 * the time. A one-shot read of it passed locally and failed under load, which
 * is the worst shape a test can have.
 *
 * "" asserts the key is empty, which is the absence of the element rather than
 * an element holding nothing.
 */
export async function expectSaid(page: Page, slot: number, text: string): Promise<void> {
  if (!text) await expect(word(page, slot)).toHaveCount(0);
  else await expect(word(page, slot)).toHaveText(text);
}

/** Puts a sentence on one key, through the sheet a person would use.
 *
 * Nothing is written until Fertig - see the head of src/shell/sheet.ts - so
 * this is also what exercises that, on the way to every board these specs
 * need.
 */
export async function put(page: Page, slot: number, text: string): Promise<void> {
  await key(page, slot).click();
  const box = keySheet(page);
  await expect(box).toBeVisible();
  await box.locator("#diyKeyText").fill(text);
  await press(box, "ui.done");
  await expect(box).toHaveCount(0);
  await expect(cells(page).nth(KEY_CELL[slot]!).locator(".cell__word"))
    .toHaveText(text);
}

/** Names the page on screen, through its card. */
export async function nameSet(page: Page, name: string): Promise<void> {
  await pageMore(page).click();
  const card = setCard(page);
  await expect(card).toBeVisible();
  await card.locator("#diySetName").fill(name);
  await press(card, "ui.done");
  await expect(card).toHaveCount(0);
}

/** The sheet's own picture column, which is where a symbol is chosen now: a
 *  sheet carries its own search rather than opening the picker dialog on top
 *  of itself. */
export const pick = (box: Locator) => box.locator(".pick");
export const query = (box: Locator) => box.locator(".pick input[type=search]");
export const hits = (box: Locator) => box.locator(".pick__hit");
/** What a search says when it has nothing to show: say() writes a bare <p>. */
export const searchNote = (box: Locator) => box.locator(".pick__results p");

/** What the search says about hits it is still showing - the line above the
 *  grid, which is outside the grid because the grid scrolls. */
export const searchNear = (box: Locator) => box.locator(".pick__near");

/** Types a word into the sheet's search and runs it. Enter, because that is
 *  what the field answers to - there is no search button beside it. */
export async function search(box: Locator, word: string): Promise<void> {
  await query(box).fill(word);
  await query(box).press("Enter");
}
