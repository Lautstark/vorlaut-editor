/**
 * Keeps an open list inside the sheet it was opened in, or inside the window
 * where there is no sheet.
 *
 * A sheet's body is the one scrolling area (see `.sheet > .body`), and a list
 * that is positioned inside a scrolling box is clipped by it and adds to what
 * it scrolls. So a long menu near the foot of a sheet - Wortart is eleven
 * entries - pushed the sheet's own scrollbar out and hid its own last rows
 * behind the foot.
 *
 * Its own module rather than a function in shell/sheet.svelte.ts, which is where it
 * was written: the dropdown is a component now and the sheet mounts it, so a
 * dropdown importing the sheet would be the leaf importing the frame. Nothing
 * about the two answers changed.
 *
 * Two answers, in this order. Open upward where there is more room above than
 * below, which is what a menu at the foot of a form needs and all a chooser of
 * three or four ever needs. Then cap what is left, so that a list too long for
 * either side scrolls within itself rather than out of the sheet.
 *
 * Here rather than in the shared menu: the package positions a list against
 * its anchor and says so, and which box a product wants it kept inside is the
 * product's - "the plumbing stays per product", components.css's own words for
 * the same seam.
 */
export function fit(anchor: HTMLElement, button: HTMLElement): void {
  const menu = anchor.querySelector<HTMLElement>(".menu");
  // A second press on the trigger is a dismissal, and menuOn has already
  // closed the list rather than opened one.
  if (!menu) { anchor.classList.remove("menu-anchor--up"); return; }

  const box = anchor.closest(".body");
  const view = box ? box.getBoundingClientRect()
                   : new DOMRect(0, 0, innerWidth, innerHeight);
  const at = button.getBoundingClientRect();
  // The 6px components.css hangs the list at, spent again at the far end so a
  // capped list does not sit flush against the edge it was capped by.
  const gap = 12;
  const below = view.bottom - at.bottom - gap;
  const above = at.top - view.top - gap;
  const up = menu.offsetHeight > below && above > below;

  anchor.classList.toggle("menu-anchor--up", up);
  // A floor, because a cap small enough to show nothing is worse than a list
  // that overhangs: two rows and a scrollbar is still a menu.
  menu.style.maxHeight = `${Math.max(96, Math.floor(up ? above : below))}px`;
}
