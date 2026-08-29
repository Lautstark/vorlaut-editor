/* Opening a Sammlung that the address names.
 *
 *     …/vorlaut-editor/?sammlung=erste-woerter
 *
 * A link on lautstark.tech/sammlungen/ that lands somebody here with the
 * Sammlung already in front of them, instead of: download a file, find it
 * again, open the settings, press „Sammlung einlesen".
 *
 * ## The address carries an id, never a URL
 *
 * `?von=https://…` would have been fewer lines here and is the version not to
 * write. It turns a link into "fetch whatever this says and import it", and an
 * imported Sammlung is content a child then reads. With an id there is one
 * place it can come from, the worst a crafted link does is name something that
 * is not there, and SHELF below is the only address involved.
 *
 * The id is checked against the same shape the shelf's own check enforces, so
 * nothing that could climb out of that path reaches the fetch at all.
 *
 * ## What it does to the page
 *
 * Exactly what pressing „Sammlung einlesen" does — adopt.ts is shared with it,
 * deliberately. The import is a *copy*: the new Sammlung has nothing to do with
 * the published one afterwards, and a later change on the shelf never reaches
 * it. That is the same promise the file import makes.
 *
 * The parameter is taken out of the address as soon as it has been read, so a
 * reload is a reload and not a second copy.
 */

import { status } from "./dom.js";
import { adopt, adopted, refusal } from "./adopt.js";
import { t } from "../core/texts.js";
import { reason } from "../core/errors.js";

/* The one address this file knows. Written here rather than passed in: a
 * parameter would be a way for something else to decide where a Sammlung comes
 * from, which is the whole thing the id is for. */
const SHELF = "https://lautstark.tech/sammlungen/download";

/** The shape the shelf gives an entry, so that nothing else can be asked for. */
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The parameter, gone from the address bar but not from the history. */
const forgetHere = (url: URL): void => window.history.replaceState(null, "", url);

/**
 * Reads the address, and where it names a Sammlung, puts it on screen.
 *
 * The address and the forgetting are arguments with the live ones as defaults,
 * rather than two reaches for `window` inside. That is what lets the id check
 * below be tested at all: this repository's unit tests run in node, where there
 * is no window, and adding a DOM to them to reach one regex would be the tail
 * wagging the dog.
 *
 * Never rejects. It runs at the end of the boot chain, where a rejection would
 * be read as the page having failed to load — and this failing is a message,
 * not a broken page: whatever was already there is still there.
 */
export async function openNamed(
  here: string = window.location.href,
  forget: (url: URL) => void = forgetHere,
): Promise<void> {
  const address = new URL(here);
  const wanted = address.searchParams.get("sammlung");
  if (!wanted) return;
  address.searchParams.delete("sammlung");
  forget(address);

  if (!ID.test(wanted)) {
    status(t("ui.shelf_unknown"));
    return;
  }

  status(t("ui.shelf_fetching"));
  try {
    const answer = await fetch(`${SHELF}/${wanted}.json`);
    // 404 is the ordinary case — an entry that has been renamed or retired —
    // and it deserves its own sentence rather than a status code.
    if (answer.status === 404) { status(t("ui.shelf_unknown")); return; }
    if (!answer.ok) throw new Error(`HTTP ${answer.status}`);

    /* A File rather than the blob, so that importBoard() is reached the way
     * the file input reaches it. The name matters: it is the fallback a
     * Sicherung that carries none would be called, and it is what the person
     * would have seen had they downloaded it themselves. */
    const file = new File([await answer.blob()], `${wanted}.json`, { type: "application/json" });
    status(adopted(await adopt(file, wanted)));
  } catch (error) {
    // Told apart because they are different things to do about it: the shelf
    // could not be reached, or it answered with something that would not go in.
    status(error instanceof TypeError
      ? t("ui.shelf_offline", { error: reason(error) })
      : refusal(error));
  }
}
