/** What the page says when the database it found was not the one it expected.
 *
 * Two ends of adr/0015, and they are deliberately unequal in size.
 *
 * The ordinary end is one sentence. An upgrade carried somebody's Sammlungen
 * across, nothing was lost, and the page says so - because an upgrade that
 * moved a person's boards without telling them is indistinguishable, from
 * where that person is standing, from one that lost them. §3.8.
 *
 * The other end is a modal that stops the page, and it is the only place in
 * this product where that is the right thing: data/migrations.ts had no step
 * for a version this database has to cross, or the database is not the shape
 * its version claims, so store.ts aborted the upgrade and every record is
 * still there, untouched, at its old version. Nothing may happen next until
 * the person holding those records has them in a file.
 *
 * Closing the sheet costs nothing, and that is the point rather than an
 * oversight - the database is exactly as it was, and a reload asks again. The
 * one thing that must not be reachable without the file is the button that
 * discards.
 */

import { openParts } from "./parts.js";
import RescueBody from "@lautstark/sicherung/svelte/RescueBody";
import RescueFoot from "@lautstark/sicherung/svelte/RescueFoot";
import { Rescuing } from "@lautstark/sicherung/svelte/rescuing";
import { downloadJson } from "@lautstark/werkzeuge/download";
import { reason } from "../core/errors.js";
import { t } from "../core/texts.js";
import { isRefusal } from "../data/migrations.js";
import { asFile, type Dump } from "../data/rescue.js";
import { discardEverything, dumpEverything, onMigrated, type Migrated } from "../data/store.js";
import { status } from "./dom.js";

/** What an upgrade did, waiting for a moment when saying so will last. */
let pending: Migrated | null = null;

/** Registered before anything opens the database - app.ts does it beside
 *  onBlocked(), and a listener added after the first read would be a listener
 *  for the next upgrade rather than for this one. */
export function wireRescue(): void {
  onMigrated((what) => { pending = what; });
}

/** The sentence for an upgrade that went well, once the page has settled.
 *
 * Held rather than said where it arrives, because the carry happens inside the
 * first read of the database - and the very next thing the boot chain does is
 * core/save.ts's load(), which clears this line. That is right of load(): the
 * status line is where a failed save appears, and opening a board is not a
 * report. So this waits for the end of the chain instead of racing it, which
 * e2e/upgrade.spec.ts is what noticed. */
export function sayCarried(): void {
  const what = pending;
  pending = null;
  if (!what) return;
  status(what.boards === 1
    ? t("ui.db_carried_one", { from: what.from })
    : t("ui.db_carried", { n: what.boards, from: what.from }));
}

/** Offers the sheet, and says whether this was its error to take.
 *
 * Returning a boolean rather than throwing on, because the caller is a
 * .catch() that already knows how to report everything else and this is one
 * error out of all of them. */
export function offerRescue(error: unknown, again: () => void): boolean {
  if (!isRefusal(error)) return false;
  void show(again);
  return true;
}

function download(dump: Dump): void {
  downloadJson(asFile(dump, t("ui.rescue_notice")),
               `vorlaut-rettung-${new Date().toISOString().slice(0, 10)}.json`);
}

/** How much the file would hold, which is the count line.
 *
 * Every record in every store, because that is what the file is - a raw dump of
 * a database nothing here knows the shape of, so there is no "boards" to count
 * separately and claiming one would be a number about a shape that was already
 * refused. §1.7's argument is that a question about destroying something names
 * what goes, and this is the only honest way to name it. */
const held = (dump: Dump): number =>
  Object.values(dump.stores).reduce((total, store) => total + store.values.length, 0);

async function show(again: () => void): Promise<void> {
  let dump: Dump;
  try {
    dump = await dumpEverything();
  } catch (error) {
    // Nothing can be offered and nothing has been touched. The sentence is
    // the whole of what is left to do.
    status(t("ui.data_failed", { error: reason(error) }));
    return;
  }

  const count = held(dump);
  /* What the sheet holds, and it is @lautstark/sicherung/svelte/rescuing's
     now - conventions.md §6.7. Three things arrive with it that this product
     did not have, and bildhaft's shape is the standard on all three:

       - **the count line**, above;
       - **`role="status"` on the said line**, in the tree from the first paint
         and empty, because showModal() makes the page behind it inert and the
         page's own status line therefore reaches nobody while this is up;
       - **a failure path on discard**, which needed a reorder - see below.

     The words stay here, because a shared component carries no German (§6.0)
     and because two of these sentences interpolate a version through this
     product's own t(). So does the download, whose file name is this
     product's, and so is what "again" means. */
  const sheet = new Rescuing(dump.version, count, {
    body: (from) => t("ui.rescue_body", { from }),
    // Two keys rather than a plural rule, the way every other counted sentence
    // in this product does it: the singular differs by more than an ending in
    // both languages.
    holds: (n) => t(n === 1 ? "ui.rescue_holds_one" : "ui.rescue_holds", { n }),
    saved: t("ui.rescue_saved"),
    discarding: t("ui.rescue_discarding"),
    failed: (said) => t("ui.data_failed", { error: said }),
    download: t("ui.rescue_download"),
    discard: (from) => t("ui.rescue_discard", { from }),
  }, {
    save: () => { download(dump); },
    /* **The sheet is still up while this runs, and that is a behaviour
       change.** It used to close first and then discard, so a write that
       refused had no region left to report into and the boot had already
       restarted; the component's order is the other one - close after the
       await - and §6.7 names it rather than leaving it to be discovered.
       Nothing in this product can currently refuse: discardEverything() sets
       two flags and cannot throw. The path is real anyway, because the next
       thing to stand here might. */
    discard: () => { discardEverything(); },
    again,
  });

  const made = openParts<Rescuing>({
    title: t("ui.rescue_title"),
    state: sheet,
    body: RescueBody,
    foot: RescueFoot,
    /* Dismissing costs nothing, because nothing has happened: the database is
       where it was and a reload asks again. Said out loud rather than left as
       a page that quietly does not work.

       `discarded` and not the in-flight flag, and §6.7 is explicit that the two
       are different questions. This one is a plain field with exactly one
       reader - this line - so nothing renders it and no effect depends on it;
       the component's `going` is `$state` and is what shuts both buttons, and
       it is false again after a discard that failed, where a dismissal does
       mean the person walked away. */
    onClose: () => { if (!sheet.discarded) status(t("ui.rescue_stopped")); },
  });
  sheet.close = () => made.close();
}
