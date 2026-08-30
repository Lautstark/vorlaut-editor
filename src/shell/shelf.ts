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
      status(t("ui.shelf_fetching"));
      try {
        status(adopted(await adopt(asked.file, asked.id)));
      } catch (error) {
        status(refusal(error));
      }
  }
}
