import { describe, expect, it } from "vitest";
import { importObz } from "../../src/data/obf.js";
import { zipBytes } from "../../src/data/zip.js";

/* Foreign boards with ids that are also names on Object.prototype, and with
 * lists that are not lists. Neither is something this editor writes; both are
 * something a file from elsewhere can say, and both used to end in a
 * TypeError from three functions down - which the import door reports as a
 * fault in this page rather than in the file. */

const encoded = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)) as Uint8Array<ArrayBuffer>;

const board = (extra: Record<string, unknown> = {}) => ({
  format: "open-board-0.1", id: "b", name: "B",
  buttons: [{ id: "a", label: "hi" }],
  grid: { rows: 1, columns: 1, order: [["a"]] },
  ...extra,
});

describe("ids that Object.prototype also has", () => {
  it("a link to `constructor` is a link to nothing, not to a function", async () => {
    const layout: any = await importObz(encoded(board({
      buttons: [{ id: "a", label: "more", load_board: { id: "constructor" } }],
    })), "x.obf");
    expect(layout.sets).toHaveLength(1);
    expect(layout.sets[0].slots.some((slot: any) => slot.act)).toBe(false);
  });

  it("a board whose id is `toString` is a board", async () => {
    const bytes = await zipBytes([{
      name: "boards/toString.obf", data: encoded(board({ id: "toString" })),
    }]);
    const layout: any = await importObz(bytes, "x.obz");
    expect(layout.sets).toHaveLength(1);
  });

  it("a button whose id is `toString` is drawn where the grid puts it", async () => {
    const layout: any = await importObz(encoded(board({
      buttons: [{ id: "toString", label: "hi" }],
      grid: { rows: 1, columns: 1, order: [["toString"]] },
    })), "x.obf");
    expect(layout.sets[0].slots.some((slot: any) => slot.text === "hi")).toBe(true);
  });
});

describe("lists that are not lists", () => {
  it.each([
    ["grid.order", { grid: { rows: 1, columns: 1, order: 5 } }],
    ["grid.order row", { grid: { rows: 1, columns: 1, order: [5] } }],
    ["buttons", { buttons: { a: 1 } }],
    ["images", { images: "none" }],
  ])("refuses %s in a sentence naming the board", async (field, extra) => {
    await expect(importObz(encoded(board(extra)), "x.obf"))
      .rejects.toThrow(`board "b" has a "${field}" that is not a list`);
  });
});
