/* What is *inside* a stored layout, brought forward one shape at a time.
 *
 * data/migrations.ts moves records between stores; this moves the fields
 * inside one. What the one transform below is *for* is adr/0024; that the
 * step calling it is allowed to exist at all is adr/0023: a step in that file runs inside a `versionchange` transaction and
 * may await nothing but a request on it, so it can call one of these and put
 * the result back, and it cannot hash the result. What that leaves broken -
 * the stamp beside the bytes - is what the ADR is about.
 *
 * ## The rule this file lives under
 *
 * > **One function per stored-shape change, named and dated, called from
 * > exactly one step in migrations.ts, and never on the way in or out.**
 *
 * The alternative was tried on paper and rejected for a good reason: bringing
 * a layout forward in `readLayout()` does not make the old shape go away, it
 * moves the rule that reads it out of core/types.ts - where it is written down
 * beside the field it is about - into a normalizer nobody is looking at. Two
 * shapes then live for ever, one of them undocumented, and the code that has
 * to tolerate both is every reader rather than one step. So a function here is
 * a thing that ran once, on a database at a known version, and everything
 * downstream may go on believing core/types.ts.
 *
 * A door that takes a *file* rather than a record is the one exception, and it
 * is not one really: a Sicherung is bytes somebody kept, so it can be older
 * than any database and there is no version to run steps from. data/backup.ts
 * calls the same function on the way in, which is the same act on the same
 * shape rather than a second rule.
 */

import { KEYS_PER_SET, SLOTS_PER_SET } from "../device/layout_facts.js";
import { PAGE_KEY } from "../core/types.js";
import type { BoardSet, Layout, Slot, SlotAct } from "../core/types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/* --- 2026-09-01: the five keys become one kind of thing --------------------
 *
 * BoardSet held four `slots` and, beside them, a `name`, a `symbol` and a
 * `key` for the fifth. core/types.ts says why that stopped: the device has had
 * five equal keys since vorlaut-diy-talker's adr/0020, and the editor was the
 * last place holding the distinction.
 *
 * Two things move, and the second is the one worth being careful about.
 *
 * **The set key becomes an ordinary key at PAGE_KEY**, which is the cell it
 * always sat on - the last row's first one, under the speaker. So it is an
 * insertion into the middle of the four rather than a prepend: the two keys of
 * the top row keep the indices they had and the two beside it move along one.
 * Its picture was `BoardSet.symbol` and its word was `BoardSet.key.text`; an
 * absent word stays absent, because empty goes on meaning "the panel shows the
 * page's name" exactly as it did.
 *
 * **The ring becomes targets.** An absent `BoardSet.key` meant *press it and
 * the next page comes up, forever, in the order these sit in* - a rule, never
 * stored, computed at export time from the position. Nothing else on the
 * device works that way any more, so it is written out as what it meant: a
 * `goto` at the following page, and the last page at the first. Every page
 * therefore gains an id, because something now points at every page.
 *
 * That is a rule turning into a fact, and it has a price: the ring used to
 * follow a page being moved, and a target does not. What pays it is that
 * moving pages is gone as a gesture - the strip is a reachability order now,
 * not a list somebody drags - so there is nothing left for the ring to have
 * followed.
 *
 * What comes *out* is unchanged, and that is the check that matters: all three
 * export doors already wrote the ring as targets, so a Sammlung nobody has
 * touched exports the file it exported. tests/test_obf_frozen.py holds the
 * .obz half of that against obf.py's frozen answers.
 */

/** Whether this is a page from before the five keys were one kind of thing.
 *
 * By the count and nothing else. A page in the new shape has exactly
 * KEYS_PER_SET slots - normalizeLayout() is the gate that guarantees it - and
 * a page in the old shape had exactly SLOTS_PER_SET, which is one fewer. A
 * short or malformed one reads as old too, which is the safe direction: it
 * gets padded and keeps whatever `symbol` and `key` it had, where treating it
 * as new would drop both.
 */
const wasFourKeys = (set: Record<string, unknown>): boolean =>
  !Array.isArray(set["slots"]) || set["slots"].length < KEYS_PER_SET;

/** The stored `key` field, as the slot it becomes.
 *
 * `act` follows Slot.act's rule rather than BoardSet.key's, and the two differ
 * exactly here: absent meant *the ring* on a set key and means *speak* on a
 * slot. So the ring is handed in by the caller - it is the only one that needs
 * to know what follows this page - and an explicit `{kind: "speak"}` becomes
 * no act at all, which is how every other key says the same thing.
 */
function keyAsSlot(set: Record<string, unknown>, ring: SlotAct): Slot {
  const key = isRecord(set["key"]) ? set["key"] : {};
  const act = isRecord(key["act"]) ? (key["act"] as unknown as SlotAct) : ring;
  return {
    text: typeof key["text"] === "string" ? key["text"] : "",
    symbol: typeof set["symbol"] === "string" ? set["symbol"] : "",
    ...(act.kind === "speak" ? {} : { act }),
  };
}

/** A layout as it is stored, with every page holding five equal keys.
 *
 * Answers whether anything was changed, so the step can leave a database that
 * has nothing to bring forward exactly as it found it - which is every
 * Sammlung written from today on, and every tablet Sammlung ever.
 *
 * Mutates rather than copying. The caller has just parsed the record and is
 * about to write it back, so a copy would be a second whole layout in memory
 * for no reader; and every entry point here is one of those two callers.
 */
export function fiveKeysPerPage(layout: unknown): boolean {
  if (!isRecord(layout)) return false;
  // A tablet Sammlung has pages of its own and never had a set key. Asked by
  // the flag rather than by the absence of `sets`, which is DiyLayout.target's
  // own rule: absent counts as "diy".
  if (layout["target"] === "app") return false;
  const sets = layout["sets"];
  if (!Array.isArray(sets)) return false;
  const pages = sets.filter(isRecord);
  if (!pages.length || !pages.some(wasFourKeys)) return false;

  /* An id on every page, because after this every page is pointed at.
   *
   * Kept where there is one: a key that already named a page has to go on
   * naming the same page. crypto.randomUUID() for the reason BoardSet.id
   * gives - nothing about a page, least of all a name that may be empty on all
   * of them at once, is unique enough to derive an id from. */
  const ids = pages.map((page) => typeof page["id"] === "string" && page["id"]
    ? page["id"] : crypto.randomUUID());

  for (const [at, page] of pages.entries()) {
    if (!wasFourKeys(page)) continue;
    const slots = (Array.isArray(page["slots"]) ? page["slots"] : [])
      .filter(isRecord) as unknown as Slot[];
    /* Filled up to the four it should have had before the fifth goes in.
     *
     * A page stored short is a damaged one - normalizeLayout() has padded to
     * SLOTS_PER_SET on every way in there has ever been - and the padding is
     * what that function would have done anyway. What it buys here is that the
     * page key lands on its own panel rather than in the first gap, which is
     * the mistake this whole change is about. */
    while (slots.length < SLOTS_PER_SET) slots.push({ text: "", symbol: "" });
    // The ring, written out: the next page, and the last page the first. One
    // page rings to itself, which is the press that did nothing before and
    // does nothing now.
    const ring: SlotAct = { kind: "goto", set: ids[(at + 1) % ids.length]! };
    page["slots"] = [...slots.slice(0, PAGE_KEY), keyAsSlot(page, ring),
                     ...slots.slice(PAGE_KEY)];
    page["id"] = ids[at]!;
    delete page["symbol"];
    delete page["key"];
  }
  return true;
}

/* --- what a step and a Sicherung both need -------------------------------- */

/** Every transform above, applied in the order they were written.
 *
 * The one entry point, so that a caller cannot bring a layout half-forward by
 * knowing about one of these and not the next. Answers whether anything moved.
 */
export function bringForward(layout: unknown): boolean {
  return fiveKeysPerPage(layout);
}

/** The same, on the bytes a record holds: the new text, or null for a layout
 *  that was already current.
 *
 * The serialisation is data/store.ts's serialise(), written out rather than
 * imported: store.ts imports migrations.ts, which imports this, and owning a
 * cycle would be worse than owning one JSON.stringify. tests/unit/upgrade.test.ts
 * holds the two to each other so the copy cannot drift.
 *
 * Null rather than the text unchanged, so a step can tell "nothing to do" from
 * "the same bytes again" and leave the record - and its stamp - alone.
 */
export function bringTextForward(text: string): string | null {
  let held: unknown;
  try {
    held = JSON.parse(text);
  } catch {
    // A record that is not JSON is not this file's to repair. It was not
    // written by anything here, and a step that threw would abort an upgrade
    // over one damaged row and take every other board with it.
    return null;
  }
  if (!bringForward(held)) return null;
  return JSON.stringify(held, null, 2) + "\n";
}

/** A whole layout out of a file rather than out of a record - see the head.
 *
 * Handed back as a Layout because that is what the caller had: this only ever
 * moves fields inside the shape, so a DiyLayout stays one and a tablet
 * Sammlung is not touched at all.
 */
export function fileLayout(layout: Layout): Layout {
  bringForward(layout);
  return layout;
}

/** Whether a page is one this file has already brought forward. Exported for
 *  the tests that seed old databases, so they say the same thing this does. */
export const hasFiveKeys = (set: BoardSet): boolean =>
  Array.isArray(set.slots) && set.slots.length >= KEYS_PER_SET;
