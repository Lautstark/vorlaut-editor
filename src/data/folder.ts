import { Ablage } from "@lautstark/sicherung/ablage";
import type { Adoption } from "@lautstark/sicherung/ablage";

/**
 * The boards in a folder, rather than only in this browser.
 *
 * A household keeps its boards *either* in IndexedDB *or* in a folder it chose —
 * never in both as sources, so there is never a second truth to reconcile. Where
 * a folder is connected it is the truth and IndexedDB is a copy of it: read
 * wholesale on start, written to on every edit, and served read-only while the
 * folder is out of reach. See sicherung's adr/0001.
 *
 * Two kinds go and four stay, and the line between them is the same one every
 * Lautstark product draws. `settings` is this device's setup. `marks` is which
 * board is open here and which was last built to a talker here — both about this
 * machine, and both wrong on another. `symbols` and `speech` are caches: pictures
 * fetched again in a moment and sentences a voice makes again for nothing, so
 * paying sync for them would be paying for something free.
 */

export const KINDS = ["sammlungen", "layouts"] as const;
export type Kind = (typeof KINDS)[number];

/** The name every Lautstark programme files under; this one's is `HOME/vorlaut/`. */
export const HOME = "Lautstark";
export const APP = "vorlaut";

export const ablage = new Ablage({ app: APP, kinds: KINDS });
export const supported = Ablage.supported;

export const isStore = () =>
  ablage.status.kind !== "off" && ablage.status.kind !== "unsupported";
export const isStale = () => ablage.status.kind === "stale";

/**
 * How far a delete-everything would reach.
 *
 * Three answers rather than a boolean, because the sentence differs in each.
 * With a folder as the store the files go, so they go on every device the
 * household has — and with the folder out of reach a wipe would empty this
 * browser while the folder kept everything and handed it back on the next
 * start. That one is refused rather than asked. The three sibling products grew
 * the same function on 2026-09-02.
 */
export const wipeReaches = (): "browser" | "folder" | "unreachable" =>
  !isStore() ? "browser" : isStale() ? "unreachable" : "folder";

/** The folder's own name, for a sentence that has to point at it. */
export const folderName = (): string =>
  "folder" in ablage.status ? ablage.status.folder : "";

/* A write reaches the folder only where the folder is the store, and never while
   it is stale — a copy that took writes nobody else can see would be the second
   source of truth this arrangement exists to avoid. */
const canWrite = () => isStore() && !isStale();

/* Every change here happens inside one transaction over several stores — a
   registry row and its layout move together, on purpose — and reaching into that
   to file each record would put a folder write inside a transaction that has to
   stay open. So a change is mirrored afterwards, wholesale.

   Through `writeAll`, so a folder that goes out of reach partway stops the batch
   instead of running silently to the end writing nothing. */
export async function pushKind(
  kind: Kind,
  records: { id: string; updatedAt: number }[],
): Promise<void> {
  if (!canWrite()) return;
  const there = new Map((await ablage.list(kind)).map((item) => [item.id, item.updatedAt]));
  const here = new Set(records.map((record) => record.id));
  await ablage.writeAll(kind, records.filter((r) => there.get(r.id) !== r.updatedAt));
  for (const id of there.keys()) if (!here.has(id)) await ablage.remove(kind, id);
}

export const readKind = <T>(kind: Kind) => ablage.all(kind) as Promise<T[]>;
export const adopted = () => ablage.adopted();
export const adopt = (
  all: Record<string, { id: string; updatedAt: number }[]>,
): Promise<Adoption> => ablage.adopt(all);

/* Somebody else's edit, arriving as a file that changed under this browser. */
export const watchFolder = (onChange: () => void) =>
  ablage.watch(30_000, (found) => {
    if (found.length) onChange();
  });
