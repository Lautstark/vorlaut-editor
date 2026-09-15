import { byId } from "../shell/dom.js";
import { t } from "../core/texts.js";
import { addPage, reachable } from "./pages.js";
import { effortByPage } from "./effort.js";
import { at, board, commit, decimals, goToPage, page, pageName } from "./standing.js";

/**
 * The pages of the open Sammlung, down the sidebar under its row.
 *
 * **Navigation and nothing else.** No ⋯, no menu, nothing that changes
 * anything: a row is a mark, a name and a number. That is what makes the
 * keyboard behaviour below unambiguous - one row, one stop, one target - and
 * it is why everything that acts on a page sits over the board instead.
 *
 * ⌂ on the start page and ⚠ on a page nothing leads to, both at the left where
 * a column of them can be read down. The number on the right is what the page
 * costs to reach, by effort.ts; it is the only thing here that is not a name,
 * and it is the same number the facts line over the board unfolds.
 */
export function drawPageList(into: HTMLElement): void {
  const layout = board();
  const found = reachable(layout);
  const cost = effortByPage(layout);
  into.setAttribute("role", "listbox");
  into.setAttribute("aria-label", t("ui.app_pages_list"));

  layout.pages.forEach((one, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "pagelist__item";
    row.setAttribute("role", "option");
    const open = one.id === page().id;
    row.setAttribute("aria-selected", String(open));
    if (open) row.setAttribute("aria-current", "true");
    row.dataset.page = one.id;

    if (one.id === layout.home) {
      const house = document.createElement("span");
      house.className = "pagelist__home";
      house.textContent = "⌂";
      house.title = t("ui.app_page_home");
      row.appendChild(house);
    }
    if (!found.has(one.id)) {
      const lost = document.createElement("span");
      lost.className = "tab__lost";
      lost.textContent = "⚠";
      lost.title = t("ui.app_page_unreachable");
      row.appendChild(lost);
    }
    const name = document.createElement("span");
    name.className = "pagelist__name";
    name.textContent = pageName(one);
    row.appendChild(name);

    const much = document.createElement("span");
    much.className = "pagelist__cost";
    const own = cost.get(one.id);
    much.textContent = own === undefined ? "—" : decimals.format(own);
    row.appendChild(much);

    row.onclick = () => { goToPage(one.id); };
    /* Up and down walk the list, which is what replaces the "previous page"
     * and "next page" a bar would have needed. Bound to the row rather than to
     * the document on purpose: in the name field over the board, and in every
     * other field on this page, those two keys belong to the field. */
    row.onkeydown = (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = layout.pages[index + step];
      if (next) goToPage(next.id);
    };
    into.appendChild(row);
  });

  /* And the way to make one, under the list rather than over the board. It
   * belongs to the set of pages, not to the page on screen, which is the same
   * argument that puts "+ Neue Sammlung" under the list of Sammlungen. */
  const make = document.createElement("button");
  make.type = "button";
  make.className = "pagelist__new";
  make.textContent = t("ui.app_page_new");
  make.onclick = () => {
    const made = addPage(board());
    /* Straight onto it, so the name field over the board is the next thing
     * under the hand - the page was made in order to be filled in. */
    at.here = made.id;
    at.unfolded = null;
    at.wantFocus = false;
    commit();
    byId<HTMLInputElement>("appPageName").focus();
  };
  into.appendChild(make);

  /* Keeps the keyboard where it was. goToPage() redraws this list, so the row
   * that had focus is a different element by the time the press is over. */
  if (into.contains(document.activeElement) || at.wantFocus) {
    at.wantFocus = false;
    (into.querySelector('.pagelist__item[aria-current="true"]') as HTMLElement | null)
      ?.focus();
  }
}
