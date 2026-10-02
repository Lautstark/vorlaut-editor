import { expect, it } from "vitest";
import * as store from "../../src/data/store.js";

/* What the wipe question counts. boardTotals() read `layout.buttons`, which
 * no layout has, so "3 Sammlungen mit 0 Tasten" was said over every
 * household's boards - the one sentence that has to be right, because it is
 * the last thing anybody reads before everything goes. */
it("counts the keys of both kinds of Sammlung that hold anything", async () => {
  await store.createCollection("talker", {
    sleep_timeout_seconds: 600, language: "de", voice: "",
    sets: [
      { name: "A", slots: ["eins", "zwei", "", "", ""]
        .map((text) => ({ text, symbol: "" })) },
      { name: "B", slots: [{ text: "", symbol: "hund.png" },
        ...Array.from({ length: 4 }, () => ({ text: "", symbol: "" }))] },
    ],
  } as any);
  await store.createCollection("tablet", {
    target: "app", language: "de", home: "p", grid: { rows: 2, columns: 2 },
    pages: [{ id: "p", name: "P", buttons: [
      { row: 0, col: 0, label: "Hallo", symbol: "" },
      { row: 0, col: 1, label: "", symbol: "" },
    ] }],
  } as any);
  const totals = await store.boardTotals();
  // Two words and a picture on the talker, one label on the tablet. The
  // empty keys are not counted: they are not anybody's work.
  expect(totals.tasten).toBe(4);
  expect(totals.sammlungen).toBeGreaterThanOrEqual(2);
});
