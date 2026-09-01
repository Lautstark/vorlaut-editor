import { describe, expect, it } from "vitest";
/* What a key does, coming back IN - the import door's half of Slot.act and
 * BoardSet.key.
 *
 * ## Why this is a separate half, and a separate file
 *
 * data/device_package.ts learned to write these on 2026-09-01 and to read its
 * own packages back; device_export_acts.test.ts holds that. What it did not
 * touch is data/obf.ts, which is the one import door this repository ships and
 * the one a person actually uses - backend/local.ts's importBoard() ends in
 * importObz(). So a Sammlung could be exported with acts on it and could not
 * be imported back, and the gap was silent.
 *
 * ## What was read back wrong
 *
 * The importer found the set key by its `load_board` and the speech keys by
 * not having one. That held for exactly as long as a speech key could not lead
 * anywhere. A game inverts it: the key asking the round's question speaks and
 * stays put, and one of the four answers carries the link. Read by the old
 * rule the answer key became the set key and the question became a slot - a
 * Sammlung that opens, looks plausible and is not the one in the file.
 *
 * Measured on three hand-built games that have run on the device.
 * Spiegel-und-Ei-device.obz came back with the round's question sitting in an
 * answer slot, the winning answer gone entirely and every act absent. The
 * boards below are written in those files' shape rather than in the editor's
 * own, because the editor's own writer cannot produce a set key that stays put
 * and that is exactly the board that broke.
 *
 * The reader is asked here about documents this file STATES, never about
 * documents this file wrote - the discipline a fixture keeps, in the one place
 * the fixtures cannot reach because there is no game among them.
 */
import {
  buildDevicePackage, devicePackageBytes,
} from "../../src/data/device_package.js";
import { documentToLayout, importObz } from "../../src/data/obf.js";
import { actOf } from "../../src/core/types.js";
import type { DiyLayout, Slot } from "../../src/core/types.js";

/** One board of a game, in the shape all three hand-built ones are written in.
 *
 * The set key asks the round's question and leads NOWHERE, and one of the four
 * answers carries the link to the next round. That is the arrangement the old
 * rule read inside out.
 */
const round = (at: number, next: number, answer: number, speaks = true) => ({
  format: "open-board-0.1",
  id: `runde-${at}`,
  locale: "de",
  name: `Runde ${at}`,
  buttons: [
    ...[1, 2, 3, 4].map((key) => ({
      id: `runde-${at}-key-${key}`,
      label: `Antwort ${key}`,
      vocalization: `Antwort ${key}`,
      ...(key === answer
        ? {
            load_board: {
              id: `runde-${next}`, name: `Runde ${next}`,
              path: `boards/runde-${next}.obf`,
            },
            ...(speaks ? { ext_lautstark_speak_on_navigate: true } : {}),
          }
        : {}),
    })),
    /* The round's question. A word rather than the sentence a real game
     * carries, because what it says is asserted only as "not the set's name" -
     * and tests/german.py draws its line at exactly that: German is allowed
     * where it is the input under test, which "Antwort 1" beside it is. */
    { id: `runde-${at}-set`, label: `Runde ${at}`, vocalization: `Frage ${at}` },
  ],
  grid: {
    rows: 2,
    columns: 3,
    order: [
      [null, `runde-${at}-key-1`, `runde-${at}-key-2`],
      [`runde-${at}-set`, `runde-${at}-key-3`, `runde-${at}-key-4`],
    ],
  },
  images: [],
  sounds: [],
});

/** Three rounds, and the third comes back round to the first. */
const THREE = [round(1, 2, 1), round(2, 3, 3), round(3, 1, 2, false)];

const documentOf = (boards: any[]) => ({
  root: boards[0]!.id,
  boards: Object.fromEntries(boards.map((one) => [one.id, one])),
  files: {},
});

describe("the import door finds the set key by where it sits", () => {
  it("reads a hand-built game the right way up", () => {
    const layout = documentToLayout(documentOf(THREE)) as DiyLayout;
    expect(layout.sets.map((one) => one.name))
      .toEqual(["Runde 1", "Runde 2", "Runde 3"]);
    // Four answers in the four slots, and none of them the question. Under the
    // old rule the first set came back with the answer key as its set key and
    // the question sitting in a slot.
    for (const set of layout.sets) {
      expect(set.slots.map((one) => one.text))
        .toEqual(["Antwort 1", "Antwort 2", "Antwort 3", "Antwort 4"]);
    }
  });

  it("reads the acts back off the two fields that carry them", () => {
    const layout = documentToLayout(documentOf(THREE)) as DiyLayout;
    expect(layout.sets[0]!.slots[0]!.act)
      .toEqual({ kind: "goto", set: "runde-2", alsoSpeak: true });
    // The third round's answer leads on without speaking, so `alsoSpeak` is
    // absent rather than false - the shape the key sheet writes.
    expect(layout.sets[2]!.slots[1]!.act).toEqual({ kind: "goto", set: "runde-1" });
    // And absent rather than a written-out `speak` on a key that only speaks.
    expect(layout.sets[0]!.slots[1]!.act).toBeUndefined();
  });

  it("brings the set key back speaking, and standing still", () => {
    /* The half that BoardSet.key gained on 2026-09-01 and that this door threw
     * away until now: a set key that stays put, and the round's question it
     * asks while doing it. Both were lost on every import of every game. */
    const layout = documentToLayout(documentOf(THREE)) as DiyLayout;
    expect(layout.sets[0]!.key).toEqual({ text: "Frage 1", act: { kind: "speak" } });
  });

  it("gives an id only to the sets a key actually names", () => {
    /* BoardSet.id is minted by whatever first points at a set, so a document
     * where nobody leads anywhere must come back with none - otherwise every
     * imported Sammlung is rewritten to say something it was never asked. */
    const quiet = THREE.map((board) => ({
      ...board,
      buttons: board.buttons.map(({ load_board: _l, ...button }: any) => button),
    }));
    for (const set of (documentToLayout(documentOf(quiet)) as DiyLayout).sets) {
      expect(set.id).toBeUndefined();
    }
    expect((documentToLayout(documentOf(THREE)) as DiyLayout).sets
      .map((one) => one.id)).toEqual(["runde-1", "runde-2", "runde-3"]);
  });

  it("reads a set key that rings as the ring, which is absent", () => {
    /* What the editor's own writer produces, as against what a hand-built game
     * holds. **Absent is the ring** - BoardSet.key's own rule - so a Sammlung
     * that has never used any of this has to come back with no `key` at all,
     * or every set in the store gains a field none of them was asked. */
    const ringing = THREE.map((board, at) => ({
      ...board,
      buttons: board.buttons.map((button: any) => button.id.endsWith("-set")
        ? {
            ...button,
            vocalization: board.name,          // the set's name, so no `text`
            load_board: {
              id: `runde-${(at + 1) % 3 + 1}`,
              name: `Runde ${(at + 1) % 3 + 1}`,
              path: `boards/runde-${(at + 1) % 3 + 1}.obf`,
            },
          }
        : button),
    }));
    for (const set of (documentToLayout(documentOf(ringing)) as DiyLayout).sets) {
      expect(set.key, set.name).toBeUndefined();
    }
  });

  it("leaves a foreign board read exactly as it was read before", () => {
    /* A phone's board: several links out, no grid of this shape, and no way to
     * tell which of them a five-key device should call its set key. The rule
     * there is the one that has always answered for one - the first link is
     * the set key and the rest are pages this device cannot reach - and
     * reading those as acts instead would put four keys on a talker pointing
     * at a page tree it has no way to show. tests/reference/obf.lock.json
     * freezes this case; the check here is that it is deliberate. */
    const foreign = documentToLayout({
      root: "a",
      boards: {
        a: {
          format: "open-board-0.1", id: "a", locale: "en", name: "a",
          buttons: [
            { id: "one", label: "First", load_board: { id: "b" } },
            { id: "two", label: "Second", load_board: { id: "c" } },
            { id: "say", label: "Words" },
          ],
          images: [],
        },
        b: { format: "open-board-0.1", id: "b", locale: "en", name: "b",
             buttons: [], images: [] },
        c: { format: "open-board-0.1", id: "c", locale: "en", name: "c",
             buttons: [], images: [] },
      },
      files: {},
    }) as DiyLayout;
    expect(foreign.sets[0]!.slots.map((one) => one.text))
      .toEqual(["Words", "", "", ""]);
    for (const set of foreign.sets) {
      expect(set.id).toBeUndefined();
      expect(set.key).toBeUndefined();
      for (const slot of set.slots) expect(slot.act).toBeUndefined();
    }
  });
});

/* ------------------- out the device door and back in the import door --- */

/** A Sammlung with all three press modes on it, and a set key that is not the
 *  ring. Two sets, because a `goto` needs somewhere to go. */
const GAME: DiyLayout = {
  language: "de",
  voice: "azure:de-DE-GiselaNeural",
  sleep_timeout_seconds: 600,
  sets: [
    {
      id: "first",
      name: "Runde 1",
      // The set key's own picture, which is the symptom the mis-identification
      // showed first: pick the wrong button and the set key wears the winning
      // answer's tile. No bytes behind it - putImage() records the reference
      // and notes the gap - and the reference is what has to survive.
      symbol: "vorlaut:aufgabe-1",
      key: { text: "Frage eins", act: { kind: "speak" } },
      slots: [
        { text: "Spiegelei", symbol: "metacom:Spiegelei",
          act: { kind: "goto", set: "second", alsoSpeak: true } },
        { text: "Goldfisch", symbol: "metacom:Goldfisch" },
        { text: "Handtuch", symbol: "", act: { kind: "goto", set: "second" } },
        { text: "Ohrring", symbol: "" },
      ],
    },
    {
      id: "second",
      name: "Runde 2",
      symbol: "vorlaut:aufgabe-2",
      slots: [
        { text: "Nachtisch", symbol: "" },
        { text: "Nachthemd", symbol: "",
          act: { kind: "goto", set: "first", alsoSpeak: true } },
        { text: "Nachbar", symbol: "" },
        { text: "Nachricht", symbol: "" },
      ],
    },
  ],
};

describe("out of the device door and back in through the import door", () => {
  /** Which set an act names, as a position - the ids are not the same on both
   *  sides and are not meant to be. What has to survive is which key leads to
   *  which set, and "the second one" is what that means. */
  const leadsTo = (layout: DiyLayout, slot: Slot): number => {
    const act = actOf(slot);
    return act.kind === "speak"
      ? -1 : layout.sets.findIndex((one) => one.id === act.set);
  };

  /** Whether a key says its word on its way onward - SPEC.md §7.3's modifier,
   *  the half `leadsTo` does not carry. Narrowed rather than read off the
   *  union, because `speak` has no such field: the union is exclusive on
   *  purpose. Answering false for a `speak` loses nothing, because `kind` is
   *  compared on its own beside this. */
  const alsoSpeaks = (slot: Slot): boolean => {
    const act = actOf(slot);
    return act.kind === "goto" && act.alsoSpeak === true;
  };

  const sameActs = (before: DiyLayout, after: DiyLayout) => {
    expect(after.sets.length).toBe(before.sets.length);
    for (const [at, set] of before.sets.entries()) {
      for (const [key, slot] of set.slots.entries()) {
        const there = after.sets[at]!.slots[key]!;
        const where = `set ${at + 1} key ${key + 1}`;
        expect(actOf(there).kind, where).toBe(actOf(slot).kind);
        expect(alsoSpeaks(there), where).toBe(alsoSpeaks(slot));
        expect(leadsTo(after, there), where).toBe(leadsTo(before, slot));
      }
    }
  };

  const bytesOf = (layout: DiyLayout) => devicePackageBytes(buildDevicePackage({
    layout,
    collection: { id: "sammlung-1", name: "Spiegel und Ei" },
    voice: String(layout.voice ?? ""),
    sources: new Map(),
    sounds: new Map(),
  }));

  it("brings every key back carrying the act it went out with", async () => {
    const back = await importObz(await bytesOf(GAME), "game.obz") as DiyLayout;
    expect(back.sets.map((one) => one.name)).toEqual(["Runde 1", "Runde 2"]);
    expect(back.sets.flatMap((set) => set.slots.map((slot) => slot.text)))
      .toEqual(GAME.sets.flatMap((set) => set.slots.map((slot) => slot.text)));
    sameActs(GAME, back);
  });

  it("brings the set keys back too, the standing one and the ringing one", () => {
    /* Both halves of BoardSet.key across the seam: set 1 asks a question and
     * stays put, set 2 was never given one and is therefore the ring - and the
     * ring has to come back as absent rather than as a written-out act. */
    return bytesOf(GAME)
      .then((bytes) => importObz(bytes, "game.obz"))
      .then((back: any) => {
        expect(back.sets[0]!.key)
          .toEqual({ text: "Frage eins", act: { kind: "speak" } });
        expect(back.sets[1]!.key).toBeUndefined();
      });
  });

  it("keeps the set key a set key, picture and all", async () => {
    /* The symptom before the tiles and the acts: pick the wrong button and the
     * set key wears the winning answer's picture and the answer is gone from
     * the board entirely. Asserted as well as the acts, because a check that
     * compares only acts goes green through exactly that mistake - the four
     * slots would still hold four acts, just not the four keys. */
    const back = await importObz(await bytesOf(GAME), "game.obz") as DiyLayout;
    expect(back.sets.map((one) => one.symbol))
      .toEqual(["vorlaut:aufgabe-1", "vorlaut:aufgabe-2"]);
    // The winning answer is on the board rather than mistaken for the set key,
    // and it keeps its own tile.
    expect(back.sets[0]!.slots[0]!.text).toBe("Spiegelei");
    expect(back.sets[0]!.slots[0]!.symbol).toBe("metacom:Spiegelei");
    // And the question is nowhere among the four.
    expect(back.sets[0]!.slots.map((one) => one.text)).not.toContain("Frage eins");
  });

  it("closes again on the second trip, ids and all", async () => {
    /* The first trip renames the sets: they go out as boards named for their
     * position and come back with those names as their ids. The second must
     * change nothing at all, or the file somebody exports twice is two
     * different files and changed.ts has an edit to report every time. */
    const once = await importObz(await bytesOf(GAME), "game.obz") as DiyLayout;
    const twice = await importObz(await bytesOf(once), "game.obz") as DiyLayout;
    expect(twice).toEqual(once);
    sameActs(GAME, twice);
  });
});
