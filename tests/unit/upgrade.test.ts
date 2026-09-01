import { describe, expect, it } from "vitest";
import { bringForward, bringTextForward, fiveKeysPerPage }
  from "../../src/data/upgrade.js";
import { serialise } from "../../src/data/store.js";
import { normalizeLayout } from "../../src/data/obf.js";
import { PAGE_KEY } from "../../src/core/types.js";
import { KEYS_PER_SET } from "../../src/device/layout_facts.js";
import type { DiyLayout } from "../../src/core/types.js";

/* Bringing a stored layout forward, without a database in sight.
 *
 * data/migrations.ts's step to 6 is three lines around this function, and the
 * step is where the transaction rules bite; everything that could be wrong
 * about the *shape* is here, where it can be driven directly. adr/0023 is the
 * decision that lets a step call it at all.
 *
 * The two things this file is really for:
 *
 *   **A ring that was never stored comes out as the targets it meant.** That
 *   is the whole risk of the change - the rule was computed from a set's
 *   position at export time, and it has to become a fact that says the same.
 *
 *   **A Sammlung already current is not touched.** Every save from today on
 *   writes the new shape, so the step runs over records it must leave exactly
 *   as it found them - stamp, updatedAt and all.
 */

/** A layout as it was stored before today: four keys, and the fifth beside
 *  them as a `symbol` and a `key`. Written out rather than typed, because
 *  core/types.ts describes the shape this produces, not the shape it takes. */
const old = (pages: number, over: Record<string, unknown>[] = []) => ({
  sleep_timeout_seconds: 600,
  language: "de",
  sets: Array.from({ length: pages }, (_, at) => ({
    name: `Seite ${at + 1}`,
    symbol: `bild-${at + 1}.png`,
    slots: [
      { text: `Wort ${at + 1}a`, symbol: "a.png" },
      { text: `Wort ${at + 1}b`, symbol: "" },
      { text: `Wort ${at + 1}c`, symbol: "" },
      { text: `Wort ${at + 1}d`, symbol: "" },
    ],
    ...(over[at] ?? {}),
  })),
});

describe("a Sammlung stored before the five keys were one kind of thing", () => {
  it("puts the set key on its own panel and leaves the other four where they read", () => {
    const layout = old(1);
    expect(fiveKeysPerPage(layout)).toBe(true);
    const page = (layout as unknown as DiyLayout).sets[0]!;
    expect(page.slots).toHaveLength(KEYS_PER_SET);
    expect(page.slots.map((one) => one.text)).toEqual(
      ["Wort 1a", "Wort 1b", "", "Wort 1c", "Wort 1d"]);
    expect(page.slots[PAGE_KEY]!.symbol).toBe("bild-1.png");
    expect(Object.hasOwn(page, "symbol")).toBe(false);
    expect(Object.hasOwn(page, "key")).toBe(false);
  });

  it("writes the ring out as the targets it always meant", () => {
    const layout = old(3) as unknown as DiyLayout;
    fiveKeysPerPage(layout);
    const ids = layout.sets.map((one) => one.id!);
    expect(new Set(ids).size).toBe(3);
    expect(layout.sets.map((one) => one.slots[PAGE_KEY]!.act)).toEqual([
      { kind: "goto", set: ids[1] },
      { kind: "goto", set: ids[2] },
      { kind: "goto", set: ids[0] },
    ]);
  });

  it("rings a one-page Sammlung at itself, which is the press that did nothing", () => {
    const layout = old(1) as unknown as DiyLayout;
    fiveKeysPerPage(layout);
    expect(layout.sets[0]!.slots[PAGE_KEY]!.act)
      .toEqual({ kind: "goto", set: layout.sets[0]!.id });
  });

  it("keeps a set key that was given a word, and its picture with it", () => {
    const layout = old(2, [{ key: { text: "Spiegel + Ei", act: { kind: "speak" } } }]) as
      unknown as DiyLayout;
    fiveKeysPerPage(layout);
    // `speak` becomes no act at all, which is how every other key says it.
    expect(layout.sets[0]!.slots[PAGE_KEY])
      .toEqual({ text: "Spiegel + Ei", symbol: "bild-1.png" });
  });

  it("keeps a set key that was pointed somewhere, rather than re-ringing it", () => {
    const layout = old(2, [{
      id: "runde-1",
      key: { act: { kind: "goto", set: "runde-1", alsoSpeak: true } },
    }]) as
      unknown as DiyLayout;
    fiveKeysPerPage(layout);
    expect(layout.sets[0]!.slots[PAGE_KEY]!.act)
      .toEqual({ kind: "goto", set: "runde-1", alsoSpeak: true });
    // And an id a key already named is kept, or that key would stop naming it.
    expect(layout.sets[0]!.id).toBe("runde-1");
  });

  it("pads a page that was stored short, so no key lands on the wrong panel", () => {
    /* obf.ts's normalizeLayout() is the gate that guarantees five, and this is
     * what feeds it: a page with two keys keeps them in the two cells they
     * read in, and the panel is the third. The lock used to measure this
     * padding and cannot any more - THE_KEYS_ARE_FIVE in
     * tests/test_obf_frozen.py says why - so it is measured here. */
    const layout = old(1, [{ slots: [{ text: "eins", symbol: "" }] }]);
    fiveKeysPerPage(layout);
    const padded = normalizeLayout(layout) as DiyLayout;
    expect(padded.sets[0]!.slots.map((one) => one.text))
      .toEqual(["eins", "", "", "", ""]);
    expect(padded.sets[0]!.slots[PAGE_KEY]!.symbol).toBe("bild-1.png");
  });
});

describe("a Sammlung that has nothing to bring forward", () => {
  it("is left exactly as it was found", () => {
    const layout = old(2) as unknown as DiyLayout;
    fiveKeysPerPage(layout);
    const again = JSON.parse(JSON.stringify(layout));
    expect(bringForward(layout)).toBe(false);
    expect(layout).toEqual(again);
  });

  it("and its bytes are not rewritten, so its stamp stays a matched pair", () => {
    // The whole reason bringTextForward() answers null rather than the same
    // string: the step puts a record back only where something moved, so a
    // Sammlung already current keeps its updatedAt and its stamp untouched.
    const layout = old(2) as unknown as DiyLayout;
    fiveKeysPerPage(layout);
    expect(bringTextForward(serialise(layout))).toBeNull();
  });

  it("is any tablet Sammlung, which never had a set key", () => {
    const tablet = {
      target: "app", home: "p-1", grid: { rows: 3, columns: 5 },
      pages: [{ id: "p-1", name: "Start", buttons: [] }],
    };
    const again = JSON.parse(JSON.stringify(tablet));
    expect(bringForward(tablet)).toBe(false);
    expect(tablet).toEqual(again);
  });
});

describe("the bytes a record holds", () => {
  it("come back serialised the way data/store.ts serialises them", () => {
    /* upgrade.ts writes its own JSON.stringify rather than importing
     * serialise(), because store.ts imports migrations.ts which imports it and
     * the cycle would be worse to own than one line. This is what makes the
     * copy safe: the two are held to each other on a real layout. */
    const layout = old(2);
    const text = bringTextForward(JSON.stringify(layout, null, 2) + "\n")!;
    expect(text).not.toBeNull();
    expect(text).toBe(serialise(JSON.parse(text)));
  });

  it("are left alone when they are not JSON at all", () => {
    // A row that was not written by anything here is not this file's to
    // repair, and a step that threw would abort the upgrade over one damaged
    // record and take every other board with it.
    expect(bringTextForward("{not json")).toBeNull();
    expect(bringTextForward("")).toBeNull();
  });
});
