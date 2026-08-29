/* The store adr/0016 added, and the policy that keeps it from growing without
 * end.
 *
 * Two halves, tested two ways on purpose. `evictable()` is the decision - what
 * to forget, in what order, and what may never be forgotten - and it is pure,
 * so it is asked at four bytes rather than at ninety-six megabytes. The store
 * around it is IndexedDB, and the only way to know a record was really written
 * and really deleted is to write one and read it back, which is what the second
 * half does through a budget small enough to reach.
 *
 * That budget is a parameter of writeSpeech() for exactly this, the way
 * `plan()` takes its steps: the behaviour worth testing is what happens at the
 * edge, and a test that had to write the real budget to reach the edge is a
 * test nobody runs. Nothing in src/ passes it.
 *
 * What is deliberately not asserted here is the audio. Nothing in this file
 * knows what a WAV is - the cache holds bytes under a name stimmquelle
 * computes, and CONTRACT.md §3 is checked where it is implemented, which is not
 * here.
 */

import { describe, expect, it } from "vitest";
import { SPEECH_BUDGET, evictable, readSpeech, writeSpeech } from "../../src/data/store.js";

/** A recording of `size` bytes, filled with `fill` so two of them can be told
 *  apart on the way back out. */
const wav = (size: number, fill: number) => new Uint8Array(size).fill(fill);

describe("what to forget", () => {
  const use = (...sizes: number[]) =>
    sizes.map((size, at) => ({ key: `k${at}`, size }));

  it("forgets nothing while the budget is not spent", () => {
    expect(evictable(use(10, 10, 10), 100, "k2")).toEqual([]);
  });

  /* The one that is the whole point: the order is the order it is handed, and
   * that order is least-recently-used. A cache that dropped the largest, or the
   * oldest-written, would be a cache that forgets the Sammlung somebody is in
   * the middle of because they opened it first. */
  it("forgets least-recently-used first, and stops as soon as it is under", () => {
    expect(evictable(use(40, 40, 40), 100, "k2")).toEqual(["k0"]);
    expect(evictable(use(40, 40, 40, 40), 100, "k3")).toEqual(["k0", "k1"]);
  });

  /* A recording evicted by its own arrival is a synthesis paid for and thrown
   * away, and it is what a store holding one over-budget recording would do on
   * every write for ever. So the budget is a target: this leaves the store over
   * it rather than empty, and the next write makes the survivor evictable like
   * anything else. */
  it("never forgets the recording that was just written", () => {
    expect(evictable(use(300), 100, "k0")).toEqual([]);
    expect(evictable(use(50, 300), 100, "k1")).toEqual(["k0"]);
  });

  /* `keep` is skipped rather than counted as freed, which is the arithmetic
   * that would go wrong silently: subtracting a size for a record still in the
   * store leaves the walk believing it is under budget when it is not. */
  it("keeps walking past the one it may not forget", () => {
    expect(evictable(use(40, 10, 40, 40), 60, "k1")).toEqual(["k0", "k2"]);
  });

  it("is a real number of bytes, sized for one Sammlung's export and then some",
     () => {
       // 400 sentences at 24 kHz, 16 bit, mono, a second and a half each is
       // just under 30 MB. The point of the assertion is the order of
       // magnitude: a budget below one Sammlung is a budget that thrashes.
       expect(SPEECH_BUDGET).toBeGreaterThan(3 * 400 * 1.5 * 24000 * 2);
     });
});

describe("the store it is a policy for", () => {
  it("hands back exactly what was kept, under the name it was kept under",
     async () => {
       await writeSpeech("a".repeat(64), wav(8, 7));
       const held = await readSpeech("a".repeat(64));
       expect(held).toEqual(wav(8, 7));
     });

  /* A name nothing has been written under is a miss rather than a throw: every
   * caller answers a miss by speaking the sentence, and there is nothing here
   * for anybody to act on. */
  it("answers nothing for a name it does not hold", async () => {
    expect(await readSpeech("b".repeat(64))).toBeUndefined();
  });

  it("forgets down to the budget, and keeps what arrived last", async () => {
    for (const [at, name] of ["one", "two", "three"].entries()) {
      await writeSpeech(name, wav(40, at), 100);
    }
    expect(await readSpeech("one")).toBeUndefined();
    expect(await readSpeech("two")).toEqual(wav(40, 1));
    expect(await readSpeech("three")).toEqual(wav(40, 2));
  });

  /* Least-recently-*used*, and this is the assertion that says so rather than
   * least-recently-written. Reading `four` moves it behind `five`, so the next
   * write over the budget takes `five` and leaves the one somebody asked for.
   * Without the stamp on the read this passes for `four` and fails here. */
  it("counts a read as a use", async () => {
    await writeSpeech("four", wav(40, 4), 100);
    await writeSpeech("five", wav(40, 5), 100);
    expect(await readSpeech("four")).toEqual(wav(40, 4));

    await writeSpeech("six", wav(40, 6), 100);
    expect(await readSpeech("five")).toBeUndefined();
    expect(await readSpeech("four")).toEqual(wav(40, 4));
    expect(await readSpeech("six")).toEqual(wav(40, 6));
  });

  /* The view speak() hands back may be a window onto a longer buffer, and a
   * store that wrote the buffer would hand the rest of it back as audio. */
  it("keeps the recording rather than the buffer it was a view onto", async () => {
    const whole = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    await writeSpeech("seven", whole.subarray(2, 5));
    expect(await readSpeech("seven")).toEqual(new Uint8Array([3, 4, 5]));
  });
});
