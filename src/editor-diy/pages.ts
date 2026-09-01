/* The page graph of a talker Sammlung, and the things that happen to it.
 *
 * Pure functions over a DiyLayout: no document, no storage, no clock, no DOM.
 * editor.ts draws the result and saves it; tests/unit/diy_pages.test.ts drives
 * the cases that are expensive to get wrong - a page deleted while keys point
 * at it, the first page deleted, the last page deleted - without a browser.
 *
 * **editor-app/pages.ts is the same file for the tablet, and that is the
 * point.** The two editors' boards are not two renderings of one thing - four
 * keys in a fixed grid and a page of sixty-six buttons have different answers
 * to nearly everything - but the *graph* is one idea, and it stopped being two
 * on the day the talker's fifth key became a key like the others. So the names
 * here are that file's names, the rules are its rules, and where the two
 * differ there is a sentence saying why. Nothing is imported across: an editor
 * may not reach into another editor, which is what core/editor.ts's registry
 * is for.
 *
 * ## What the graph is
 *
 * Directed, and neither a tree nor a list. The nodes are pages; the edges are
 * keys whose act is `goto`. One node is distinguished and it is not a field:
 * **`sets[0]` is where the device opens**, which is also what `manifest.root`
 * names in every export. A talker has no `home` to move, because it has no
 * key that means "back to the start" - such a key is an ordinary `goto` like
 * every other.
 *
 * It was a ring until 2026-09-01: the fifth key cycled, always, and the file
 * order was the order it cycled in. data/upgrade.ts wrote that rule out as the
 * targets it had always meant - adr/0024, which is also where making a page and
 * deleting one are decided. What replaced the ring is not a second rule; it is
 * the absence of one.
 *
 * ## Reachability is reported, never enforced
 *
 * A page nothing leads to is legal. It is the ordinary state for the five
 * seconds between making a page and making the key that leads to it, and it is
 * also what somebody has if they are building a game back to front. So
 * `unreachable()` exists to put a mark in the page strip, and nothing here
 * refuses anything because of it: the page you cannot reach is the page you
 * most need to get to in order to fix it.
 *
 * The device is stricter and that is the device's business - the loader
 * refuses a package whose boards it cannot all walk to. What that means here
 * is that the mark is a warning about an export that has not happened yet,
 * which is exactly when a warning is useful.
 */
import { KEYS_PER_SET } from "../device/layout_facts.js";
import { actOf } from "../core/types.js";
import type { BoardSet, DiyLayout, Slot } from "../core/types.js";

/** An empty page: five keys with nothing on them, and no name.
 *
 * Nameless rather than "Seite 3", because every reader already draws
 * `name || t("ui.set_n")` - so an empty name is a page nobody has renamed,
 * shown in whichever language the page is in, rather than an English string
 * written into the layout at the moment of a press.
 *
 * No id either, which is the difference from a tablet page and is BoardSet.id's
 * own rule: it gets one when a key first names it, and until then it is a page
 * nothing leads to, which is what a page just made actually is. openKeySheet()
 * is where the minting happens, on the press that writes the key that needed
 * it.
 */
export const blankPage = (name = ""): BoardSet => ({
  name,
  slots: Array.from({ length: KEYS_PER_SET }, () => ({ text: "", symbol: "" })),
});

/** Where a page sits, or -1. */
export const pageAt = (layout: DiyLayout, id: string): number =>
  (layout.sets ?? []).findIndex((one) => one.id === id);

/** The page an id names, or undefined. */
export const pageById = (layout: DiyLayout, id: string): BoardSet | undefined =>
  (layout.sets ?? []).find((one) => one.id === id);

/** The pages this page's keys open, each once, in the order the keys sit.
 *
 * Board order rather than authoring order, because reading order is the only
 * order somebody looking at the board can predict - editor-app's opens() makes
 * the same choice for the same reason. A key pointing at its own page is left
 * out: it is a press that changes nothing, and drawing it as a step would put
 * a loop in a strip that is meant to be walked.
 */
export function opens(layout: DiyLayout, at: number): number[] {
  const from = (layout.sets ?? [])[at];
  if (!from) return [];
  const out: number[] = [];
  for (const slot of from.slots ?? []) {
    const act = actOf(slot);
    if (act.kind !== "goto") continue;
    const to = pageAt(layout, act.set);
    if (to < 0 || to === at || out.includes(to)) continue;
    out.push(to);
  }
  return out;
}

/** Which pages can be got to from the one the device opens on.
 *
 * Breadth first, following every key that goes anywhere - which is word for
 * word the walk the loader makes over a package: "the set order is the order
 * they are first reached from the root following every key that goes
 * anywhere". The two agreeing is what makes the strip show the order a person
 * will actually meet the pages in on the device.
 */
export function reachable(layout: DiyLayout): number[] {
  const sets = layout.sets ?? [];
  if (!sets.length) return [];
  const seen: number[] = [];
  const queue = [0];
  while (queue.length) {
    const at = queue.shift()!;
    if (seen.includes(at)) continue;
    seen.push(at);
    queue.push(...opens(layout, at));
  }
  return seen;
}

/** Every page, in the order the strip draws them: the ones the device can
 *  reach, in the order it reaches them, and then the ones nothing leads to.
 *
 * The orphans come last in file order rather than being left out, and that is
 * the whole reason this returns a list instead of the walk above. A page
 * nothing points at has no place in a reachability order and must not vanish
 * because of it: it is somebody's work, it is a press away from being reached,
 * and the strip is the only place it can be found. Marked as unreachable where
 * it is drawn - see unreachable() - so the run at the end reads as a run
 * rather than as more of the same.
 */
export function pageOrder(layout: DiyLayout): number[] {
  const found = reachable(layout);
  const rest = (layout.sets ?? [])
    .map((_, at) => at).filter((at) => !found.includes(at));
  return [...found, ...rest];
}

/** The pages nothing leads to, as their places. */
export function unreachable(layout: DiyLayout): number[] {
  const found = reachable(layout);
  return (layout.sets ?? []).map((_, at) => at).filter((at) => !found.includes(at));
}

/** Every key anywhere in the Sammlung that leads to this page.
 *
 * The number the delete question needs, and the only fact in it somebody
 * cannot see from the page they are standing on: what is *on* a page is on
 * screen, what points *at* it is on five other pages.
 *
 * A key on the page being asked about counts too, unlike editor-app's, and the
 * difference is the boards: a tablet's shared first column is drawn on every
 * page at once, so "does a page lead to itself" is a question about where a
 * button was authored. Here every key belongs to exactly one page, and a key
 * pointing at its own page is a key that will lose its target like any other.
 */
export function inboundTo(layout: DiyLayout, id: string): Slot[] {
  const found: Slot[] = [];
  if (!id) return found;
  for (const page of layout.sets ?? []) {
    for (const slot of page.slots ?? []) {
      const act = actOf(slot);
      if (act.kind === "goto" && act.set === id) found.push(slot);
    }
  }
  return found;
}

/** A new page, appended, leading nowhere and led to by nothing.
 *
 * **Nothing is pointed at it, and that is a decision rather than an
 * omission.** Making a page and deciding what leads to it are two acts, and
 * the second one is a key; editor-app's addPage() says the same and this is
 * the same rule one editor along. The tempting alternative - splice it into
 * the chain behind whatever page is open, so it inherits the ring's old
 * behaviour - would be the editor bending two targets nobody asked it to
 * bend, and on a Sammlung that is a game those two targets are the game.
 *
 * What it costs is that a page just made is unreachable until a key names it.
 * That is true, it is visible - the strip marks it - and it is the same five
 * seconds a tablet page spends there.
 */
export function addPage(layout: DiyLayout, name = ""): BoardSet {
  const page = blankPage(name);
  (layout.sets ??= []).push(page);
  return page;
}

/**
 * A page goes, and every key that led to it stays where it is.
 *
 * editor-app's deletePage(), argued there at length and true here for the same
 * reasons. What is rejected, briefly: refusing while something points at it
 * makes you hunt the keys down by hand; leaving them pointing at nothing puts
 * a dangling `load_board` in the package, which the loader refuses and the
 * firmware would draw as a key that looks live and ignores the press; and
 * deleting those keys too destroys work on a different page as a side effect
 * of deleting this one.
 *
 * So the key keeps its word, its picture and its cell, and loses only its
 * edge. It becomes a key that says its word and stays put, which is a whole
 * key rather than a hole - and the person deleting the page is the one who
 * knows what belongs there instead.
 *
 * **The chain is not pulled together**, and that is the same decision seen
 * from the other side. Pointing the orphaned keys at whatever the deleted page
 * pointed at would repair a speech Sammlung's ring and would silently rewrite
 * a game: round 6 would come to lead to round 8 as though nothing had
 * happened. The question in front of this counts the keys instead, so what is
 * about to be true is said before it is true rather than mended afterwards.
 *
 * Two edges of the rule:
 *
 * - **The first page may go**, and the page after it becomes the one the
 *   device opens on. Refusing would be the first rejected option in a hat.
 * - **The last page may go**, and leaves a fresh empty one, because a key
 *   always belongs to a page so a page always exists.
 *
 * Answers how many keys were turned back into plain ones, which is the number
 * the question was asked with.
 */
export function deletePage(layout: DiyLayout, at: number): number {
  const sets = layout.sets ?? [];
  const going = sets[at];
  if (!going) return 0;

  const inbound = going.id ? inboundTo(layout, going.id) : [];
  // Absent is what `speak` means on a slot, so this is the key written the way
  // a key that has never been given a second job is written - see Slot.act.
  for (const slot of inbound) delete slot.act;

  sets.splice(at, 1);
  if (!sets.length) sets.push(blankPage());
  return inbound.length;
}
