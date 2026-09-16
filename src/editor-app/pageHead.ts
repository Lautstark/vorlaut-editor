/* --- The page: what its head and its facts line are drawn from ------------
 *
 * The drawing itself is editor-app/PageHead.svelte and editor-app/Facts.svelte.
 * What is left here is the three questions those two ask that are about the
 * graph rather than about the screen - what leads to this page, what the
 * cheapest way to it is, and what the buttons on it do - and the question asked
 * before a page goes. adr/0025.
 *
 * What stood here was a path, a row of tiles and a picker, and all three are
 * gone. The row showed the pages the page on screen opened, so it was empty on
 * every board nobody had linked yet - which is every board for its whole first
 * sitting. Five drawings were tried against that (see the mock pages in the
 * design session) and each of them made a claim about the graph that the graph
 * does not support: a level, a parent, a set of neighbours.
 *
 * **The path went for a reason worth writing down.** `route()` walks
 * breadth-first and takes the shortest chain, so where two ways reach a page it
 * showed one of them, arbitrarily, as though it were *the* way. On a graph
 * where a Food page hangs off both Meals and Morning - the ordinary case this
 * editor is built for - a breadcrumb cannot be truthful. What it was really
 * trying to answer is "what leads here", and that question has an exact answer
 * in inboundTo(): all of them, not one.
 *
 * So the chrome over the board is now two lines. The page's own head - its
 * name, which is the field that renames it - and one line of numbers, each of
 * which unfolds. Which pages exist, and getting to them, is the list in the
 * sidebar; where a page leads is the buttons on the board, each of which
 * carries a corner that follows it.
 */
import type { AppButton, AppLayout, AppPage } from "../core/types.js";
import { t } from "../core/texts.js";
import { confirmDialog } from "../shell/dialog.js";
import { deletePage, inboundTo, opens, pageById, sharedColumn } from "./pages.js";
import { effortByPage, pageEffort } from "./effort.js";
import { at, board, commit } from "./standing.svelte.js";

/**
 * What the buttons on this page do, counted, and only where there are any.
 *
 * The count on its own says how full a page is; this says what it is full of,
 * which is the difference between a page of words and a page of ways onward. A
 * page that is eight ways onward and two words is a menu, and that is a thing
 * worth being able to see without counting by eye.
 *
 * By act rather than by word class. The classes are already on the board, in
 * the colours - that is what the Fitzgerald key is for - so counting them here
 * would be the same fact twice. What a button *does* is nowhere on the board
 * except as a small badge in a corner, and it is the half that decides whether
 * a page is vocabulary or navigation.
 *
 * A `goto` that carries its word into the sentence is its own entry rather than
 * being counted twice. It is one button and one press, and a page with four of
 * them has four buttons, not eight.
 *
 * The shared first column comes last, because it is the answer to the question
 * the fill line provokes: why does this page hold more than somebody put on it.
 */
export function kindsOf(drawn: AppButton[], shared: number): Array<[string, number]> {
  const tally = new Map<string, number>();
  const add = (key: string) => tally.set(key, (tally.get(key) ?? 0) + 1);
  for (const one of drawn) {
    switch (one.act.kind) {
      case "append": add("word"); break;
      case "speak": add("speak"); break;
      case "home": add("home"); break;
      case "goto":
        add(one.act.alsoAppend === true ? "goto_word" : "goto");
        break;
      default: add("bar"); break;
    }
  }
  if (shared) tally.set("shared", shared);
  /* A fixed order rather than the order they were met in, so that the line
   * does not rearrange itself as somebody fills a page - and vocabulary first,
   * because that is what a board is for. */
  const order = ["word", "speak", "goto_word", "goto", "home", "bar", "shared"];
  return order
    .filter((key) => tally.get(key))
    .map((key) => [t(`ui.app_page_kind_${key}`), tally.get(key)!]);
}

/**
 * The pages passed through on the cheapest way from the start page, ending on
 * this one.
 *
 * Not route(). That walks breadth-first and answers "the fewest page changes",
 * which is a different question from "the least effort" and was the reason the
 * old path could be wrong - see effortByPage(). This one is derived from the
 * costs themselves: step back to whichever neighbour the total was reached
 * through.
 */
export function cheapestWay(layout: AppLayout, pageId: string): AppPage[] {
  const cost = effortByPage(layout);
  const out: AppPage[] = [];
  let here = pageById(layout, pageId);
  const seen = new Set<string>();
  while (here && !seen.has(here.id)) {
    seen.add(here.id);
    out.unshift(here);
    if (here.id === layout.home) break;
    const total = cost.get(here.id);
    if (total === undefined) break;
    const own = pageEffort(layout, here);
    let from: AppPage | undefined;
    for (const other of layout.pages) {
      const theirs = cost.get(other.id);
      if (theirs === undefined || other.id === here.id) continue;
      const leadsOn = opens(layout, other.id).some((x) => x.id === here!.id)
        || sharedColumn(layout).some((b) =>
             b.act.kind === "goto" && b.act.page === here!.id);
      if (!leadsOn) continue;
      if (Math.abs(theirs + 1 + own - total) < 1e-9) { from = other; break; }
    }
    here = from;
  }
  return out;
}

/** Every page whose buttons lead to this one, each once.
 *
 * inboundTo() answers in buttons, because that is what the delete question
 * counts. The line over the board answers in pages: two buttons on one page
 * leading here is one place to go back to, not two. */
export function inboundPages(layout: AppLayout, pageId: string): AppPage[] {
  const out: AppPage[] = [];
  const seen = new Set<string>();
  for (const one of layout.pages) {
    if (one.id === pageId || seen.has(one.id)) continue;
    if (one.buttons.some((b) => b.act.kind === "goto" && b.act.page === pageId)) {
      seen.add(one.id);
      out.push(one);
    }
  }
  return out;
}

/* --- The page sheet ------------------------------------------------------ */

/**
 * The question asked before a page goes.
 *
 * Three facts, and the third is the one that earns the dialog: what is on the
 * page, what happens to it, and **how many buttons on other pages lead here**.
 * The first two somebody can see from where they are standing. The third they
 * cannot - it is on five other pages - and it is the only thing in the
 * question that could change their mind. conventions.md §1.7, one level down
 * from a Sammlung.
 */
export async function askDelete(on: AppPage): Promise<boolean> {
  const layout = board();
  const name = on.name || t("ui.app_page_n",
                            { n: layout.pages.indexOf(on) + 1 });
  const n = on.buttons.length;
  const inbound = inboundTo(layout, on.id).length;

  const lines = [
    t(n === 0 ? "ui.app_page_delete_ask_none"
       : n === 1 ? "ui.app_page_delete_ask_one" : "ui.app_page_delete_ask",
      { name, n }),
  ];
  if (inbound) {
    lines.push(t(inbound === 1 ? "ui.app_page_delete_links_one"
                               : "ui.app_page_delete_links", { n: inbound }));
  }
  // The last page leaves an empty one behind rather than nothing, and somebody
  // about to press the button should know that is what they are getting.
  if (layout.pages.length === 1) lines.push(t("ui.app_page_last"));

  if (!await confirmDialog({
    title: t("ui.app_page_delete"),
    body: lines.join(" "),
    confirmLabel: t("ui.app_page_delete_go"),
    danger: true,
  })) return false;

  deletePage(layout, on.id);
  at.here = layout.pages[0]!.id;
  commit();
  return true;
}
