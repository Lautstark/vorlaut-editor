/* Taking a file in as a new Sammlung, and what to say when it will not go.
 *
 * Extracted from settings.ts's wireImport(), which was the only caller until
 * shelf.ts arrived. Two callers doing this in two places is how the second one
 * ends up forgetting addSymbols() — and a Sammlung whose pictures never landed
 * is a board of grey crosses that looks like the file was wrong.
 *
 * The order below is load-bearing and is settings.ts's, unchanged:
 *
 *   read → create the Sammlung → add the pictures → open it → draw
 *
 * The pictures come after the Sammlung and never before. They are the only part
 * of this that writes outside the new Sammlung, so a failure higher up must not
 * leave them behind on their own.
 */

import { createCollection, importBoard, useCollection } from "../backend/index.js";
import { addSymbols, NOT_ONE, TOO_NEW } from "../data/backup.js";
import { load } from "../core/save.js";
import { paintCollections } from "./collections.js";
import { t } from "../core/texts.js";
import { reason } from "../core/errors.js";

/** What a Sammlung that has just landed is called, and how many pictures came
 *  with it — everything a caller needs to say so. */
export interface Adopted {
  name: string;
  pictures: number;
}

/**
 * A file in, a Sammlung on screen.
 *
 * `fallback` is the name to use where the file carries none: the file's own,
 * minus its extension, for the one somebody picked off a disk. An .obz names
 * every board in it and the document not at all, so it always falls through; a
 * Sicherung names the Sammlung, and that name is the better one.
 */
export async function adopt(file: File, fallback: string): Promise<Adopted> {
  const read = await importBoard(file);
  const name = read.name.trim() || fallback.trim() || t("ui.collection_name");

  const id = await createCollection(name, read.layout);
  const pictures = await addSymbols(read.symbols);
  await useCollection(id);
  await load();
  await paintCollections();

  return { name, pictures };
}

/** What just happened, in one line. */
export const adopted = ({ name, pictures }: Adopted): string => pictures
  ? t("ui.collection_imported_pictures", { name, n: pictures })
  : t("ui.collection_imported", { name });

/**
 * Why it would not go in.
 *
 * The two codes data/backup.ts throws, and everything else as itself. A file
 * from a later vorlaut and a file holding nine Sammlungen are different
 * problems with different answers, and "import failed" for both is a dead end.
 */
export function refusal(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === TOO_NEW) return t("ui.data_too_new");
  if (code === NOT_ONE) {
    const count = (error as { count?: number }).count ?? 0;
    return count ? t("ui.collection_many", { n: count }) : t("ui.collection_empty");
  }
  return t("ui.collection_failed", { error: reason(error) });
}
