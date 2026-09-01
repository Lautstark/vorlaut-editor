import { describe, expect, it } from "vitest";
import { buildDevicePackage, devicePlan } from "../../src/data/device_package.js";
import type { DiyLayout } from "../../src/core/types.js";

/* What a key does, on the way from a Sammlung to the file a talker reads.
 *
 * device/fixtures/package/ states this from the outside and is the authority;
 * what it cannot stateAt is the case that has no fields in it. **A Sammlung
 * written before a key could do anything but speak stores no `act` at all, and
 * no `key` on its sets** - and that silence has to keep meaning what it always
 * meant, which is every speech key speaking and every set key going on to the
 * next. Every Sammlung in the store today is that Sammlung.
 *
 * A fixture cannot hold it because a fixture states its input in the file
 * format's words, where there is no absent: `does` is always one of three. The
 * translation from absent to those three is this repository's own, so this is
 * where it is checked.
 *
 * The deleted-target case is here for the same reason. It is not a corruption
 * and it is not rare - a key points at a set, the set goes, and nothing hunts
 * down the pointers - so what it compiles to is a decision rather than an
 * accident.
 */

const COLLECTION = { id: "sammlung-1", name: "Zum Ausprobieren" };

/** A Sammlung of `count` sets, each with four keys that do nothing but exist. */
const sammlung = (count: number): DiyLayout => ({
  language: "de",
  sleep_timeout_seconds: 600,
  sets: Array.from({ length: count }, (_, at) => ({
    name: `Seite ${at + 1}`,
    symbol: "",
    slots: Array.from({ length: 4 }, (_, key) => ({ text: `Wort ${key + 1}`, symbol: "" })),
  })),
});

const built = (layout: DiyLayout) => buildDevicePackage({
  layout, voice: "", sources: new Map(), sounds: new Map(), collection: COLLECTION,
});

const setKeyOf = (board: any) =>
  board.buttons.find((one: any) => one.id === `${board.id}-set`);

describe("a Sammlung that says nothing about what its keys do", () => {
  it("rings: every set key goes on to the next", () => {
    const boards = built(sammlung(3)).boards;
    expect(boards.map((b) => setKeyOf(b).load_board?.id))
      .toEqual(["set-2", "set-3", "set-1"]);
  });

  it("and the one set of a one-set Sammlung rings to itself", () => {
    const boards = built(sammlung(1)).boards;
    expect(setKeyOf(boards[0]!).load_board?.id).toBe("set-1");
  });

  it("with every speech key speaking and leading nowhere", () => {
    const board = built(sammlung(2)).boards[0]!;
    const speech = board.buttons.filter((one) => one.id !== `${board.id}-set`);
    expect(speech).toHaveLength(4);
    for (const key of speech) {
      expect(key.load_board, key.id).toBeUndefined();
      expect(key.ext_lautstark_speak_on_navigate, key.id).toBeUndefined();
    }
  });

  /* The plan says the same thing in the interface's words, which is what
     renderLayoutBin() on the other side of the cable reads. */
  it("and the plan says go and speak, not absent", () => {
    const plan = devicePlan(sammlung(2), "");
    expect(plan.sets.map((s) => [s.key.does, s.key.target]))
      .toEqual([["go", 1], ["go", 0]]);
    expect(plan.sets[0]!.slots.map((s) => s.does)).toEqual(
      ["speak", "speak", "speak", "speak"]);
  });
});

describe("a key that was given a second job", () => {
  /** `at` gets an id, and `from`'s first key points at it. */
  const pointing = (alsoSpeak: boolean): DiyLayout => {
    const layout = sammlung(2);
    layout.sets[1]!.id = "the-second-set";
    layout.sets[0]!.slots[0]!.act = {
      kind: "goto", set: "the-second-set", ...(alsoSpeak ? { alsoSpeak: true } : {}),
    };
    return layout;
  };

  it("leads onward, and says so as a load_board", () => {
    const board = built(pointing(false)).boards[0]!;
    const key = board.buttons.find((one) => one.id === "set-1-key-1")!;
    expect(key.load_board?.id).toBe("set-2");
    expect(key.ext_lautstark_speak_on_navigate).toBeUndefined();
  });

  it("and carries its word through where it was asked to", () => {
    const board = built(pointing(true)).boards[0]!;
    const key = board.buttons.find((one) => one.id === "set-1-key-1")!;
    expect(key.load_board?.id).toBe("set-2");
    expect(key.ext_lautstark_speak_on_navigate).toBe(true);
  });

  /* The set that was pointed at is gone. The key speaks and stays put, which
     is the safe half of what it was doing: a key that fell silent AND stayed
     put would be a key that does nothing at all. */
  it("and falls back to speaking where the set it named has gone", () => {
    const layout = pointing(true);
    layout.sets.splice(1, 1);                       // the target, deleted
    const board = built(layout).boards[0]!;
    const key = board.buttons.find((one) => one.id === "set-1-key-1")!;
    expect(key.load_board).toBeUndefined();
    expect(devicePlan(layout, "").sets[0]!.slots[0]!.does).toBe("speak");
  });
});

describe("a set key that is not the ring", () => {
  it("speaks and stays, which is what a joining game's round needs", () => {
    const layout = sammlung(2);
    layout.sets[0]!.key = { text: "Spiegel + Ei", act: { kind: "speak" } };
    const board = built(layout).boards[0]!;
    const key = setKeyOf(board);
    expect(key.load_board).toBeUndefined();
    expect(key.vocalization).toBe("Spiegel + Ei");
  });

  /* Absent text is the set's own name, because a set key that speaks is nearly
     always saying what the set is called. */
  it("and says the set's name where it was given no words of its own", () => {
    const layout = sammlung(2);
    layout.sets[0]!.key = { act: { kind: "speak" } };
    expect(devicePlan(layout, "").sets[0]!.key.text).toBe("Seite 1");
  });
});
