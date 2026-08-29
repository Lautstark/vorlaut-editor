/** One notifier, next to the writes.
 *
 * Every write that changes what a Sicherung would contain says so through
 * touched(), and the standing backup listens through onChanged(). That is
 * conventions.md §2.2, and the rule is about *where* the call goes rather than
 * about what it does: the alternative was calling schedule() from each place in
 * the interface that edits something, and it fails silently and identically in
 * all three products - somebody adds the thirteenth mutator next year, having
 * never heard of the backup, nothing goes red, and a child's talker quietly
 * stops being saved. Putting the notifier at the writes makes the rule local to
 * the thing it is about: a new mutator is in the same file as the line that
 * says what a mutator does.
 *
 * Its own file rather than a paragraph inside data/store.ts, because that is
 * what it is: ten lines that all three products want and none of them can
 * usefully vary. conventions.md §5 #3 said it rides along with the storage
 * work and does not earn a package of its own; a file is what makes the day it
 * does earn one a move rather than an excavation.
 *
 * **That day was 2026-08-29**, and this is what is left of the file. The Set is
 * @lautstark/werkzeuge/changed's - four copies across the three products, three
 * of them byte-identical - and what stays here is the instance and the name
 * every write in this repository already calls. The move is one line rather
 * than an edit to every writer in data/store.ts, which is the whole of what
 * the file bought.
 *
 * The other half of §5 #3 - `slug`/`safeName` - went with it and it was two
 * things rather than one. mitreden's and bildhaft's were download-filename
 * sanitisers; vorlaut had one function answering that and the store-key
 * question together, which is one question too many for a name with an umlaut
 * in it. safeName() in data/store.ts is the key's, beside the keys it makes,
 * and it did not move and must not; the download's is
 * @lautstark/werkzeuge/filename now, which shell/filename.ts was written to
 * become.
 */

import { changes } from "@lautstark/werkzeuge/changed";

const changed = changes();

/** Listen. The returned function stops listening. */
export const onChanged: (listener: () => void) => () => void = changed.onChanged;

/** Something a Sicherung carries has changed. Called by writes, never by the
 *  page: a call site in the interface is the failure this file exists against. */
export const touched: () => void = changed.touched;
