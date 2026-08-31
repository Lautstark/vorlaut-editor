import { describe, expect, it } from "vitest";
import { MAX_SETS, normalizeLayout } from "../../src/data/obf.js";
import { LIMITS } from "../../src/core/boot_data.js";
import type { DiyLayout } from "../../src/core/types.js";

/* How many sets a Sammlung may hold, and what happens to one that holds more.
 *
 * **This is here because the lock stopped saying it.** The property - an
 * over-cap document is refused rather than imported and half-shown - was held
 * by six recorded normalizeLayout answers in tests/reference/obf.lock.json,
 * which handed six, seven, twenty-five and twenty-six sets to a converter
 * whose cap was five. The cap is sixty-four now, so not one of those cases is
 * over it any more and the lock has nothing left to refuse; see THE_CAP_MOVED
 * in tests/test_obf_frozen.py for why they are set aside rather than
 * re-frozen. The oracle that could have recorded a sixty-fifth set is gone,
 * and a lock written from the module under test is the module compared against
 * itself - so this is an authored check, and it says so.
 *
 * Authored means it can only hold the module to what somebody wrote down here,
 * which is why it holds the shape and not the number: the number is read out
 * of the table that declares it, for the reason tests/test_obf_frozen.py's
 * cap_from_the_page() gives. A number restated in a test agrees with itself
 * for ever.
 *
 * What no test in this repository can hold is the number against the device's
 * own MAX_SETS. The firmware is in Lautstark/vorlaut-diy-talker and the pin
 * under third_party/ is fixtures rather than code - see the note on LIMITS in
 * src/core/boot_data.ts, which is also where the divergence is written down.
 */

/** A Sammlung of n sets, in the shape a foreign document arrives in. */
const document_ = (n: number) => ({
  sleep_timeout_seconds: 600,
  language: "de",
  sets: Array.from({ length: n }, (_, at) => ({
    name: `Seite ${at + 1}`,
    slots: [{ text: "Hallo", symbol: "hallo.png" }],
  })),
});

describe("the cap on a Sammlung's sets", () => {
  it("is the one the page declares", () => {
    expect(MAX_SETS).toBe(LIMITS.maxSets);
    expect(Number.isInteger(MAX_SETS) && MAX_SETS > 0).toBe(true);
  });

  it("takes a Sammlung filled to it, and keeps every set", () => {
    const layout = normalizeLayout(document_(MAX_SETS)) as DiyLayout;
    expect(layout.sets).toHaveLength(MAX_SETS);
    expect(layout.sets[MAX_SETS - 1]!.name).toBe(`Seite ${MAX_SETS}`);
  });

  /* The real import that started this: a talker collection of 24 pages was
   * refused with "At most 5 sets, found: 24." Under the device's own cap it is
   * an ordinary Sammlung, and the check is that it comes through whole rather
   * than merely that it does not throw. */
  it("takes an ordinary collection well under it", () => {
    const layout = normalizeLayout(document_(24)) as DiyLayout;
    expect(layout.sets).toHaveLength(24);
  });

  /* Refused, and not truncated. Truncation is the failure this is really
   * about: a file that loses its last page silently is worse than one that
   * does not open, because the device is then given a Sammlung nobody
   * authored. */
  it("refuses one set past it rather than dropping the surplus", () => {
    expect(() => normalizeLayout(document_(MAX_SETS + 1)))
      .toThrow(new RegExp(`At most ${MAX_SETS} sets, found: ${MAX_SETS + 1}\\.`));
  });

  it("says how many it found, so the sentence names the file's own size", () => {
    expect(() => normalizeLayout(document_(MAX_SETS + 40)))
      .toThrow(`At most ${MAX_SETS} sets, found: ${MAX_SETS + 40}.`);
  });
});
