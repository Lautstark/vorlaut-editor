/* The cache adr/0016 added, as it stands since version 7: stimmquelle's
 * cacheStore(), in a database of its own, with this repository's budget.
 *
 * The policy itself - least recently used, a read counted as a use, the
 * recording just written never dropped - is stimmquelle's now, and tested
 * there. What is vorlaut's, and so what this file holds, is the three things
 * the switch could have lost: a recording outlives the page that wrote it, the
 * budget this file passes is the one that evicts, and "delete everything"
 * reaches a database that is no longer the one it empties.
 *
 * The budget is asserted in two halves for the reason the old writeSpeech()
 * took it as a parameter: the behaviour worth testing is what happens at the
 * edge, and a test that wrote ninety-six megabytes to reach it is a test
 * nobody runs. So one half says which budget data/store.ts hands the package,
 * and the other drives the same database at a budget small enough to reach.
 *
 * What is deliberately not asserted here is the audio. Nothing in this file
 * knows what a WAV is - the cache holds bytes under a name stimmquelle
 * computes, and CONTRACT.md §3 is checked where it is implemented.
 */

import { describe, expect, it, vi } from "vitest";
import { cacheStore } from "@lautstark/stimmquelle/browser";

/** What data/store.ts asked the package for, recorded on the way through to
 *  the real cacheStore() - so the store under test is the real one. */
const asked = vi.hoisted(() => [] as { name: string; budget?: number }[]);
vi.mock("@lautstark/stimmquelle/browser", async (original) => {
  const real = await original<typeof import("@lautstark/stimmquelle/browser")>();
  return {
    ...real,
    cacheStore: (name: string, options: { budget?: number } = {}) => {
      asked.push({ name, ...options });
      return real.cacheStore(name, options);
    },
  };
});

const { SPEECH_BUDGET, spoken, wipeEverything } = await import("../../src/data/store.js");

/** A recording of `size` bytes, filled with `fill` so two of them can be told
 *  apart on the way back out. */
const wav = (size: number, fill: number) => new Uint8Array(size).fill(fill);

describe("the speech cache", () => {
  it("hands back exactly what was kept, under the name it was kept under",
     async () => {
       await spoken.put("a".repeat(64), wav(8, 7));
       expect(await spoken.get("a".repeat(64))).toEqual(wav(8, 7));
       expect(await spoken.get("b".repeat(64))).toBeUndefined();
     });

  /* A reload is a fresh module graph over the same origin's IndexedDB. The
   * module-level `spoken` of the new graph opens the database afresh, which is
   * what a page coming back does. */
  it("keeps a recording across a reload", async () => {
    await spoken.put("kept", wav(16, 3));
    vi.resetModules();
    const again = await import("../../src/data/store.js");
    expect(again.spoken).not.toBe(spoken);
    expect(await again.spoken.get("kept")).toEqual(wav(16, 3));
  });

  /* Its own database, and not a store in `vorlaut`: the step to 7 dropped
   * that one, and a cache in the content's database is one a version bump
   * of the content has to think about. */
  it("lives in vorlaut-stimme, with the budget this repository chose", () => {
    expect(asked[0]).toEqual({ name: "vorlaut-stimme", budget: SPEECH_BUDGET });
  });

  it("is a real number of bytes, sized for one Sammlung's export and then some",
     () => {
       // 400 sentences at 24 kHz, 16 bit, mono, a second and a half each is
       // just under 30 MB. The point of the assertion is the order of
       // magnitude: a budget below one Sammlung is a budget that thrashes.
       expect(SPEECH_BUDGET).toBeGreaterThan(3 * 400 * 1.5 * 24000 * 2);
     });

  /* The same database at a budget it can reach. Reading `four` moves it
   * behind `five`, so the write over the budget takes `five` - which is what
   * keeps the Sammlung somebody is working on. */
  it("forgets least-recently-used down to its budget", async () => {
    const small = cacheStore("vorlaut-stimme", { budget: 100 });
    await small.clear();
    await small.put("four", wav(40, 4));
    await small.put("five", wav(40, 5));
    expect(await small.get("four")).toEqual(wav(40, 4));

    await small.put("six", wav(40, 6));
    expect(await small.get("five")).toBeUndefined();
    expect(await small.get("four")).toEqual(wav(40, 4));
    expect(await small.get("six")).toEqual(wav(40, 6));
  });

  /* The shared tablet handed to the next child: what was said on it goes
   * with the boards, although it is no longer in their database. */
  it("is emptied by deleting everything", async () => {
    await spoken.put("said", wav(8, 1));
    await wipeEverything();
    expect(await spoken.get("said")).toBeUndefined();
  });
});
