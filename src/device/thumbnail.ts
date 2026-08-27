// What Image.thumbnail() would make of a picture this size.
//
// A copy of thumbnailSize() from `loader/src/tiles.ts` in
// Lautstark/vorlaut-diy-talker, which is the one name on adr/0012's bill that
// genuinely passes this family's extraction test - two consumers in two
// products - and is still not extracted. docs/split-crossings.md, hard case
// two, has the three reasons: the requirement is aesthetic rather than
// normative, the input cannot move because Pillow's round_aspect() is not going
// to change under either repository, and a fifth shared package costs a
// `prepare` build, an installcheck row, a pins.js row and a bump per touch to
// prevent something nothing refuses. A drifted copy costs one pixel of
// proportion on a tablet; compare what a wrong HASH_BYTES does.
//
// What holds the copies together is `tests/reference/thumbnail.lock.json`, a
// table frozen from tiles.ts on 2026-08-27 while both halves were still in one
// tree and `tiles.lock.json` still held that implementation to Pillow. That is
// frozen-references.md's own pattern, taken here unusually early: before the
// oracle goes rather than in the week it is deleted.
//
// **The one thing that did not travel is the default argument.** The original
// reads `thumbnailSize(width, height, max = TILE_SIZE)`, and TILE_SIZE is the
// device's 116-pixel tile - a number this repository has no business holding a
// second copy of, which is what adr/0013 exists to prevent. The default never
// fired here anyway: data/app_assets.ts has always passed IMAGE_SIZE
// explicitly. So `max` is required, and a caller that forgets it does not
// compile.

/** What Image.thumbnail() would make of a picture this size.
 *
 * Fit-within, aspect preserved, and two details that are easy to miss and
 * expensive to get wrong. It never enlarges - a picture smaller than `max`
 * keeps its size and is simply centred. And the rounded side is not floored
 * but picked: of floor and ceil, whichever leaves the aspect ratio closer to
 * the original, ties to floor. That is round_aspect() in Pillow, and one
 * pixel of disagreement here shifts everything that follows.
 */
export function thumbnailSize(
  width: number, height: number, max: number,
): [number, number] {
  if (max >= width && max >= height) return [width, height];

  const roundAspect = (
    number: number, error: (n: number) => number,
  ): number => {
    const low = Math.floor(number);
    const high = Math.ceil(number);
    // Python's min() keeps the earlier argument on a tie, and floor is first.
    const best = error(high) < error(low) ? high : low;
    return Math.max(best, 1);
  };

  const aspect = width / height;
  let [x, y] = [max, max];
  if (x / y >= aspect) {
    x = roundAspect(y * aspect, (n) => Math.abs(aspect - n / y));
  } else {
    y = roundAspect(x / aspect, (n) => (n === 0 ? 0 : Math.abs(aspect - x / n)));
  }
  return [x, y];
}
