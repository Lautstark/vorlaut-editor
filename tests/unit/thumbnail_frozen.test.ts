import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "./harness.js";
import { thumbnailSize } from "../../src/device/thumbnail.js";

/* The fit, against what the original answered.
 *
 * src/device/thumbnail.ts is a copy of thumbnailSize() out of
 * loader/src/tiles.ts in Lautstark/vorlaut-diy-talker, and adr/0012 named it
 * as the one thing on the split's bill that is not a number. It is a rounding
 * rule that follows Pillow's round_aspect() step for step, and two consumers
 * in two products is this family's extraction test met literally - which is
 * why docs/split-crossings.md argues the case for a package and then refuses
 * it, on the grounds that a drifted copy costs one pixel of proportion on a
 * tablet and nothing anywhere refuses.
 *
 * Nothing refusing is exactly why there has to be this. The other copy is in
 * another repository, held to Pillow by tests/reference/tiles.lock.json there;
 * this one is held to tests/reference/thumbnail.lock.json here, frozen from
 * that module on 2026-08-27 while both were still in one tree.
 *
 * **The lock is not rewritten to make this pass.** docs/frozen-references.md
 * in the other repository is the rule and it is the same one every lock in
 * this directory obeys: refreezing from the module under test leaves the
 * module compared against itself. A red case here is one of two things - a
 * change to this copy, which is a regression, or a change to the original,
 * which is a finding and a conversation. tools/thumbnailfreeze.mjs --check,
 * pointed at a checkout of that repository, is how the second is told from the
 * first.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCK = resolve(HERE, "..", "reference", "thumbnail.lock.json");

const lock = JSON.parse(readFileSync(LOCK, "utf8"));
const cases: { width: number; height: number; max: number; x: number; y: number }[]
  = lock.cases;

check("the frozen table is there and holds something",
      Array.isArray(cases) && cases.length > 0,
      `${cases?.length} cases, frozen ${lock.produced_on} from `
      + `${lock.oracle?.repository}@${String(lock.oracle?.commit).slice(0, 7)}`);

const wrong: string[] = [];
for (const one of cases) {
  const [x, y] = thumbnailSize(one.width, one.height, one.max);
  if (x !== one.x || y !== one.y) {
    wrong.push(`${one.width}x${one.height} at ${one.max}: `
               + `${x}x${y}, frozen ${one.x}x${one.y}`);
  }
}
check("every frozen case is what this copy answers", wrong.length === 0,
      wrong.join("; ") || `${cases.length} cases`);

/* The default argument that did not travel, asserted rather than left to be
 * rediscovered. The original reads `thumbnailSize(width, height, max =
 * TILE_SIZE)`, and TILE_SIZE is the device's tile geometry - a number adr/0013
 * exists to keep out of this repository. Dropping the default is what makes
 * the copy compile without it, and it is safe because data/app_assets.ts has
 * always passed IMAGE_SIZE explicitly. A default quietly reappearing would be
 * that geometry arriving through the back door with a plausible reason. */
check("the copy has no default for `max`", thumbnailSize.length === 3,
      `${thumbnailSize.length} required parameters`);

/* And that the table is worth having at all: a case where floor and ceil
 * disagree is the only kind that can catch a re-derivation. If every frozen
 * case had a whole-number answer the check above would pass against any
 * fit-within implementation, correct or not. */
{
  const decided = cases.filter((one) => {
    const aspect = one.width / one.height;
    const other = aspect >= 1 ? one.max / aspect : one.max * aspect;
    return !Number.isInteger(other) && Math.max(one.width, one.height) > one.max;
  });
  check("and the table holds cases where the rounding is what decides",
        decided.length > 0, `${decided.length} of ${cases.length}`);
}
