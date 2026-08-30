/* Opening a Sammlung that the address names.
 *
 *     …/vorlaut-editor/?sammlung=erste-woerter
 *
 * The reading half is `@lautstark/werkzeuge/sammlung`, and it is there rather
 * than here because mitreden and bildhaft want the same door — and because the
 * half worth sharing is the id check. The address names an entry and never a
 * URL: a parameter holding an address turns a link into "fetch whatever this
 * says and import it", and what gets imported is a Sammlung a child then reads.
 * A regex nobody tests is a regex somebody relaxes, and one copy is one test.
 *
 * What stays here is what is vorlaut's: making a Sammlung of the file, and
 * saying so. adopt.ts is that, shared in turn with „Sammlung einlesen" — see
 * adr/0018.
 */

import { wanted } from "@lautstark/werkzeuge/sammlung";
import { status } from "./dom.js";
import { adopt, adopted, refusal } from "./adopt.js";
import { t } from "../core/texts.js";
import { reason } from "../core/errors.js";
import { BACKUP_FORMAT } from "../data/backup.js";

/**
 * Whether this is a file vorlaut can make a Sammlung of at all.
 *
 * The shelf holds four products' entries behind one address shape, and nothing
 * in `?sammlung=<id>` says which product an id belongs to. A link to a mitreden
 * Sammlung opened here used to *succeed*: importBoard() sends JSON that is not
 * a Sicherung to the talker's OBF reader, which read a list of sentences as a
 * board with no buttons and made an empty five-key set out of it. Nonsense, and
 * silent — the worst pair.
 *
 * So the shelf path takes what it knows and nothing else: a Sicherung, or a
 * zip. That is narrower than the file picker, which must go on reading a bare
 * .obf written by other AAC software; a link from our own shelf never points at
 * one of those.
 */
async function forUs(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  // "PK", where every zip starts and no JSON does.
  if (head[0] === 0x50 && head[1] === 0x4b) return true;
  try {
    return (JSON.parse(await file.text()) as { format?: unknown })?.format === BACKUP_FORMAT;
  } catch {
    return false;
  }
}

/**
 * Reads the address, and where it names a Sammlung, puts it on screen.
 *
 * Never rejects. It runs at the end of the boot chain, where a rejection would
 * be read as the page having failed to load — and this failing is a message,
 * not a broken page: whatever was already there is still there.
 */
export async function openNamed(here?: string): Promise<void> {
  const asked = here === undefined ? await wanted() : await wanted(here);

  switch (asked.kind) {
    case "none":
      return;
    case "unknown":
      status(t("ui.shelf_unknown"));
      return;
    case "offline":
      status(t("ui.shelf_offline", { error: reason(asked.error) }));
      return;
    case "file":
      if (!await forUs(asked.file)) {
        status(t("ui.shelf_elsewhere"));
        return;
      }
      status(t("ui.shelf_fetching"));
      try {
        status(adopted(await adopt(asked.file, asked.id)));
      } catch (error) {
        status(refusal(error));
      }
  }
}
