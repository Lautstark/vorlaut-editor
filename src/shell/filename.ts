/* What a download is called, which is not what a key is called.
 *
 * data/store.ts's safeName() maps every character it cannot keep to `_`, and
 * that is right for the job it was written for: a picture's key has to come
 * back out of a Sicherung and an .obz spelled exactly as it went in, so a key
 * is mapped rather than spelled. A file name has neither half of that. Nothing
 * reads it back, and the person it is for reads it - so mapping is all cost. A
 * Sammlung called "MetaTalkDE 3x5 (haeufige Woerter)", written with the
 * umlauts somebody actually types, arrived as `h_ufige_W_rter`: the name with
 * holes punched through the middle of its words.
 *
 * **One function was doing both jobs, and only one of them wanted the holes.**
 * That is the whole of the change here. safeName() keeps every byte of its
 * behaviour, because a key that spells itself differently after this file
 * exists is a picture that stops being found; what moved is the three export
 * filenames, which had no stake in it.
 *
 * conventions.md §5 #3 pairs `slug`/`safeName` with `touched()`, and this is
 * the half safeName is not - mitreden's and bildhaft's are download-filename
 * sanitisers, and this repository's one true equivalent was a store key's. The
 * table below is mitreden's, character for character (its core/ids.ts), so
 * that the shared one which eventually replaces all three has a
 * transliteration to inherit rather than three to choose between. What is
 * deliberately not inherited is mitreden's shape around it: it lowercases,
 * joins on `-` and cuts to six words, because its slugs are ids that a talker
 * may already hold. These are file names on somebody's disk, so they keep the
 * case and the separator the export filenames have always had.
 *
 * Its own file, for the reason data/changed.ts is its own file: it is small,
 * all three products want it, and a file makes the day it earns a package a
 * move rather than an excavation.
 */

/** What a letter is spelled as where it cannot be written.
 *
 *  mitreden's table, unchanged. `ae` and not `a` is the entire point: German
 *  spells the umlaut out when it cannot draw it, so "Woerter" is a word
 *  somebody recognises and "Worter" is not one. */
const SUBSTITUTE: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", ß: "ss", é: "e", è: "e",
};

/** The same table for a capital, derived rather than written out a second
 *  time. mitreden lowercases before it looks and a file name keeps the case
 *  somebody typed, so this is the one thing that has to be added to its table
 *  rather than copied from it - and deriving it is how the two cannot drift.
 *
 *  A capital spells into `Oe` and not `OE`: one letter is capital, and the
 *  letter it opens out into is not the start of a second word. */
const spelled = (ch: string): string => {
  const direct = SUBSTITUTE[ch];
  if (direct) return direct;
  const lower = SUBSTITUTE[ch.toLowerCase()];
  return lower ? lower[0]!.toUpperCase() + lower.slice(1) : ch;
};

/** A Sammlung's name as the stem of the file it is downloaded as.
 *
 *  Spelled first, then swept by exactly safeName()'s rule - so everything the
 *  table has no letter for still becomes `_`, and a name in a script this
 *  table has never heard of is no worse off than it was. The two steps are in
 *  that order for the obvious reason and it is worth saying anyway: swept
 *  first, there is nothing left to spell.
 *
 *  No fallback for the empty string, unlike mitreden's. Every caller here
 *  comes through collections.ts's nameOf(), which has already answered
 *  ui.collection_unnamed for a name nobody typed - in the language the page is
 *  in, which is the other half of it. A fallback here would be a second answer
 *  to a settled question, and the one that won would be the one written in no
 *  language at all. */
export const downloadSlug = (name: string): string =>
  [...name].map(spelled).join("").replace(/[^\w.-]+/g, "_");
