import { describe, expect, it } from "vitest";
import { buildDevicePackage, devicePlan } from "../../src/data/device_package.js";
import { PAGE_KEY } from "../../src/core/types.js";
import { KEYS_PER_SET } from "../../src/device/layout_facts.js";
import type { DiyLayout } from "../../src/core/types.js";

/* What a key does, on the way from a Sammlung to the file a talker reads.
 *
 * device/fixtures/package/ states this from the outside and is the authority;
 * what it cannot state is the case that has no fields in it. **A key that
 * stores no `act` at all** has to keep meaning what it has always meant, which
 * is *say your word and stay where you are* - and that is now true of all five
 * keys alike, where the fifth used to mean something else by being absent.
 *
 * A fixture cannot hold it because a fixture states its input in the file
 * format's words, where there is no absent: `does` is always one of three. The
 * translation from absent to those three is this repository's own, so this is
 * where it is checked.
 *
 * **The ring is not in here any more, and its absence is the point.** An
 * absent `BoardSet.key` used to mean *go on to the next set, for ever*, worked
 * out at export time from where a set happened to sit - so this file's first
 * three tests were about a rule the file format had no way to state. There is
 * no rule: data/upgrade.ts wrote every stored ring out as the targets it
 * meant, and what a key does now comes from the key. The chain those targets
 * make still exports as the chain it was, which is the first test below.
 *
 * The deleted-target case stays, for the reason it was here. It is not a
 * corruption and it is not rare - a key points at a page, the page goes, and
 * nothing hunts down the pointers - so what it compiles to is a decision
 * rather than an accident.
 */

const COLLECTION = { id: "sammlung-1", name: "Zum Ausprobieren" };

/** A Sammlung of `count` pages whose keys say a word and nothing else.
 *
 * No ids, so nothing can point anywhere: this is the shape everything else in
 * the file starts from and adds one target to. */
const sammlung = (count: number): DiyLayout => ({
  language: "de",
  sleep_timeout_seconds: 600,
  sets: Array.from({ length: count }, (_, at) => ({
    name: `Seite ${at + 1}`,
    slots: Array.from({ length: KEYS_PER_SET },
                      (_, key) => ({ text: `Wort ${key + 1}`, symbol: "" })),
  })),
});

/** The same, chained the way data/upgrade.ts chains a Sammlung that used to
 *  ring: every page key points at the next, and the last at the first. */
const chained = (count: number): DiyLayout => {
  const layout = sammlung(count);
  layout.sets.forEach((page, at) => { page.id = `page-${at + 1}`; });
  layout.sets.forEach((page, at) => {
    page.slots[PAGE_KEY] = {
      text: "", symbol: "",
      act: { kind: "goto", set: `page-${((at + 1) % count) + 1}` },
    };
  });
  return layout;
};

const built = (layout: DiyLayout) => buildDevicePackage({
  layout, voice: "", sources: new Map(), sounds: new Map(), collection: COLLECTION,
});

const setKeyOf = (board: any) =>
  board.buttons.find((one: any) => one.id === `${board.id}-set`);

describe("a Sammlung whose page keys were chained", () => {
  it("exports the chain it was given: every page key goes on to the next", () => {
    const boards = built(chained(3)).boards;
    expect(boards.map((b) => setKeyOf(b).load_board?.id))
      .toEqual(["set-2", "set-3", "set-1"]);
  });

  it("and the one page of a one-page Sammlung points at itself", () => {
    // Which is the press that did nothing when this was a ring, and does
    // nothing now: the two agreeing is what data/upgrade.ts had to preserve.
    const boards = built(chained(1)).boards;
    expect(setKeyOf(boards[0]!).load_board?.id).toBe("set-1");
  });

  it("with every other key speaking and leading nowhere", () => {
    const board = built(chained(2)).boards[0]!;
    const speech = board.buttons.filter((one) => one.id !== `${board.id}-set`);
    expect(speech).toHaveLength(KEYS_PER_SET - 1);
    for (const key of speech) {
      expect(key.load_board, key.id).toBeUndefined();
      expect(key.ext_lautstark_speak_on_navigate, key.id).toBeUndefined();
    }
  });

  /* The plan says the same thing in the interface's words, which is what
     renderLayoutBin() on the other side of the cable reads. */
  it("and the plan says go, with the target the key names", () => {
    const plan = devicePlan(chained(2), "");
    expect(plan.sets.map((s) => [s.key.does, s.key.target]))
      .toEqual([["go", 1], ["go", 0]]);
    expect(plan.sets[0]!.slots.map((s) => s.does)).toEqual(
      ["speak", "speak", "speak", "speak"]);
  });
});

describe("a Sammlung that says nothing about what its keys do", () => {
  it("gives every one of the five a key that speaks and stays put", () => {
    /* Absent is `speak` on all five now. It meant that on four of them and
     * meant the ring on the fifth, which is the whole of what stopped: a page
     * key with no act is a key that says its word, exactly like its
     * neighbours, and a page nothing leads on from is a page a game means. */
    const plan = devicePlan(sammlung(2), "");
    expect(plan.sets[0]!.key.does).toBe("speak");
    expect(plan.sets[0]!.slots.map((s) => s.does))
      .toEqual(["speak", "speak", "speak", "speak"]);
    const board = built(sammlung(2)).boards[0]!;
    for (const key of board.buttons) {
      expect(key.load_board, key.id).toBeUndefined();
    }
  });
});

describe("a key that was given a second job", () => {
  /** `at` gets an id, and `from`'s first key points at it. */
  const pointing = (alsoSpeak: boolean): DiyLayout => {
    const layout = sammlung(2);
    layout.sets[1]!.id = "the-second-page";
    layout.sets[0]!.slots[0]!.act = {
      kind: "goto", set: "the-second-page", ...(alsoSpeak ? { alsoSpeak: true } : {}),
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

  /* The page that was pointed at is gone. The key speaks and stays put, which
     is the safe half of what it was doing: a key that fell silent AND stayed
     put would be a key that does nothing at all. */
  it("and falls back to speaking where the page it named has gone", () => {
    const layout = pointing(true);
    layout.sets.splice(1, 1);                       // the target, deleted
    const board = built(layout).boards[0]!;
    const key = board.buttons.find((one) => one.id === "set-1-key-1")!;
    expect(key.load_board).toBeUndefined();
    expect(devicePlan(layout, "").sets[0]!.slots[0]!.does).toBe("speak");
  });
});

describe("the key on the page-key panel", () => {
  it("speaks and stays, which is what a joining game's round needs", () => {
    const layout = chained(2);
    layout.sets[0]!.slots[PAGE_KEY] = { text: "Spiegel + Ei", symbol: "" };
    const board = built(layout).boards[0]!;
    const key = setKeyOf(board);
    expect(key.load_board).toBeUndefined();
    expect(key.vocalization).toBe("Spiegel + Ei");
  });

  /* Absent text is the page's own name, because that is what the firmware
     prints on this panel - see PAGE_KEY. */
  it("and says the page's name where it was given no words of its own", () => {
    const layout = chained(2);
    expect(layout.sets[0]!.slots[PAGE_KEY]!.text).toBe("");
    expect(devicePlan(layout, "").sets[0]!.key.text).toBe("Seite 1");
  });

  it("leads onward like any other key when it is pointed somewhere", () => {
    const layout = chained(2);
    // And the four beside it may do the same: the round's right answer is a
    // speech key with a target, which is what ended the guessing on the way in.
    layout.sets[0]!.slots[0]!.act = { kind: "goto", set: "page-2" };
    const board = built(layout).boards[0]!;
    expect(board.buttons.find((one) => one.id === "set-1-key-1")!.load_board?.id)
      .toBe("set-2");
    expect(setKeyOf(board).load_board?.id).toBe("set-2");
  });
});
