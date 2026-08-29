import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OPENS_WITH, PANELS } from "../../src/shell/voices.js";

/*
 * The settings sheet folds every panel when it opens, and this is the list it
 * folds.
 *
 * It exists because the code named three of the eight by hand - voicesHere,
 * azure and symbols - under a comment saying every panel is folded on every
 * open. For the other five that was simply false: opening Erscheinungsbild and
 * closing the sheet left it open on the next visit. Nothing failed, nothing
 * looked wrong, and the comment above the lines said the opposite of what they
 * did.
 *
 * A list can drift from the markup the same way three names drifted from
 * eight, so the list is held against the markup here rather than trusted. The
 * order is asserted too: it is the on-screen order, and a panel added in the
 * middle of the sheet but appended here would read as a list nobody maintains.
 */

const markup = readFileSync(
  fileURLToPath(new URL("../../src/shell/templates/settings_sheet.ts", import.meta.url)),
  "utf8",
);

const inMarkup = [...markup.matchAll(/id="(\w+Panel)"/g)].map((m) => m[1]);

describe("the settings sheet's panel list", () => {
  it("names every panel the markup has, in the same order", () => {
    expect([...PANELS]).toEqual(inMarkup);
  });

  it("is not empty, so a broken regex cannot pass this quietly", () => {
    expect(inMarkup.length).toBeGreaterThan(5);
  });

  it("names each panel once", () => {
    expect(new Set(PANELS).size).toBe(PANELS.length);
  });

  /* The sheet is reset to how it loads rather than closed outright, so the one
     panel the markup opens has to be the one the code reopens. The first
     version of this fix folded everything, which broke the accordion test that
     leans on Sprache being open. */
  it("reopens exactly the panel the markup marks open", () => {
    const open = [...markup.matchAll(/id="(\w+Panel)"[^>]*\bopen\b/g)].map((m) => m[1]);
    expect(open).toEqual([OPENS_WITH]);
    expect(PANELS).toContain(OPENS_WITH);
  });
});
