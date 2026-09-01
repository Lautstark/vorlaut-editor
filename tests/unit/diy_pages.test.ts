import { describe, expect, it } from "vitest";
import {
  addPage, blankPage, deletePage, inboundTo, opens, pageOrder, reachable,
  unreachable,
} from "../../src/editor-diy/pages.js";
import { PAGE_KEY } from "../../src/core/types.js";
import { KEYS_PER_SET } from "../../src/device/layout_facts.js";
import type { DiyLayout } from "../../src/core/types.js";

/* The page graph, and the two acts on it.
 *
 * The cases that are expensive to get wrong and cheap to drive: a page deleted
 * while keys point at it, the first page deleted, the last page deleted, and a
 * page nothing leads to. tests/unit/app_pages.test.ts is the same list one
 * editor along, which is the point of the two files reading alike.
 *
 * **The order the strip draws** is the half that is new here rather than
 * borrowed. It was file order while a set key cycled in file order; a chain of
 * targets has no "next one along", so what a strip can honestly show is the
 * order the device reaches the pages in - and a page nothing reaches has no
 * place in such an order and must not vanish because of it.
 */

/** Pages named for their place, each with five empty keys. */
const board = (names: string[]): DiyLayout => ({
  sleep_timeout_seconds: 600,
  language: "de",
  sets: names.map((name, at) => ({ ...blankPage(name), id: `p-${at + 1}` })),
});

/** Points one key of one page at another, by the cell it sits in. */
const point = (layout: DiyLayout, from: number, key: number, to: number): void => {
  layout.sets[from]!.slots[key] =
    { text: "", symbol: "", act: { kind: "goto", set: layout.sets[to]!.id! } };
};

describe("an empty page", () => {
  it("holds five keys and nothing else", () => {
    const page = blankPage();
    expect(page.slots).toHaveLength(KEYS_PER_SET);
    expect(page.name).toBe("");
    // No id: it gets one when a key first names it, which is BoardSet.id's own
    // rule and the reason a page just made is an unreachable one.
    expect(page.id).toBeUndefined();
  });
});

describe("what a page opens", () => {
  it("is what its keys name, in the order they sit on the board", () => {
    const layout = board(["one", "two", "three"]);
    point(layout, 0, 4, 2);          // the last cell names the third page
    point(layout, 0, 1, 1);          // the second cell names the second
    expect(opens(layout, 0)).toEqual([1, 2]);
  });

  it("counts a page once however many keys name it", () => {
    const layout = board(["one", "two"]);
    point(layout, 0, 0, 1);
    point(layout, 0, 3, 1);
    expect(opens(layout, 0)).toEqual([1]);
  });

  it("leaves out a key pointed at its own page, which changes nothing", () => {
    const layout = board(["one", "two"]);
    point(layout, 0, 0, 0);
    expect(opens(layout, 0)).toEqual([]);
  });
});

describe("the order the strip draws", () => {
  it("is the order the device reaches the pages in", () => {
    /* The same walk the loader makes over a package: from the page the device
     * opens on, following every key that goes anywhere, each page's keys in
     * board order. So a chain written back to front reads forwards. */
    const layout = board(["one", "two", "three"]);
    point(layout, 0, PAGE_KEY, 2);
    point(layout, 2, PAGE_KEY, 1);
    expect(reachable(layout)).toEqual([0, 2, 1]);
    expect(pageOrder(layout)).toEqual([0, 2, 1]);
    expect(unreachable(layout)).toEqual([]);
  });

  it("puts the pages nothing leads to at the end, rather than losing them", () => {
    const layout = board(["one", "two", "three"]);
    point(layout, 0, PAGE_KEY, 2);
    expect(unreachable(layout)).toEqual([1]);
    // Last, and still there. A page nobody points at is somebody's work and is
    // one press from being reached; the strip is the only place to find it.
    expect(pageOrder(layout)).toEqual([0, 2, 1]);
    expect(pageOrder(layout).slice().sort()).toEqual([0, 1, 2]);
  });

  it("reaches the first page even when nothing points at it", () => {
    // It is where the device opens, which is the one thing a position still
    // decides - see DiyLayout.sets.
    const layout = board(["one", "two"]);
    expect(reachable(layout)).toEqual([0]);
    expect(unreachable(layout)).toEqual([1]);
  });

  it("does not loop on a chain that closes on itself", () => {
    const layout = board(["one", "two", "three"]);
    point(layout, 0, PAGE_KEY, 1);
    point(layout, 1, PAGE_KEY, 2);
    point(layout, 2, PAGE_KEY, 0);
    expect(pageOrder(layout)).toEqual([0, 1, 2]);
  });
});

describe("a new page", () => {
  it("is appended, and nothing is pointed at it", () => {
    /* The decision, not an omission: making a page and deciding what leads to
     * it are two acts. Splicing it into the chain behind whatever is open
     * would bend two targets nobody asked for, and on a game those two targets
     * are the game. */
    const layout = board(["one", "two"]);
    point(layout, 0, PAGE_KEY, 1);
    const made = addPage(layout);
    expect(layout.sets).toHaveLength(3);
    expect(made.id).toBeUndefined();
    expect(unreachable(layout)).toEqual([2]);
    // And the chain that was there is untouched.
    expect(layout.sets[0]!.slots[PAGE_KEY]!.act)
      .toEqual({ kind: "goto", set: "p-2" });
  });
});

describe("a page that goes", () => {
  it("leaves every key that led to it saying its word and standing still", () => {
    const layout = board(["one", "two", "three"]);
    point(layout, 0, PAGE_KEY, 1);
    point(layout, 2, 0, 1);
    layout.sets[2]!.slots[0]!.text = "Two please";
    layout.sets[2]!.slots[0]!.symbol = "two.png";

    expect(deletePage(layout, 1)).toBe(2);
    expect(layout.sets.map((one) => one.name)).toEqual(["one", "three"]);
    // The key keeps its word, its picture and its cell, and loses only its
    // edge - absent is what `speak` means.
    expect(layout.sets[1]!.slots[0])
      .toEqual({ text: "Two please", symbol: "two.png" });
    expect(layout.sets[0]!.slots[PAGE_KEY]!.act).toBeUndefined();
  });

  it("does not pull the chain together behind it", () => {
    /* Repairing it would mend a speech Sammlung's ring and silently rewrite a
     * game: round 6 would come to lead to round 8 as though nothing had
     * happened. askDelete() counts the keys in the question instead. */
    const layout = board(["one", "two", "three"]);
    point(layout, 0, PAGE_KEY, 1);
    point(layout, 1, PAGE_KEY, 2);
    deletePage(layout, 1);
    expect(layout.sets[0]!.slots[PAGE_KEY]!.act).toBeUndefined();
  });

  it("counts what points at it before it goes", () => {
    const layout = board(["one", "two"]);
    point(layout, 0, 0, 1);
    point(layout, 0, 3, 1);
    expect(inboundTo(layout, "p-2")).toHaveLength(2);
    expect(inboundTo(layout, "p-1")).toHaveLength(0);
  });

  it("may be the first, and the page after it becomes where the device opens", () => {
    const layout = board(["one", "two"]);
    deletePage(layout, 0);
    expect(layout.sets.map((one) => one.name)).toEqual(["two"]);
    expect(reachable(layout)).toEqual([0]);
  });

  it("may be the last, and leaves a fresh empty one", () => {
    // A key always belongs to a page, so a page always exists.
    const layout = board(["one"]);
    deletePage(layout, 0);
    expect(layout.sets).toHaveLength(1);
    expect(layout.sets[0]!.name).toBe("");
    expect(layout.sets[0]!.slots).toHaveLength(KEYS_PER_SET);
  });

  it("is nothing at all where there is no such page", () => {
    const layout = board(["one", "two"]);
    expect(deletePage(layout, 7)).toBe(0);
    expect(layout.sets).toHaveLength(2);
  });
});
