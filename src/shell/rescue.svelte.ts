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
import RescueBody from "./RescueBody.svelte";
import RescueFoot from "./RescueFoot.svelte";
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

/** What the sheet is holding while it is open. */
export interface Rescue {
  /** The version the database is stuck at, which both sentences name. */
  readonly from: number | string;
  /** What the download did, under the first paragraph. */
  said: string;
  /** Whether the file has been taken, which is what unlocks the second
   *  button. */
  taken: boolean;
  keep(): void;
  discard(): void;
}

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

  let going = false;
  const sheet: Rescue = $state({
    from: dump.version,
    said: "",
    taken: false,
    keep() {
      try {
        download(dump);
        sheet.said = t("ui.rescue_saved");
        // Only now. The file is the whole of what makes the button beside it
        // survivable.
        sheet.taken = true;
      } catch (error) {
        sheet.said = t("ui.data_failed", { error: reason(error) });
      }
    },
    discard() {
      going = true;
      made.close();
      discardEverything();
      again();
    },
  });

  const made = openParts<Rescue>({
    title: t("ui.rescue_title"),
    state: sheet,
    body: RescueBody,
    foot: RescueFoot,
    // Dismissing costs nothing, because nothing has happened: the database is
    // where it was and a reload asks again. Said out loud rather than left as
    // a page that quietly does not work.
    onClose: () => { if (!going) status(t("ui.rescue_stopped")); },
  });
}
