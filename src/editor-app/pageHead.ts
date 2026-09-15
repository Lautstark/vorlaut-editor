/* --- The page: its own head, and the two facts about it -------------------
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
import { byId } from "../shell/dom.js";
import type { AppButton, AppLayout, AppPage } from "../core/types.js";
import { t } from "../core/texts.js";
import { confirmDialog } from "../shell/dialog.js";
import { deletePage, inboundTo, opens, pageById, sharedColumn } from "./pages.js";
import { effortByPage, pageEffort } from "./effort.js";
import { at, board, commit, decimals, goToPage, page, pageName, render } from "./standing.js";

/**
 * The page's own head: the name, and the two things that can be done to it.
 *
 * **The name is the field that renames it.** shell/templates/frame.ts settles
 * that for a Sammlung - "renaming a thing you are looking at should be typing
 * over its name" - and a page was the last name in this editor that had to go
 * through a menu to change. With renaming out of it, the ⋯ that used to sit
 * beside the path held two entries, and then one, and a menu with one entry is
 * not a menu.
 *
 * **The ⌂ appears only on the start page.** It is a mark for a state, not a
 * switch for one: on any other page it would be a house standing over a page
 * that is not the start page, which is the sort of thing a reader has to test
 * by pressing. Getting there is an act, so it is an act - a quiet word at the
 * right end, and only where it would do something.
 */
export function drawPageHead(found: Set<string>): void {
  const layout = board();
  const one = page();

  const house = byId("appPageHome");
  house.hidden = one.id !== layout.home;
  house.textContent = "⌂";
  house.title = t("ui.app_page_home");

  const name = byId<HTMLInputElement>("appPageName");
  name.setAttribute("aria-label", t("ui.app_page_name"));
  name.placeholder = t("ui.app_page_n", { n: layout.pages.indexOf(one) + 1 });
  // Only when it is not the field somebody is typing in: writing the value
  // back under the caret moves it to the end on every keystroke.
  if (document.activeElement !== name) name.value = one.name;

  const warn = byId("appPageWarn");
  warn.hidden = found.has(one.id);
  warn.textContent = "⚠";
  warn.title = t("ui.app_page_unreachable");

  const start = byId<HTMLButtonElement>("appPageStart");
  start.hidden = one.id === layout.home;
  start.textContent = t("ui.app_page_home_set");

  const remove = byId<HTMLButtonElement>("appPageDelete");
  remove.textContent = t("ui.app_page_delete");
}

/**
 * One line of numbers: what leads here, where it leads, what it costs, how much
 * is on it. Three of the four unfold.
 *
 * **Both directions are real edges.** inboundTo() and opens() are the graph
 * read forwards and backwards; nothing here is derived from a walk that had to
 * pick a parent. That is the whole difference between this line and the five
 * drawings it replaces.
 *
 * **Only one zero is a fault, and only it is coloured.** Nothing leading to a
 * page that is not the start page is the state that makes it invisible on the
 * tablet. A page leading nowhere is a leaf, and most pages of a board are
 * leaves - a board where every page led onward would be a board with no words
 * on it. Colouring that would be an editor tutting at ordinary work.
 *
 * The start page has nothing leading to it and that is not a fault either: the
 * tablet opens with it. Its zero is left plain and says so when unfolded.
 */
export function drawFacts(found: Set<string>): void {
  const layout = board();
  const one = page();
  const row = byId("appFacts");
  row.innerHTML = "";

  const into = inboundPages(layout, one.id);
  const outOf = opens(layout, one.id);
  const cost = effortByPage(layout).get(one.id);

  row.appendChild(fact("in", t("ui.app_page_here"), into.length,
    into.length === 0 && one.id !== layout.home));
  row.appendChild(dot());
  row.appendChild(fact("out", t("ui.app_page_from_here"), outOf.length, false));
  row.appendChild(dot());
  if (cost === undefined) {
    const nil = document.createElement("span");
    nil.className = "facts__plain facts__zero";
    nil.textContent = t("ui.app_page_unreachable");
    row.appendChild(nil);
  } else {
    row.appendChild(fact("cost", t("ui.app_page_effort"), cost, false));
  }
  row.appendChild(dot());
  const n = one.buttons.length + sharedColumn(layout).length;
  row.appendChild(fact("full", "", n, false));

  drawUnfolded(found, into, outOf, cost);
}

/** The separator between two facts. A middot rather than a rule: the line is a
 *  sentence of numbers, and a rule would make it a toolbar. */
function dot(): HTMLElement {
  const mark = document.createElement("span");
  mark.className = "facts__dot";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "·";
  return mark;
}

/** One number, pressable, with what it says beside it.
 *
 * The button count is the one that reads the other way round - "12 Tasten"
 * rather than "Tasten 12" - because it is a quantity of things and the two
 * before it are directions with a count. So it composes its own words and this
 * takes them whole. */
function fact(key: string, label: string, value: number, bad: boolean): HTMLElement {
  const shown = key === "cost" ? decimals.format(value) : String(value);
  const one = document.createElement("button");
  one.type = "button";
  one.className = "facts__one" + (bad ? " facts__zero" : "");
  one.textContent = key === "full"
    ? t(value === 1 ? "ui.app_pages_buttons_one" : "ui.app_pages_buttons", { n: value })
    : `${label} ${shown}`;
  one.setAttribute("aria-expanded", String(at.unfolded === key));
  one.onclick = (event) => {
    event.stopPropagation();
    at.unfolded = at.unfolded === key ? null : key;
    render();
  };
  return one;
}

/**
 * What the open number says, under the line.
 *
 * Text links with middots between them, not chips: a row of names reads as a
 * sentence and a row of boxes reads as a second toolbar, which is the thing
 * this whole change is removing.
 */
function drawUnfolded(found: Set<string>, into: AppPage[], outOf: AppPage[],
                      cost: number | undefined): void {
  const layout = board();
  const box = byId("appFactLinks");
  box.innerHTML = "";
  box.hidden = at.unfolded === null;
  if (at.unfolded === null) return;

  /* How full the page is, which is the fact the bare count was missing.
   *
   * Twelve buttons means something different on a 3x5 than on a 6x11, and the
   * difference is not cosmetic: `field_size` in the effort number grows with
   * every button on screen, so how full a page is *is* part of what it costs.
   * The second line is the shared first column, which is on this page and on
   * every other one - it is counted here because it is drawn here, and said
   * because somebody wondering why a page has more buttons than they put on it
   * deserves the answer. */
  if (at.unfolded === "full") {
    const { rows, columns } = layout.grid;
    const column = sharedColumn(layout);
    const drawn = [...page().buttons, ...column];
    const fill = document.createElement("span");
    fill.className = "factlinks__line";
    fill.textContent = t("ui.app_page_buttons_fill",
                         { n: drawn.length, all: rows * columns });
    box.appendChild(fill);
    const split = kinds(drawn, column.length);
    if (split.length) box.appendChild(counted(split));
    return;
  }

  if (at.unfolded === "cost") {
    if (cost === undefined) { box.hidden = true; return; }
    box.appendChild(sum(layout));
    const what = document.createElement("span");
    what.className = "factlinks__line";
    what.textContent = t("ui.app_page_effort_what", { n: decimals.format(1) });
    box.appendChild(what);
    /* Where the arithmetic comes from, and deliberately nothing more. The CARE
     * numbers published beside it average this over English core word lists,
     * so they are no yardstick for a German board - see effort.ts. */
    const more = document.createElement("a");
    more.className = "factlinks__line";
    more.href = "https://www.openaac.org/vocabularies/";
    more.target = "_blank";
    more.rel = "noreferrer noopener";
    more.textContent = t("ui.app_page_effort_more");
    box.appendChild(more);
    return;
  }

  const set = at.unfolded === "in" ? into : outOf;
  if (!set.length) {
    const nil = document.createElement("span");
    nil.className = "factlinks__line";
    if (at.unfolded === "out") {
      nil.textContent = t("ui.app_page_opens_none");
    } else if (page().id === layout.home) {
      nil.textContent = t("ui.app_page_here_home");
    } else {
      nil.className += " facts__zero";
      nil.textContent = t("ui.app_page_here_none");
    }
    box.appendChild(nil);
    return;
  }
  set.forEach((one, index) => {
    if (index) box.appendChild(dot());
    const link = document.createElement("button");
    link.type = "button";
    link.className = "factlinks__to";
    if (!found.has(one.id)) {
      const lost = document.createElement("span");
      lost.className = "tab__lost";
      lost.textContent = "⚠";
      lost.title = t("ui.app_page_unreachable");
      link.appendChild(lost);
    }
    link.appendChild(document.createTextNode(pageName(one)));
    link.onclick = (event) => { event.stopPropagation(); goToPage(one.id); };
    box.appendChild(link);
  });
}

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
function kinds(drawn: AppButton[], shared: number): Array<[string, number]> {
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

/** A label and a number, then the next: the same shape as the facts line over
 *  it, which is what lets both avoid a plural of every word in them. */
function counted(pairs: Array<[string, number]>): HTMLElement {
  const line = document.createElement("span");
  line.className = "factlinks__line factlinks__sum";
  line.textContent = pairs.map(([label, n]) => `${label} ${n}`).join("  ·  ");
  return line;
}

/** The arithmetic, page by page along the cheapest way here. Shown rather than
 *  summarised, because a number somebody is asked to act on should be one they
 *  can check. */
function sum(layout: AppLayout): HTMLElement {
  const line = document.createElement("span");
  line.className = "factlinks__line factlinks__sum";
  const cost = effortByPage(layout);
  const parts: string[] = [];
  for (const one of cheapestWay(layout, page().id)) {
    const own = decimals.format(pageEffort(layout, one));
    parts.push(parts.length
      ? `+ ${decimals.format(1)} + ${own} (${pageName(one)})`
      : `${own} (${pageName(one)})`);
  }
  const total = cost.get(page().id);
  line.textContent = total === undefined ? "" : parts.join(" ");
  return line;
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
function cheapestWay(layout: AppLayout, pageId: string): AppPage[] {
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
function inboundPages(layout: AppLayout, pageId: string): AppPage[] {
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
