import { describe, expect, it } from "vitest";
import { downloadSlug } from "@lautstark/werkzeuge/filename";
import { safeName } from "../../src/data/store.js";

/* Two rules for two jobs, and the test is mostly that they are two.
 *
 * They were one function. shell/collections.ts named every export from
 * data/store.ts's safeName(), which is the rule for an object-store key, and a
 * key maps what it cannot keep to `_` because it has to come back out of a
 * Sicherung spelling itself exactly as it went in. A file name has no such
 * round trip and does have a reader, so the same rule applied to it produced
 * `MetaTalkDE_3x5_h_ufige_W_rter-app.zip` - the Sammlung's name with holes
 * punched through the middle of two of its words.
 *
 * So the assertions come in pairs wherever they can: what the download is
 * called now, and that the key beside it is still called what it always was.
 * The second half is the one worth having. A change to safeName() is a picture
 * that a Sicherung written last month can no longer find, and nothing else in
 * this suite would say so.
 *
 * German is the data here rather than the prose, the line tests/german.py
 * already draws for src/data/wordclass.ts: the words below are input to a
 * transliteration, and a test making the point with ASCII stand-ins would not
 * be making it.
 */

/** The table, as mitreden's core/ids.ts holds it, plus the capitals it has no
 *  use for - it lowercases first and a file name keeps the case somebody
 *  typed. Written out here rather than imported.
 *
 *  The three products share one implementation now - @lautstark/werkzeuge -
 *  and its own suite holds this list. It stays here too, and the reason is the
 *  pairs below: every assertion about the download's rule is worth having
 *  beside one about safeName(), which is this repository's and must not move.
 *  A shared rule that drifted would show up here as the pair coming apart. */
const SPELLED: [string, string][] = [
  ["ä", "ae"], ["ö", "oe"], ["ü", "ue"], ["ß", "ss"],
  ["Ä", "Ae"], ["Ö", "Oe"], ["Ü", "Ue"],
  ["é", "e"], ["è", "e"],
];

describe("the name a download arrives under", () => {
  it("spells the German letters out", () => {
    for (const [letter, spelling] of SPELLED) {
      expect(downloadSlug(letter), letter).toBe(spelling);
    }
  });

  it("names the Sammlung this was reported about", () => {
    // The trailing `_` is the closing bracket, and it is left alone: what is
    // being fixed is the holes in the words, not every wart in the name.
    expect(downloadSlug("MetaTalkDE 3x5 (häufige Wörter)"))
      .toBe("MetaTalkDE_3x5_haeufige_Woerter_");
  });

  it("keeps two names apart that the key rule runs together", () => {
    // The cost of mapping, in one line: `_` is one answer for every letter it
    // does not know, so two Sammlungen a person would never confuse arrive as
    // one file name. This is the reason the fix is spelling and not a wider
    // allowed set.
    expect(safeName("Füße")).toBe(safeName("Fäße"));
    expect(downloadSlug("Füße")).not.toBe(downloadSlug("Fäße"));
    expect(downloadSlug("Füße")).toBe("Fuesse");
  });

  it("leaves alone everything safeName already kept", () => {
    // The sweep behind the spelling is safeName()'s own, character for
    // character, so a name with no letter to spell comes out exactly as it did
    // before this file existed.
    for (const name of ["Kueche", "board-1.obz", "3x5", "a_b.c-d", ""]) {
      expect(downloadSlug(name), name).toBe(safeName(name));
    }
  });

  it("still maps what it has no letter for", () => {
    // The table is German and a name is whatever somebody types. Everything
    // outside it falls through to the old rule rather than to a guess, and a
    // run of them is one `_` because that is what the sweep has always done.
    expect(downloadSlug("Ĳsselmeer")).toBe("_sselmeer");
    expect(downloadSlug("a/b\\c")).toBe("a_b_c");
  });
});

describe("and the key in the symbols store, which must not have moved", () => {
  it("still maps an umlaut to _, because a key is read back", () => {
    // Not a restatement of the rule for its own sake. Every picture in every
    // Sicherung on somebody's disk is filed under what this answered when it
    // was written, so this assertion is the one that says the split above was
    // free.
    expect(safeName("häufige Wörter.png")).toBe("h_ufige_W_rter.png");
    expect(safeName("Bild mit Rahmen.png")).toBe("Bild_mit_Rahmen.png");
  });

  it("is not the download's rule any more", () => {
    const name = "MetaTalkDE 3x5 (häufige Wörter)";
    expect(safeName(name)).not.toBe(downloadSlug(name));
  });
});
