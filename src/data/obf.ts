// layout.json as an Open Board Format document, and back again - in the browser.
//
// A port of the mapping half of obf.py, written field for field against it
// while it was the oracle. The app is a static site now, so this is where
// export and import happen: both are reached from the settings sheet.
//
// obf.py has since been deleted with the rest of the Python half, and
// tests/test_obf_js.py - which drove layouts and foreign documents through
// both implementations and compared the results field for field - went with
// it. What it used to say was written down first: tests/reference/obf.lock.json
// holds every helper, every layout as the document it becomes, every document
// as the layout it becomes, the licence refusals and what a .obz contains
// member by member, and tests/test_obf_frozen.py holds this file to all of it
// without needing Python.
//
// Worth knowing what that does not cover. A .obf is a mapping this project
// invented, so unlike tiles or the layout binary there is no outside opinion
// to fall back on - the lock is obf.py's answer, not a right answer, and it
// only answers for the cases recorded in it. A mistake on some other input is
// a board that somebody else's software reads wrongly or cannot open, and it
// will not show up here: the file writes, the zip opens, the damage is on the
// other side.
//
// What is deliberately not here.
//
// **validate() and the profiles.** They answer "would this document fit on an
// ESP32", and nothing in the page asks: the export button exports and the
// import button imports, exactly as the two routes in app.py do. `obf.py
// check` is a command line tool and stays one. Porting a validator nothing
// calls would be a second copy of a table to keep in step for no reader.
//
// **estimate_bytes(), the graph tools and the two attach_*() steps.** Same
// reason for the first three. attach_images() and attach_sounds() are opt-ins
// that only the command line passes - see exportBoard() in backend/local.js,
// which says so where somebody would look for them.
//
// **The device.** layout.bin stays exactly what layout_format.js writes. This
// replaces the document somebody edits, not the file that gets flashed.
//
// **What a press does, and the wait that is over.** Slot.act arrived after
// this file and did not travel through it for a while: a key that led onward
// was written here as the speaking key it used to be. That was a boundary
// rather than an omission - this door is read by software outside this
// repository, and writing a field the other half could not honour is the shape
// CLAUDE.md's rule about the device format exists to stop. The other half
// arrived in vorlaut-diy-talker's adr/0020 on 2026-08-31, and both fields are
// plain OBF anyway: a key that goes somewhere carries a `load_board`, and
// `ext_lautstark_speak_on_navigate` beside it says whether it speaks on the way
// through - exchange/SPEC.md 7.3, the sibling of the flag a tablet's carrier
// phrase already rides on. So all five keys write and read what they do, and a
// joining game survives a round trip through this file.
//
// data/app_package.ts is the same acts one door along: a talker Sammlung
// opened on a tablet.

import { LIMITS } from "../core/boot_data.js";
import { reason } from "../core/errors.js";
import {

  DEFAULT_LANGUAGE,
  KEYS_PER_SET,
  LANGUAGE_CODES,
  SLEEP_MIN,
  SLEEP_MAX,
  SLEEP_DEFAULT,
} from "../device/layout_facts.js";
import { PAGE_KEY, actOf } from "../core/types.js";
import type { BoardSet, DiyLayout, Slot, SlotAct } from "../core/types.js";

/* The Open Board Format shapes this reads and writes.
 *
 * Partial descriptions on purpose: OBF has more fields than vorlaut sets, and
 * the ones below are the ones this file touches. An index signature is not what
 * is wanted here - the point of writing them down is that `image_id` and
 * `license` are optional fields added after the literal is built, which is the
 * pattern that type-checked as a mistake until they were named.
 */

/** An images[] entry: a picture as a reference rather than as pixels. */
export interface ObfImage {
  id: string;
  symbol: { set: string; filename: string };
  license?: Record<string, unknown>;
}

/** One key on a board. */
export interface ObfButton {
  id: string;
  label: string;
  vocalization?: string;
  image_id?: string;
  load_board?: { id: string; name: string; path: string };
  /** Whether the picture on this key is crossed out - Slot.negated.
   *
   * `ext_vorlaut_`, this file's own namespace, and not the `ext_lautstark_`
   * one: that list belongs to exchange/SPEC.md, is closed at v1 (§4.3), and is
   * read by a viewer that is not this repository. This document is the
   * talker's own round trip, where the same two ends read and write it.
   *
   * The app package needs no field at all - it bakes the cross into the PNG,
   * because §5 has it carry every image as a file anyway. */
  ext_vorlaut_negated?: boolean;
  /** Whether a key that leads onward says its word first - SlotAct.alsoSpeak.
   *
   * `ext_lautstark_`, that list rather than this file's own, and it is the one
   * field here that belongs to it: exchange/SPEC.md 7.3 defines it and the
   * Android viewer reads its sibling `ext_lautstark_append_on_navigate`. So it
   * is not the talker's private business the way the cross above is - it says
   * what one press does, which is the thing every reader of an .obz has an
   * opinion about. Absent rather than false where it is not wanted. */
  ext_lautstark_speak_on_navigate?: boolean;
}

/** What a .obz's manifest names. */
export interface ObzManifest {
  format?: string;
  root?: string;
  paths?: { boards?: Record<string, string>; images?: Record<string, string> };
}


// --- What the spec calls things ---------------------------------------------

export const FORMAT = "open-board-0.1";
export const MANIFEST_NAME = "manifest.json";
export const BOARD_DIR = "boards";
export const IMAGE_DIR = "images";
export const SOUND_DIR = "sounds";

// The symbol set a bare file name in layout.json belongs to. A symbol stays a
// reference across the format rather than travelling as pixels, which is what
// keeps a licensed collection out of a document somebody sends on.
export const OWN_SET = "vorlaut";
export const METACOM_SET = "metacom";

// What the project declares about every pictogram the search loads. The
// over-attribution this carries is known and is obf.py's, not this port's:
// an uploaded photograph gets the same line, because layout.json records
// where a symbol came from nowhere at all.
export const ARASAAC_LICENSE = {
  type: "CC BY-NC-SA 4.0",
  copyright_notice_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  author_name: "Sergio Palao",
  author_url: "https://arasaac.org",
  source_url: "https://arasaac.org",
};

// METACOM is licensed per person and lives outside the project. The licence
// block says so; checkLicensing() is what makes it true.
export const METACOM_LICENSE = {
  type: "Proprietary",
  author_name: "Annette Kitzinger",
  author_url: "https://www.metacom-symbole.de",
  source_url: "https://www.metacom-symbole.de/en/licensing.html",
};

export function boardPath(boardId) {
  return `${BOARD_DIR}/${boardId}.obf`;
}

// --- Two things Python does by itself ----------------------------------------

/** Python's str(x) for a field that should have been a string.
 *
 * A foreign board can put anything in any field, and obf.py answers with
 * `str(value or "")` throughout rather than refusing. This is that, with the
 * one difference that cannot be closed written down: JSON's 1.0 is a float in
 * Python and the integer 1 in JavaScript, so a filename of 1.0 - which is not
 * a filename - reads back one character apart. Every field this touches is a
 * string in every document either implementation writes.
 */
function text(value) {
  if (!value) return "";
  if (value === true) return "True";        // Python spells its booleans so
  return String(value);
}

/** Python's sorted() for strings: by code point.
 *
 * JavaScript's default sort compares UTF-16 code units, which puts anything
 * above the BMP before U+E000..U+FFFF instead of after. Board ids and image
 * ids written here are ASCII and would not notice; a document from somewhere
 * else names its boards whatever it likes, and the order of the boards is the
 * order of the sets.
 */
export function sorted(names) {
  return [...names].sort((one, two) => {
    const a = [...one].map((c) => c.codePointAt(0));
    const b = [...two].map((c) => c.codePointAt(0));
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
  });
}

/** Python's isinstance(value, dict), which an array and null are not. */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// --- Symbol references -------------------------------------------------------
// The one invariant borrowed wholesale: a symbol is a name in a collection and
// never a picture. It has to be structurally impossible to hand somebody a
// METACOM board as pixels, because the licence is per person and a file that
// carries the pixels has already handed them over.

/** A layout.json symbol reference as [set, name]. */
export function splitSymbol(symbol) {
  if (!symbol) return ["", ""];
  const colon = symbol.indexOf(":");
  if (colon < 0) return [OWN_SET, symbol];
  return [symbol.slice(0, colon), symbol.slice(colon + 1)];
}

/** [set, name] back into what layout.json writes. */
export function joinSymbol(symbolSet, filename) {
  if (!filename) return "";
  if (symbolSet === "" || symbolSet === OWN_SET) return filename;
  return `${symbolSet}:${filename}`;
}

/** A stable id for a symbol reference.
 *
 * Derived from the reference and from nothing else, so the same picture in two
 * differently coloured sets is the same id in both - the reasoning tiles.js
 * uses to make it exactly one file on the device.
 *
 * Async where the Python is not: hashing in a browser is crypto.subtle, which
 * is a promise. Everything that calls this is already async for other reasons.
 */
export async function imageId(symbol) {
  const bytes = new TextEncoder().encode(symbol);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `img-${hex.slice(0, 8)}`;
}

/** The images[] entry for one symbol reference. */
export async function imageEntry(symbol) {
  const [symbolSet, filename] = splitSymbol(symbol);
  const entry: ObfImage = {
    id: await imageId(symbol),
    symbol: { set: symbolSet, filename },
  };
  if (symbolSet === METACOM_SET) entry.license = { ...METACOM_LICENSE };
  return entry;
}

/** An images[] entry back to a layout.json reference - "" if it is pixels.
 *
 * A foreign board may carry its picture as a data URL or a file in the zip
 * rather than as a name. There is nowhere to put that, so it comes back empty
 * and the key gets the placeholder.
 */
export function symbolOf(image) {
  const symbol = (image && image.symbol) || {};
  if (!isObject(symbol)) return "";
  return joinSymbol(text(symbol.set), text(symbol.filename));
}

/** Refuses a document that carries a licensed collection as pixels.
 *
 * Every path that writes a .obz goes through here, so that the file cannot
 * come into existence rather than being written with a warning beside it.
 */
export function checkLicensing(document) {
  for (const boardId of sorted(Object.keys(document.boards))) {
    for (const image of document.boards[boardId].images || []) {
      const symbol = (image && image.symbol) || {};
      if ((isObject(symbol) ? symbol.set : "") !== METACOM_SET) continue;
      const carried = ["data", "url", "path"].filter((field) => image[field]);
      if (carried.length) {
        // str(image.get("id") or symbol.get("filename")) - which is "None"
        // when a doctored image has neither, and says so rather than naming
        // nothing at all.
        const named = image.id || symbol.filename;
        // The wording of obf.err.metacom_pixels in texts.py. Said in English
        // here for the same reason layout_format.js says its own refusals in
        // English: the ported modules carry no text table.
        throw new Error(
          `Image ${named === undefined || named === null ? "None" : named} ` +
          `comes from the METACOM collection, so it may be referred to but ` +
          `never stored: ` +
          `${carried.join(", ")} would carry the picture itself. ` +
          `Nothing was written.`);
      }
    }
  }
}

// --- The document ------------------------------------------------------------
//
// { root, boards, files }: the plain object obf.py's Document namedtuple is.
// Boards are kept as the dictionaries they were parsed from rather than as
// objects - that is what makes a foreign document survive the trip, because a
// field this project has never heard of is copied along instead of being
// dropped by a class that has no attribute for it. `files` is everything in
// the zip that is not a board, as Uint8Array, keyed by the path inside it.

/** The boards, root first, then the way the links run.
 *
 * Deterministic, which is what makes a round trip a round trip. Boards that no
 * link reaches come last, sorted by id, so an orphan is preserved rather than
 * lost.
 */
export function order(document) {
  /* Board ids, in the order a device walks them. Annotated because an empty
     literal has no element type to infer. */
  const seen: string[] = [];
  const queue = document.root in document.boards ? [document.root] : [];
  while (queue.length) {
    const current = queue.shift();
    if (seen.includes(current)) continue;
    seen.push(current);
    queue.push(...targetsOf(document, current).filter(
      (t) => t in document.boards));
  }
  seen.push(...sorted(Object.keys(document.boards).filter(
    (b) => !seen.includes(b))));
  return seen;
}

// --- layout.json -> document -------------------------------------------------

/** The whole of a layout as linked boards.
 *
 * Every page becomes a board and every key becomes a button, in the cell the
 * board puts it in. Where the links run is what the keys say: a `goto` becomes
 * a `load_board`, and a Sammlung nobody has pointed anywhere is a document
 * with no links in it at all.
 */
export async function layoutToDocument(
  layout: DiyLayout,
  { imageLicense }: { imageLicense?: Record<string, unknown> | null } = {},
) {
  const license = imageLicense === undefined || imageLicense === null
    ? ARASAAC_LICENSE : imageLicense;
  const entries = layout.sets || [];
  const ids = entries.map((_, index) => `set-${index + 1}`);
  const boards = {};

  /* Where each page sits, so a target stored as an id becomes the board that
   * names it. Built once for the whole layout rather than searched per key -
   * data/device_package.ts's devicePlan() keeps the same map for the same
   * reason one door along. */
  const placeOf = new Map<string, number>();
  for (const [index, one] of entries.entries()) {
    if (one && one.id) placeOf.set(String(one.id), index);
  }

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const boardId = ids[index];
    const buttons: ObfButton[] = [];
    const images: Record<string, unknown> = {};

    /** Adds the images[] entry for a symbol and returns its id. */
    const remember = async (symbol) => {
      if (!symbol) return null;
      const entryFor = await imageEntry(symbol);
      if (entryFor.symbol.set === OWN_SET && license) {
        entryFor.license = { ...license };
      }
      if (!(entryFor.id in images)) images[entryFor.id] = entryFor;
      return entryFor.id;
    };

    for (const at of WRITE_ORDER) {
      const slot = (entry.slots || [])[at];
      // A page shorter than five keys writes the buttons it has. normalizeLayout()
      // is what pads one on the way in, and correcting it here would make the
      // document disagree with the layout it was written from.
      if (!slot) continue;
      const act = actOf(slot);
      /* Where this key leads, if the page it names is still in the Sammlung.
       *
       * A key naming a page that has been deleted since leads nowhere and
       * says its word instead - the same fallback devicePlan() gives, and for
       * the same reason: a key that fell silent AND stayed put would be a key
       * that does nothing at all. */
      const goes = act.kind === "goto" && placeOf.has(act.set);
      const speaks = !goes || act.alsoSpeak === true;
      const button: ObfButton = {
        id: buttonIdOf(boardId, at),
        /* What another editor shows on the key. The key's own word, and on
         * the page-key panel the page's name where the key has no word of its
         * own - see PAGE_KEY, and ourGrid() for the reading back. */
        label: slot.text || (at === PAGE_KEY ? entry.name : ""),
      };
      // What gets spoken, written where the key says anything. The same
      // sentence as the label when it is there, which is what keeps the spoken
      // half right if somebody later shortens the label; absent on a key that
      // only leads onward, because there is nothing for it to say.
      if (speaks) button.vocalization = slot.text;
      const picture = await remember(slot.symbol);
      if (picture) button.image_id = picture;
      // Written only when it is true, which is what keeps every board that has
      // no crossed-out key byte for byte the document it was before this
      // existed - tests/reference/obf.lock.json included.
      if (slot.negated) button.ext_vorlaut_negated = true;
      if (goes && act.kind === "goto") {
        const to = placeOf.get(act.set)!;
        button.load_board = {
          id: ids[to],
          name: entries[to].name,
          path: boardPath(ids[to]),
        };
        // 7.3's modifier, absent rather than false where it is not wanted.
        if (act.alsoSpeak) button.ext_lautstark_speak_on_navigate = true;
      }
      buttons.push(button);
    }

    boards[boardId] = {
      format: FORMAT,
      id: boardId,
      // The board's language, which on this device reaches only the four menu
      // labels the firmware draws itself. On a phone it is also what picks the
      // voice.
      locale: "language" in layout ? layout.language : DEFAULT_LANGUAGE,
      name: entry.name,
      grid: grid(boardId),
      buttons,
      images: sorted(Object.keys(images)).map((key) => images[key]),
      sounds: [],
      // No ext_vorlaut_color, and no border_color on the buttons above. A set
      // had a colour, OBF had nowhere to put one that belongs to a board, and
      // those two fields were the workaround - the hex to survive the round
      // trip and the CSS beside it so a foreign renderer had something to
      // draw. The set has no colour now, on the device or anywhere else.
      //
      // A foreign document's own border_color is untouched by this: boards
      // arrive as the dictionaries they were parsed from, so a field this
      // project never wrote is copied along rather than dropped.
    };
  }

  const root = ids.length ? ids[0] : "";
  const document = { root, boards, files: {} };
  if (root) {
    // Document-wide settings live on the root board rather than in the
    // manifest: a manifest is an index of a zip and gets rebuilt by any tool
    // that touches it, whereas a board is the document. It also means a single
    // .obf exported on its own still knows how long to stay awake and which
    // voice to speak in.
    boards[root].ext_vorlaut_sleep_timeout_seconds = layout.sleep_timeout_seconds;
    boards[root].ext_vorlaut_voice = "voice" in layout ? layout.voice : "";
  }
  return document;
}

/** What each of the five keys is called on a board this file writes.
 *
 * BoardSet.slots order, which is reading order across the board. The names are
 * the ones already in every .obz this project has ever written and they are
 * kept for exactly that reason: the fifth is `-set` because that is what it
 * has always been called, not because it is a different kind of key.
 */
const KEY_IDS = ["key-1", "key-2", "set", "key-3", "key-4"] as const;

/** One key's button id. */
const buttonIdOf = (boardId: string, at: number): string =>
  `${boardId}-${KEY_IDS[at]}`;

/** The order buttons[] holds the five in.
 *
 * The four speech keys and then the page key, which is where they were before
 * the five became one array and is what keeps a document this file writes
 * byte for byte the one it wrote - tests/reference/obf.lock.json compares the
 * array. Reading order is grid.order's job below and this is not it. */
const WRITE_ORDER = [0, 1, 3, 4, 2];

/** The five keys where they really sit.
 *
 * Two rows of three, and the top left cell is empty because that is where the
 * speaker is - docs/hardware.md.
 *
 *     .        key 1    key 2
 *     set      key 3    key 4
 *
 * A grid with a hole in it is what grid.order's nulls are for, and it beats a
 * tidy 1x5 that no renderer could turn back into the thing on the table.
 *
 * **This is how a board is read back, and it is the whole of how.** The
 * importer used to find the set key by its `load_board` and the speech keys by
 * not having one, which held for exactly as long as a speech key could not
 * lead anywhere; a joining game - where the key asking the round's question
 * stays put and one of the four answers carries the link - was read back
 * inside out by it, with the question in an answer's panel and the winning
 * answer gone. There is nothing left to guess: the five keys are the cells in
 * this order, and what each one does it says for itself.
 */
export function grid(boardId) {
  const at = (index: number) => buttonIdOf(boardId, index);
  return {
    rows: 2,
    columns: 3,
    order: [
      [null, at(0), at(1)],
      [at(2), at(3), at(4)],
    ],
  };
}

/** Whether this board is one this file wrote, by the shape of its grid.
 *
 * Two rows, three columns and a null in the corner where the speaker is, which
 * is grid() above and deviceGrid() in data/device_package.ts and nothing else.
 *
 * Asked for one thing only, and it is worth saying what it is *not* asked for
 * any more: which button is the page key. That is the cell now, on every board
 * alike. What is left is a caption - a key on the page-key panel with no word
 * of its own is written out carrying the page's name, because that is what the
 * firmware prints there, and only a board written under that convention may
 * have the name read back off it as nothing. On a phone's board of sixty
 * buttons a label that happens to match the board's name is a word somebody
 * typed, and it stays one.
 */
export function ourGrid(board) {
  const grid = (board || {}).grid;
  if (!isObject(grid) || grid.rows !== 2 || grid.columns !== 3) return false;
  const cells = grid.order;
  if (!Array.isArray(cells) || cells.length !== 2) return false;
  const [top, bottom] = cells;
  if (!Array.isArray(top) || !Array.isArray(bottom)) return false;
  // The hole, and it has to be a hole: a board with something in that corner
  // is not the one this project draws, whatever else about it lines up.
  return (top[0] ?? null) === null && !!text(bottom[0]);
}

// --- document -> layout.json -------------------------------------------------

/** The button ids in reading order, then anything the grid left out.
 *
 * Buttons not named in the grid are appended rather than dropped: OBF allows a
 * board to carry more buttons than the grid shows, and losing one silently on
 * import is how a sentence disappears without an error.
 */
export function gridOrder(board) {
  const ordered: string[] = [];
  const cells = (board.grid || {}).order || [];
  for (const row of cells) {
    for (const cell of row || []) {
      if (cell) ordered.push(text(cell));
    }
  }
  for (const button of board.buttons || []) {
    const buttonId = text(button.id);
    if (buttonId && !ordered.includes(buttonId)) ordered.push(buttonId);
  }
  return ordered;
}

/** The five keys of a board, in the cells the board puts them in.
 *
 * `undefined` where a cell is empty, which is a hole and has to stay one: a
 * page whose second key was never filled in writes four buttons and a grid
 * with a null in it, and reading that back by shuffling the buttons up would
 * move every key after the gap onto the wrong panel. It is the same failure
 * the load_board rule used to make, one cell along.
 *
 * On a board this file did not write there is no such table, so the buttons
 * come back in their own reading order and fill the keys from the first - and
 * a board with more of them than there are keys is refused by the caller
 * rather than half-read.
 */
export function keysInCells(board) {
  const held = buttonsInOrder(board);
  if (!ourGrid(board)) return held;
  const cells = board.grid.order;
  const named = [cells[0]![1], cells[0]![2],
                 cells[1]![0], cells[1]![1], cells[1]![2]].map((one) => text(one));
  const byId = {};
  for (const button of board.buttons || []) byId[text(button.id)] = button;
  const placed = named.map((id) => (id && id in byId ? byId[id] : undefined));
  // Buttons the grid leaves out are appended rather than dropped, which is
  // gridOrder()'s own rule and for its own reason: OBF lets a board carry more
  // buttons than the grid shows, and losing one silently on import is how a
  // sentence disappears without an error.
  return [...placed, ...held.filter((one) => !named.includes(text(one.id)))];
}

export function buttonsInOrder(board) {
  const byId = {};
  for (const button of board.buttons || []) byId[text(button.id)] = button;
  return gridOrder(board).filter((key) => key in byId).map((key) => byId[key]);
}

export function imagesById(board) {
  const byId = {};
  for (const image of board.images || []) byId[text(image.id)] = image;
  return byId;
}

/** Which boards this one links to, in button order. */
function targetsOf(document, boardId) {
  const board = document.boards[boardId] || {};
  const found: string[] = [];
  for (const button of buttonsInOrder(board)) {
    const target = linkTarget(document, button);
    if (target) found.push(target);
  }
  return found;
}

/** The board id a load_board points at, or "" if it points nowhere here.
 *
 * Three ways to say it, tried in that order: the id, the path inside the zip,
 * and the name. The id is what this project writes; the path is what a
 * document whose ids are not its file names uses; the name is the last resort
 * and matches at most one board, because two boards with the same name make it
 * meaningless.
 */
export function linkTarget(document, button) {
  const link = button.load_board;
  if (!isObject(link)) return "";
  const wanted = text(link.id);
  if (wanted in document.boards) return wanted;
  const path = text(link.path);
  if (path) {
    for (const boardId of Object.keys(document.boards)) {
      if (boardPath(boardId) === path) return boardId;
    }
  }
  const name = text(link.name);
  if (name) {
    const matching = Object.keys(document.boards).filter(
      (b) => document.boards[b].name === name);
    if (matching.length === 1) return matching[0];
  }
  return "";
}

/** The boards back into the file the build reads.
 *
 * Lossy in one direction only, and knowingly: everything OBF can hold that
 * this device cannot do - a third row of keys, a button with an action, a
 * picture carried as pixels - has no field in layout.json. What survives is
 * what the device can show. This stops only where carrying on would be a lie,
 * which is a board with more speech keys than there are keys.
 */
export function documentToLayout(document) {
  const sets: BoardSet[] = [];
  const rootBoard = document.boards[document.root] || {};
  const ids = order(document);
  /* Which boards a key names, so that only those pages are given an id.
   *
   * BoardSet.id is minted when something first points at a page and not
   * before, and an import is no reason to break that rule: a document where
   * nobody led anywhere comes back with the ids it had, which is none. The
   * board's own id is what a page that IS pointed at gets - unique within the
   * document by construction, since these are the keys of an object, and
   * stable if the same Sammlung goes back out and comes in again. */
  const pointedAt = new Set<string>();

  for (const boardId of ids) {
    const board = document.boards[boardId];
    const images = imagesById(board);
    const name = text(board.name) || boardId;
    /* Whether this board was written under this file's own caption
     * convention. The only thing it decides - see ourGrid(). */
    const ours = ourGrid(board);
    const slots: Slot[] = [];

    /* The buttons as the grid puts them, which is the whole of the mapping.
     *
     * On a board this file wrote that is the five cells in BoardSet.slots
     * order, page key included, by construction: grid() and KEY_IDS are one
     * table. On anybody else's it is their own reading order, and a board with
     * more buttons than there are keys is refused below rather than half-read. */
    for (const [at, button] of keysInCells(board).entries()) {
      if (!button) {
        // A cell with nothing in it. Written out as the empty key it is rather
        // than skipped, so that every key after it stays on its own panel.
        slots.push({ text: "", symbol: "" });
        continue;
      }
      const symbol = symbolOf(images[text(button.image_id)] || {});
      /* What one press does, out of the two fields 7.3 puts it in.
       *
       * On every board alike now. It used to be read on this file's own boards
       * only, because a foreign board's links were a page tree this device had
       * no way to show; a talker holds sixty-four pages and any key may lead to
       * any of them, so a link into this document is a link this device can
       * follow. A link out of it is not - linkTarget() answers "" for one, and
       * a key that leads nowhere says its word, which is the same answer both
       * export doors give to the mirror of the gap. */
      const target = linkTarget(document, button);
      if (target) pointedAt.add(target);
      const act: SlotAct | null = !target ? null
        : button.ext_lautstark_speak_on_navigate === true
          ? { kind: "goto", set: target, alsoSpeak: true }
          : { kind: "goto", set: target };
      /* What the key says. The vocalization is what gets spoken and therefore
       * what a key's text is; the label stands in when there is none, which is
       * the common case in boards written elsewhere.
       *
       * And the one place the page-key panel is different, on this file's own
       * boards: a key there with no word of its own was written out carrying
       * the page's name, because that is what the firmware prints on it. Read
       * back as the nothing it was, or a round trip would quietly type the
       * name onto the key - and renaming the page afterwards would leave the
       * copy behind, still saying what the page used to be called.
       *
       * Asked of the word rather than of which field it arrived in, because
       * the device door writes it into both: devicePlan() resolves that
       * fallback before the writer sees it, so a page key that speaks carries
       * the name as its vocalization too. What comes back is a key saying the
       * page's name either way, since the same fallback runs on the way out
       * again - so the reading that keeps the field empty is the one that
       * leaves a Sammlung exactly as it was found. */
      const word = text(button.vocalization || button.label);
      const captioned = ours && at === PAGE_KEY && word === name;
      slots.push({
        text: captioned ? "" : word,
        symbol,
        // Absent for the ordinary key rather than false, so a slot read back
        // out of a document is the shape a slot written by the editor is. A
        // board from other software has no such field and is not negated.
        ...(button.ext_vorlaut_negated === true ? { negated: true } : {}),
        // The same rule one field along: absent is what `speak` means, so a
        // key that only says its word is written the way it always was.
        ...(act ? { act } : {}),
      });
    }

    if (slots.length > KEYS_PER_SET) {
      // build.err.too_many_slots, in the words texts.py gives it.
      throw new Error(
        `Set ${text(board.name) || boardId} has ${slots.length} slots, ` +
        `exactly ${KEYS_PER_SET} are allowed.`);
    }

    sets.push({ name, slots });
  }

  // Second pass, because a key on the first board may name the last: which
  // sets are pointed at is known only once every board has been read. See
  // pointedAt above.
  for (const [at, boardId] of ids.entries()) {
    if (pointedAt.has(boardId)) sets[at].id = boardId;
  }

  const raw: DiyLayout = {
    sets,
    language: localeToLanguage(rootBoard.locale),
    voice: text(rootBoard.ext_vorlaut_voice),
  };
  const timeout = rootBoard.ext_vorlaut_sleep_timeout_seconds;
  if (timeout !== undefined && timeout !== null) {
    raw.sleep_timeout_seconds = timeout;
  }
  return normalizeLayout(raw);
}

/** A BCP-47 locale down to the two codes this project has.
 *
 * "de-DE" and "de" are the same answer, and anything else falls back the way
 * normalizeLayout() already falls back: an unknown language costs the four
 * menu labels, not the content, and that is not worth stopping an import over.
 */
export function localeToLanguage(locale) {
  const code = text(locale).trim().toLowerCase().replace(/_/g, "-")
    .split("-")[0];
  return Object.hasOwn(LANGUAGE_CODES, code) ? code : DEFAULT_LANGUAGE;
}


// --- The complete shape ------------------------------------------------------
//
// normalizeLayout() is layout.py's, not obf.py's, and it is here because
// document_to_layout() ends in it: a board that came from somewhere else has
// no timeout it agrees with and however many slots its author felt like, and
// this is what turns that into the shape everything downstream is allowed to
// stop checking.
//
// It lives in this module rather than in a layout.js that does not exist yet.
// Whoever writes that module takes this with them.
//
// The promise, two fields shorter than it was: every page has a name and
// exactly KEYS_PER_SET keys, and every key has a text and a symbol, whatever
// the document happened to be missing. A colour used to be in that list, and
// the palette was imported here to supply one; it is gone from the talker
// entirely. A `symbol` and a `key` beside the slots were in it too, and they
// are what the fifth key was before the five became one array - data/upgrade.ts
// is where a Sammlung that still says it that way is brought forward, once.

// What layout.py says, read where the page already reads it: the cap comes out
// of boot_data.js, which tools/bootdata.py writes from layout.py itself. One
// table rather than a second copy to keep level. The palette was read from
// there too, for the colour a set with none was given; both are gone.
//
// The cap is sixty-four, and it is the only one: a Sammlung is what goes onto
// the device, so how many sets it may hold and how many the device has room
// for stopped being two questions. A document with more boards than that is
// refused rather than imported and half-shown.
//
// It was twenty-five and a separate five, then five, and it is the device's
// MAX_SETS each time - see the note on LIMITS for where the sixty-four comes
// from and for what does not check it. Nothing here is written for a
// particular size of cap; what the number changes is which documents get
// through, and a real Sammlung of twenty-four pages is now one of them.
export const MAX_SETS = LIMITS.maxSets;
// layout.py's DEFAULT_SLEEP_TIMEOUT. It used to be the one number in neither
// table, written 600 here and 600 again in vorlaut.ino's idle check, agreeing
// by coincidence - two files that had each arrived at ten minutes on their own.
// It is SLEEP_DEFAULT now, beside the range it belongs to, and the device says
// the same number back through layoutIdleSeconds().
export const DEFAULT_SLEEP_TIMEOUT = SLEEP_DEFAULT;

/** Python's int(value), which is not Number(value).
 *
 * The timeout arrives from ext_vorlaut_sleep_timeout_seconds, which a foreign
 * document fills with whatever it likes, and normalize_layout() answers a
 * TypeError or a ValueError with the default. Where the two languages differ
 * is what counts as a number: Python truncates a float towards zero, reads a
 * string of digits - underscores between them included - and refuses "1e3",
 * "0x10" and "600.5", all of which Number() would take.
 *
 * Not reproduced: Python also accepts digits from other scripts, which is a
 * sentence rather than a timeout wherever it turns up.
 */
function pyInt(value, fallback) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : fallback;
  }
  if (typeof value === "string") {
    const digits = value.trim();
    if (!/^[+-]?[0-9](_?[0-9])*$/.test(digits)) return fallback;
    return Number(digits.replace(/_/g, ""));
  }
  return fallback;
}

/** A stored act, if it is one this device can hold, and null otherwise.
 *
 * The shape rather than the target: whether the set a `goto` names is still in
 * the Sammlung is a question this function has no business answering, because
 * the answer changes when somebody deletes a set and both export doors already
 * give the same one - a key whose target is gone says its word. What is
 * checked is that the thing is an act at all, since this is the gate a foreign
 * file comes through and `act: 7` must not reach the key sheet.
 *
 * `speak` comes back as itself rather than as null so that the caller can tell
 * a stored `{kind: "speak"}` from a field that was not there. Both mean the
 * same thing on a slot - absent is what `speak` means - and the caller drops
 * it, which is what keeps a key nobody has given a second job to written the
 * way it always was.
 */
function actShape(value): SlotAct | null {
  if (!isObject(value)) return null;
  if (value.kind === "speak") return { kind: "speak" };
  if (value.kind !== "goto") return null;
  const set = text(value.set).trim();
  if (!set) return null;
  // Absent rather than false, like `negated` and for the same reason: the act
  // read out of a file has to be the shape the key sheet writes, or the two
  // compare unequal while meaning the same thing.
  return value.alsoSpeak === true
    ? { kind: "goto", set, alsoSpeak: true } : { kind: "goto", set };
}

/** layout.py's normalize_layout(): the file, brought into a complete shape. */
export function normalizeLayout(raw) {
  // The same [10, 86400] it has always clamped to, taken from the range
  // layout_format.ts states rather than spelled out again here. This is the
  // gate that keeps every builder in this repository inside the range the
  // device honours exactly - device/fixtures/sleep.expected.json states that
  // relation, and it is the same shape as names.expected.json's: what a
  // builder emits has to be inside what the device will take.
  const timeout = Math.max(
    SLEEP_MIN, Math.min(pyInt("sleep_timeout_seconds" in raw
      ? raw.sleep_timeout_seconds : DEFAULT_SLEEP_TIMEOUT,
      DEFAULT_SLEEP_TIMEOUT), SLEEP_MAX));

  let language = text(raw.language || DEFAULT_LANGUAGE).trim().toLowerCase();
  if (!Object.hasOwn(LANGUAGE_CODES, language)) {
    // Not an error: an unknown language costs the menu labels, not the
    // content. The device would fall back to English by itself.
    language = DEFAULT_LANGUAGE;
  }

  // Which voice speaks. Only the shape is checked here, not whether this
  // browser has that voice: a model on the other computer must not quietly
  // overwrite a choice that was made deliberately.
  let voice = text(raw.voice).trim();
  if (!voice.startsWith("piper:") && !voice.startsWith("azure:")) voice = "";

  const sets = raw.sets || [];
  if (!Array.isArray(sets)) throw new Error(`"sets" has to be a list.`);
  if (sets.length > MAX_SETS) {
    throw new Error(`At most ${MAX_SETS} sets, found: ${sets.length}.`);
  }

  const cleanSets = sets.map((given, index) => {
    const entry = isObject(given) ? given : {};
    let slots = entry.slots || [];
    if (!Array.isArray(slots)) slots = [];
    // Exactly five keys: pad the missing ones, surplus ones are an error.
    if (slots.length > KEYS_PER_SET) {
      throw new Error(`Set ${index + 1} has ${slots.length} slots, exactly ` +
                      `${KEYS_PER_SET} are allowed.`);
    }
    slots = [...slots];
    while (slots.length < KEYS_PER_SET) slots.push({ text: "", symbol: "" });
    return {
      // Carried where there is one, and never invented: BoardSet.id is minted
      // by whatever first points at the set, so a set nobody leads to has none
      // and a normalize that gave it one would rewrite every board in the
      // store to say something none of them had been asked.
      ...(text(entry.id) ? { id: text(entry.id) } : {}),
      name: text(entry.name || `Set ${index + 1}`).trim(),
      slots: slots.map((slot) => {
        const one = isObject(slot) ? slot : {};
        const act = actShape(one.act);
        return {
          text: text(one.text).trim(), symbol: text(one.symbol).trim(),
          // Carried, and only when it is true. Rebuilding a slot field by
          // field is what makes this the shape everything downstream may stop
          // checking, and it is also how a field added later gets quietly
          // dropped on every import - which for this one would take the cross
          // off a key that says "kein Brot" and leave it saying "Brot".
          ...(one.negated === true ? { negated: true } : {}),
          // The warning that comment ends on, collected on. Slot.act is the
          // field added later, and dropping it here took the second job off
          // every key of every imported game and left it speaking - a Sammlung
          // that reads as a Sammlung and is not the one in the file, which is
          // the failure this repository calls the worse sort. Absent stays
          // absent, because on a slot absent is what `speak` means.
          ...(act && act.kind === "goto" ? { act } : {}),
        };
      }),
    };
  });

  return { sleep_timeout_seconds: timeout, language, voice, sets: cleanSets };
}

// --- The container -----------------------------------------------------------
//
// A .obf is one board as JSON; a .obz is a zip of several with a manifest
// naming the root, and since vorlaut writes one board per set, everything it
// exports is a .obz. Neither the browser nor node has a zip in it, and this
// project has no bundler, no node_modules and no lockfile - so the sixty lines
// below are the container, written out, and the compression itself is
// CompressionStream, which both of them do have.
//
// What is not attempted is byte-identical zips. Python's zlib and the
// browser's deflate are two compressors and agree about the format, not about
// the output, so the thing that has to be identical is what comes out of the
// members: the same names in the same order, the same bytes inside each, the
// same fixed timestamp. tests/test_obf_js.py unpacks both with Python's own
// zipfile and compares member by member.

// Zip entries carry a fixed timestamp, so the same document always produces
// the same bytes. Otherwise "did anything actually change" is unanswerable
// without unpacking both files. obf.py's ZIP_DATE, as the two 16-bit fields
// the format actually stores: 1980-01-01 00:00:00.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
// 0o644 << 16, and the creating system as unix - what zipfile.ZipInfo writes
// on the machine obf.py runs on.
const EXTERNAL_ATTR = 0o644 << 16;
const MADE_BY = (3 << 8) | 20;
const NEEDED = 20;
const DEFLATED = 8;
const STORED = 0;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Everything a compression stream gives back, as one array of bytes.
 *
 * The write is deliberately not awaited before the reading starts: a stream
 * holds a chunk until somebody takes it, so awaiting both in order is how a
 * large member would sit there forever.
 */
async function through(bytes, stream) {
  const writer = stream.writable.getWriter();
  const written = writer.write(bytes).then(() => writer.close());
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.length;
  }
  await written;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const deflate = (bytes) => through(bytes, new CompressionStream("deflate-raw"));
const inflate = (bytes) => through(bytes, new DecompressionStream("deflate-raw"));

/** What Path(name).stem gives: the file name without its directory or its
 * last suffix. layout_format.js has the same four lines and does not export
 * them; a shared one belongs in neither of these two modules. */
function stemOf(name) {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || /^\.+$/.test(base)) return base;
  return base.slice(0, dot);
}

/** The bytes obf.py's _json_bytes() writes: sorted keys, indented by two,
 * not escaped away from UTF-8, and a newline at the end.
 *
 * Sorted so that the same document is the same file - a diff of an export
 * should be about what changed in the board and not about what order a
 * dictionary happened to be built in.
 */
export function jsonBytes(data) {
  return new TextEncoder().encode(
    JSON.stringify(sortDeep(data), null, 2) + "\n");
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!isObject(value)) return value;
  const out = {};
  for (const key of sorted(Object.keys(value))) out[key] = sortDeep(value[key]);
  return out;
}

/** The manifest the spec asks for, and nothing beyond it.
 *
 * Deliberately thin. Everything about the document that is vorlaut's own sits
 * on the root board instead - a manifest is an index of a zip, and an index is
 * the thing a tool rewrites without thinking about what it was carrying.
 */
export function manifestOf(document) {
  const paths: Record<string, string> = {};
  for (const boardId of order(document)) paths[boardId] = boardPath(boardId);
  const manifest = { format: FORMAT, root: document.root
    ? boardPath(document.root) : "", paths: { boards: paths } };
  for (const [field, prefix] of [["images", IMAGE_DIR], ["sounds", SOUND_DIR]]) {
    const found = {};
    for (const name of sorted(Object.keys(document.files || {}))) {
      if (name.startsWith(prefix + "/")) found[name] = name;
    }
    if (Object.keys(found).length) manifest.paths[field] = found;
  }
  return manifest;
}

/** Writes the document out as the bytes of a .obz.
 *
 * checkLicensing() first, always, whatever the caller thinks it is doing.
 * That is the only reason this function exists rather than callers reaching
 * for a zip writer: there has to be exactly one door, so that the invariant
 * can stand next to it.
 */
export async function writeObz(document) {
  checkLicensing(document);
  const members = [{ name: MANIFEST_NAME, data: jsonBytes(manifestOf(document)) }];
  for (const boardId of order(document)) {
    members.push({ name: boardPath(boardId),
                   data: jsonBytes(document.boards[boardId]) });
  }
  for (const name of sorted(Object.keys(document.files || {}))) {
    members.push({ name, data: new Uint8Array(document.files[name]) });
  }

  const encoder = new TextEncoder();
  const pieces: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const member of members) {
    const name = encoder.encode(member.name);
    const packed = await deflate(member.data);
    const crc = crc32(member.data);

    const local = new Uint8Array(30 + name.length);
    const head = new DataView(local.buffer);
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, NEEDED, true);
    head.setUint16(6, 0, true);                  // no flags, no data descriptor
    head.setUint16(8, DEFLATED, true);
    head.setUint16(10, DOS_TIME, true);
    head.setUint16(12, DOS_DATE, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, packed.length, true);
    head.setUint32(22, member.data.length, true);
    head.setUint16(26, name.length, true);
    head.setUint16(28, 0, true);                 // no extra field
    local.set(name, 30);
    pieces.push(local, packed);

    const entry = new Uint8Array(46 + name.length);
    const view = new DataView(entry.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, MADE_BY, true);
    view.setUint16(6, NEEDED, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, DEFLATED, true);
    view.setUint16(12, DOS_TIME, true);
    view.setUint16(14, DOS_DATE, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, packed.length, true);
    view.setUint32(24, member.data.length, true);
    view.setUint16(28, name.length, true);
    view.setUint32(38, EXTERNAL_ATTR, true);
    view.setUint32(42, offset, true);
    entry.set(name, 46);
    central.push(entry);
    offset += local.length + packed.length;
  }

  const directorySize = central.reduce((total, one) => total + one.length, 0);
  const end = new Uint8Array(22);
  const tail = new DataView(end.buffer);
  tail.setUint32(0, 0x06054b50, true);
  tail.setUint16(8, members.length, true);
  tail.setUint16(10, members.length, true);
  tail.setUint32(12, directorySize, true);
  tail.setUint32(16, offset, true);
  return concat([...pieces, ...central, end]);
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Every member of a zip, by name, already decompressed.
 *
 * Read from the central directory rather than by walking the local headers:
 * the directory is where the sizes are certain, since a local header is
 * allowed to leave them for a data descriptor after the data.
 */
async function unzip(bytes, name) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let at = bytes.length - 22; at >= 0; at--) {
    if (view.getUint32(at, true) === 0x06054b50) { end = at; break; }
  }
  if (end < 0) throw notAZip(name, "no end of central directory");

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const members = new Map();
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) {
      throw notAZip(name, `damaged central directory at ${at}`);
    }
    const method = view.getUint16(at + 10, true);
    const packedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const start = view.getUint32(at + 42, true);
    const member = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    if (view.getUint32(start, true) !== 0x04034b50) {
      throw notAZip(name, `${member} is not where the directory says`);
    }
    const from = start + 30 + view.getUint16(start + 26, true)
      + view.getUint16(start + 28, true);
    const packed = bytes.subarray(from, from + packedSize);
    if (method === DEFLATED) members.set(member, await inflate(packed));
    else if (method === STORED) members.set(member, packed);
    else throw notAZip(name, `${member} is compressed with method ${method}`);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return members;
}

function notAZip(name, reason) {
  // obf.err.not_a_zip, in the words texts.py gives it.
  return new Error(`${name} is not a readable .obz: ${reason}`);
}

function readJson(members, member, name) {
  try {
    return JSON.parse(new TextDecoder().decode(members.get(member)));
  } catch (error) {
    // build.err.bad_json, named the way obf.py names a member inside a zip.
    throw new Error(`${name}:${member} is not valid JSON: ${reason(error)}`);
  }
}

/** Reads a .obz back into a document.
 *
 * Tolerant about where the boards are: the manifest is believed first, and if
 * it names nothing usable every .obf in the zip is taken instead. Both happen
 * in the wild - a manifest written by hand tends to be the half of the file
 * that is wrong, and the boards are still all there.
 */
export async function readObz(bytes, name = "This file") {
  const members = await unzip(bytes, name);
  const names = [...members.keys()];
  let manifest: ObzManifest = {};
  if (members.has(MANIFEST_NAME)) {
    manifest = readJson(members, MANIFEST_NAME, name);
    if (!isObject(manifest)) manifest = {};
  }

  /* `?? {}` so this is a map from here on rather than a maybe-map: the
     isObject() below still guards a manifest whose `boards` is not an object
     at all, which a hand-edited .obz can carry and the type cannot rule out. */
  let wanted: Record<string, string> = ((manifest.paths || {}).boards) ?? {};
  if (!isObject(wanted) || !Object.keys(wanted).length) {
    wanted = {};
    for (const member of sorted(names)) {
      if (member.endsWith(".obf")) wanted[stemOf(member)] = member;
    }
  }

  const boards: Record<string, unknown> = {};
  // The order the boards went in, kept beside them: an object with a board
  // called "12" in it does not iterate in insertion order, and the first board
  // is what the root falls back to.
  const inserted: string[] = [];
  const byMember = new Map();
  for (const key of sorted(Object.keys(wanted))) {
    const member = wanted[key];
    if (!members.has(member)) continue;
    let board = readJson(members, member, name);
    if (!isObject(board)) board = {};
    const boardId = text(board.id) || key;
    if (!(boardId in boards)) inserted.push(boardId);
    boards[boardId] = board;
    byMember.set(member, boardId);
  }

  const files = {};
  for (const member of sorted(names)) {
    if (member === MANIFEST_NAME || member.endsWith(".obf")
        || member.endsWith("/")) continue;
    files[member] = members.get(member);
  }

  // A manifest that names a board nobody packed: the document is still
  // readable and a root still has to be picked, so it is the first one in the
  // manifest's own order - which is the order it was written in.
  const root = byMember.get(text(manifest.root)) || inserted[0] || "";
  if (!inserted.length) {
    // obf.err.no_boards.
    throw new Error(`${name} has no board in it.`);
  }
  return { root, boards, files };
}

/** A single .obf - one board as JSON - as a document of one.
 *
 * The one place this does more than obf.py, and it is the page that asks for
 * it: ui.html's file input accepts `.obf`, and read_obz() only reads zips, so
 * over the server that promise ends in "is not a readable .obz". A board on
 * its own is the format's other half and is a document with one board in it.
 */
export function readObf(bytes, name = "This file") {
  let board;
  try {
    board = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw notAZip(name, reason(error));
  }
  if (!isObject(board)) throw new Error(`${name} has no board in it.`);
  const boardId = text(board.id) || stemOf(name) || "board";
  return { root: boardId, boards: { [boardId]: board }, files: {} };
}

// --- The two ends ------------------------------------------------------------

/** A layout out as the bytes of a .obz. */
export async function exportObz(layout) {
  return await writeObz(await layoutToDocument(normalizeLayout(layout)));
}

/** A .obf or a .obz in, as a layout. Does not save it: reading somebody
 * else's document and seeing what it would become is the common case, and it
 * should not cost the file you already had. */
export async function importObz(bytes, name = "This file") {
  const data = new Uint8Array(bytes);
  // "PK", which is where every zip starts and no JSON document does.
  const zipped = data[0] === 0x50 && data[1] === 0x4b;
  return documentToLayout(
    zipped ? await readObz(data, name) : readObf(data, name));
}
