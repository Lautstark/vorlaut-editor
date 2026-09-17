// Picking a symbol: searching the collection the open Sammlung is drawn in,
// resolving a hit to what a layout stores, uploading an image of your own, and
// saying which collection that was and what is owed for it.
//
// Which sources are available is bildquelle's answer, not a variable of ours.
// Which of them is offered is the Sammlung's - see offeredSource().
//
// ## There is no dialog here any more
//
// This module was a modal - a search field, a grid of results, a credit line -
// and every caller opened it on top of whatever they were doing. Both editors
// now carry the picture, its search and the upload in the left column of the
// sheet a press opens, so the modal had no way in and nothing to do. What is
// left is what the callers could not have written for themselves and must not
// each own a copy of: which source is offered, what an empty answer means, the
// fact that an ARASAAC pick is a download while a METACOM one is a reference,
// and the sentence the licence requires. See shell/pieces/Pick.svelte,
// which is the only thing that draws any of it now.
//
// The name survives the dialog because the job did: this is still where a
// symbol is picked. What went is one way of asking.
import { readSettings, pickSymbol, uploadSymbol } from "../backend/index.js";
import { reason } from "../core/errors.js";
import * as symbols from "../data/symbols.js";
import { drawnFrom } from "../data/app_package.js";
import { state } from "../core/state.js";
import { t } from "../core/texts.js";
import {
  homeSymbolUrl, homeWord, takeHomeSymbol,
} from "./homekey.js";
import { needsAttention } from "@lautstark/bildquelle";
import type {
  Candidate, ProviderId, ProviderStatus, SymbolProvider,
} from "@lautstark/bildquelle";

/* --- The seam ------------------------------------------------------------
 *
 * Three operations, so that a caller can put the search where it is standing.
 * Both editors do: a second modal over a modal to choose a symbol is the
 * dialog this design set out to remove, and removing it is what left this file
 * as the seam alone. What a caller must not do is carry a second copy of the
 * reasoning below; only the markup is the caller's. */

/* A hit is bildquelle's own `Candidate` now, and there is no vorlaut shape in
 * front of it.
 *
 * `SymbolHit` was `Awaited<ReturnType<typeof symbols.searchIn>>[number]` - the
 * decorated shape, carrying a resolved picture URL, a folder hint for repeated
 * labels and whichever identifier the pick step needed, `ref` for METACOM and
 * `id` for ARASAAC. The grid is `@lautstark/bildquelle/svelte/SymbolSearch`
 * now: it asks the provider for each picture itself, counts the repeats as it
 * draws, and hands a `Candidate` straight back to `onpick`. So the three
 * things decorate() carried are each derived where they are used -
 * captionFor() below for the hint, takeSymbol() for the reference - and the
 * shape in between is the package's. */

/**
 * Which collection the picker offers - the open Sammlung's, and only failing
 * that the machine's.
 *
 * "One symbol source per package" is a rule of the format, not a preference:
 * exchange/SPEC.md §5.1, with a licence behind it, and app_package.ts's
 * symbolSource() refuses to build a mixed one. What used to be asked here was
 * symbols.activeSource(), which is a setting of this *browser* - so a second
 * child set up on ARASAAC, or a folder handle that lapsed over a restart,
 * silently changed what the next button added to a METACOM Sammlung came from.
 * The board went mixed and nothing said so until the export, hundreds of
 * syntheses later.
 *
 * So the Sammlung is asked first. It already knows: the answer is derived from
 * the buttons rather than stored beside them, which is why there is no
 * per-Sammlung setting for it and should not be. A source that could be
 * flipped would invite flipping it, and flipping it means replacing every
 * symbol on the board - a deliberate act, and nobody has asked for one.
 *
 * Two Sammlungen defer to the machine rather than to themselves, and they are
 * the same case: one with no symbols yet, and one holding nothing but
 * uploaded pictures. An upload counts towards no source - a photograph of a
 * grandmother is not a symbol collection - so both read as "none", which is
 * the value that says no attribution is owed and nothing has been decided.
 *
 * A Sammlung that is already mixed defers too. It cannot be exported until it
 * is put right, and refusing to search inside it would take away the one
 * place it could be put right from.
 */
export function offeredSource(): ProviderId {
  /* What the Sammlung says, before what it happens to hold.
   *
   * The two agree on every Sammlung that has pictures, so this changes nothing
   * for them; what it adds is the one the reading below cannot answer. A
   * Sammlung with no pictures yet used to follow whatever this machine was set
   * to, which meant switching the machine between two presses built a mixed
   * board out of them. An intention has a memory that a derivation does not. */
  const said = state.layout.symbolSource;
  if (said === "arasaac" || said === "metacom") return said;

  /* Nobody has said, which is every Sammlung written before the field existed.
   * Read it off the board, exactly as it was read before. */
  const drawn = drawnFrom(state.layout);
  if (drawn.metacom.length && !drawn.arasaac.length) return "metacom";
  if (drawn.arasaac.length && !drawn.metacom.length) return "arasaac";
  return symbols.activeSource();
}

/** Whether the picker is offering a collection it cannot currently reach.
 *
 * Only ever the Sammlung's doing: readSettings() refuses "metacom" when no
 * folder is connected, so the machine setting can never land here. A METACOM
 * Sammlung opened in a browser that has not been given the folder back can,
 * and that is the moment the mixed board used to be built - the search quietly
 * answered from ARASAAC and every picture taken from it was the odd one out. */
const outOfReach = (source: ProviderId): boolean =>
  source === "metacom" && !symbols.metacomReady();

/** What to say about it, and what to do: the folder is remembered and wants a
 *  click, or there is none here at all. Both sentences send somebody to the
 *  gear, and the first names the browser prompt that stops it being asked
 *  again. `ui.metacom_needed` is in front of whichever it is, because neither
 *  of them says the thing that matters here - that this Sammlung's symbols
 *  come from METACOM and a picture from anywhere else would mix it. */
function folderWanted(): string {
  const status = symbols.metacomStatus();
  const waiting = status.kind === "needs-setup" && status.code === "permission-needed";
  return `${t("ui.metacom_needed")} ${waiting ? t("ui.metacom_waiting") : ""}`.trim();
}

/**
 * Whether a folder that is not answering is one a click could wake.
 *
 * Two states look alike from here and are not: a folder nobody has chosen, and
 * one this browser was given and has since reset its permission for - which it
 * does between visits, without being asked. Only the second has a way back in
 * that does not involve going and finding the folder again.
 *
 * **Narrower than bildquelle's `needsAttention`, and built out of it.** That is
 * the package's answer to "is this somebody's to act on", and it counts a
 * folder that could not be *read* as well - a path that has gone, an empty
 * directory. Those are things to act on and are not things a permission prompt
 * mends, so a button offering to would promise something it cannot do. What is
 * left after the narrowing is this app's question, but the half both share is
 * asked once, in the package that knows what the states mean. Written out here
 * it agreed with `needsAttention` on the day it was written and would have
 * drifted from it silently on any day after.
 *
 * A rule over what the provider says rather than a reach into it, so that it
 * can be held to plain objects in tests/unit/picker_reconnect.test.ts. The
 * distinction is the whole of what the button promises.
 */
export const canReconnect = (status: ProviderStatus): boolean =>
  needsAttention(status) && status.kind === "needs-setup";

/** The way back in, where there is one.
 *
 * Only where the folder is remembered and the browser wants a click. With no
 * folder at all there is nothing to re-grant - somebody has to go and pick one,
 * which is the gear, and the sentence beside this already says so.
 *
 * The same words the Sammlung's own panel uses, out of the same key. A second
 * wording for one act is how two places come to describe the same button
 * differently. */
export function wayBackIn(): SymbolAct | null {
  if (!canReconnect(symbols.metacomStatus())) return null;
  return {
    label: t("ui.symbol_source_reconnect"),
    // The browser's prompt needs the gesture that started this, so the call is
    // the handler's own and nothing is awaited in between.
    run: () => symbols.reconnectMetacom(),
  };
}

/** A finished search: the hits, and the sentence that says what kind of answer
 *  they are - which of the two silences an empty one was, or that a full grid
 *  is a grid of near misses.
 *
 *  Packaged together rather than left to the caller, because the difference is
 *  the part that is easy to get wrong: a provider's search() must not throw,
 *  so ARASAAC answers [] for a failed fetch as well as for a word it does not
 *  have, and "nothing found" is the wrong sentence for a browser with no
 *  network. */
/**
 * Something to do about an answer, offered beside the sentence that explains
 * it.
 *
 * One case so far, and it is the case this exists for: this Sammlung's symbols
 * come from METACOM, the folder is remembered, and the browser has reset its
 * permission between visits. The sentence used to send somebody to the gear -
 * close the sheet, find the panel, press the button that chooses a folder, come
 * back - for a thing that is one browser prompt away.
 *
 * A label and a promise rather than an element, so that the seam stays what it
 * was: this module says what is true and what could be done, and sheet.svelte.ts
 * decides what a button looks like. The promise answers whether anything
 * changed, because the only thing worth doing afterwards is running the search
 * again - and a refusal must not.
 */
export interface SymbolAct {
  label: string;
  run(): Promise<boolean>;
}

/* `SymbolAnswer` is gone, and what replaced it is four questions asked
 * separately.
 *
 * It was one object - hits, the sentence for an empty answer, what could be
 * done about it, the line above near misses, and the prescribed house - and it
 * was that shape because one function ran the search and one component drew
 * everything that came back. The component runs the search now. So the hits
 * and whether there are none are the component's, and each of the other three
 * is asked at the point it is drawn: `emptyLine`, `wayBackIn` and `nearLine`
 * from the snippet after the tiles, `homeFor` from the one before them.
 *
 * What is not lost is the reasoning, which was never in the shape: telling a
 * word the collection does not have apart from a browser that never managed to
 * ask, keeping near misses and saying what they are, and offering the house
 * whatever the collection answered. */

/** The prescribed start-key picture, ready to draw and ready to take.
 *
 * A shape of its own rather than a SymbolHit, and the difference is worth the
 * type. A hit is something a collection answered with and carries whichever
 * identifier its source needs resolving by; this was decided once, for both
 * collections, and already knows what a press stores. Squeezing it into a hit
 * would put a "and also this one is special" flag through takeSymbol(), which
 * is the seam that must stay the plain reading of what each source hands back.
 */
export interface HomeSuggestion {
  /** A URL for `<img src>`. */
  url: string;
  /** What the tile is called, on the tile and to a reader. */
  caption: string;
}

/* --- Whether the grid means the word --------------------------------------
 *
 * A search that finds nothing says so. A search that finds the wrong thing
 * used to look exactly like one that found the right thing: twelve tiles, all
 * confident. Searching "nicht" in METACOM is the case that showed it - every
 * hit a rendering of "nichtbinaer", and the picture somebody wanted nowhere on
 * the screen. Nothing said so, and only somebody who already knew the
 * collection could tell.
 *
 * "METACOM has no 'nicht' symbol at all and never will" is what this said, on
 * the reasoning that German AAC negates by crossing a symbol out rather than
 * with a picture of its own. The crossing out is true and is why a key can be
 * crossed here at all; the conclusion drawn from it was not. METACOM files the
 * negation pair under Kleine_Worte as "nichtkein": two words that mean the
 * same thing in that position, run together because a filename cannot hold
 * the slash between them. Since bildquelle 1.6.4 reads that spelling as the
 * pair it is, it scores 70 and comes first. So this line
 * now goes quiet for that search because the collection really does answer it.
 *
 * bildquelle grades every candidate on one ladder, the same for both sources:
 * the label is the word (100), begins with it as a phrase (70), holds it as
 * one of its words (60), begins with it (55), has a word beginning with it
 * (40), or merely contains it (25). See scoreLabel() in bildquelle's text.ts.
 */

/**
 * Where a hit stops being a hit: the whole word.
 *
 * Not 100. "Nothing matches exactly" is a claim about spelling and this is a
 * claim about pictures - a collection that files the picture as "trinken
 * wasser" has a picture for "trinken", and a reader told otherwise would go
 * looking for a second one that does not exist. 60 is the rung where the word
 * typed is still a word the label is made of, and 70 above it is the same
 * thing with the word at the front.
 *
 * The rung below is where it stops. 55 is "nichtbinaer" for "nicht": a
 * different word that happens to start the same way, and the whole of the
 * case this exists for. 40 and 25 are less again.
 */
const WHOLE_WORD = 60;

/**
 * What ARASAAC adds on top of the ladder for a symbol drawn for AAC use.
 *
 * ARASAAC's rank() does not hand back the ladder score. It hands back the
 * ladder plus a preference for pictograms flagged aacColor (12) and aac (8),
 * minus penalties for schematic, explicit and whole-phrase artwork, minus half
 * a point per place in ARASAAC's own ordering. Read as a match grade that is
 * one number too many: a word-prefix at 40 on a flagged pictogram arrives as
 * 60 and would pass a ladder threshold, which is the "nichtbinaer" answer
 * again with the other collection's name on it.
 *
 * So the preference comes back off before the score is read as a grade, and at
 * its maximum. A bonus is a reason to show one picture before another; it is
 * not evidence that the word matched. Everything else in that sum only
 * subtracts, so what is left can understate the ladder but never overstate it
 * - the direction that matters, because understating shows a line above
 * results that stay, and overstating is the silence this is here to end.
 *
 * bildquelle's, not ours, and not exported by it. If it moves, this
 * over-warns rather than going quiet, and tests/unit/picker_match.test.ts
 * searches a live provider rather than a made-up score, so it moves too.
 */
const AAC_PREFERENCE = 20;

/** The ladder grade a hit carries, once its source's own ranking is off it.
 *
 *  Which source that is comes from offeredSource() rather than off the hit: a
 *  `Candidate` is the package's shape and carries no source, because it only
 *  ever comes back from one provider and the caller is the one that chose it.
 *  The decorated shape used to write it onto every hit, which was a per-hit
 *  copy of an answer that is the same for all of them. */
const gradeOf = (hit: Candidate, source: ProviderId): number =>
  source === "arasaac" ? hit.score - AAC_PREFERENCE : hit.score;

/** Whether any of these pictures is a picture of the word that was typed.
 *
 * Any, not the first: the sources sort by their own score, and ARASAAC's is
 * not the grade this reads. Both collections, and deliberately not METACOM
 * alone - a search is a search, and ARASAAC misses the same way.
 *
 * The word itself is not compared here. What the grade answers to is the word
 * bildquelle actually looked the collection up with, which after lemmatising
 * "Hunde" or splitting "Handtuch" is not always the word typed - and a
 * collection that holds the lemma does hold the picture. */
const matchesWord = (hits: readonly Candidate[]): boolean => {
  const source = offeredSource();
  return hits.some((hit) => gradeOf(hit, source) >= WHOLE_WORD);
};

/**
 * The source the picker searches, as the component holding the field wants it.
 *
 * `SymbolSearch` is handed a `SymbolProvider` and asks it three things: the
 * hits for a word, a picture URL per hit, and what is owed for the collection.
 * Two of those are the real provider's and pass straight through. The one that
 * is not is the search, and everything findSymbols() used to decide sits in
 * here:
 *
 * - **The pipeline.** symbols.searchIn() lemmatises, tokenises and splits
 *   compounds before it asks the collection - that is what finds a picture for
 *   "Hunde" and for "Handtuch" - where a provider's own search() takes the word
 *   as typed. The component has to go through this one or the page loses German.
 * - **A collection that cannot be reached answers nothing.** Answering from the
 *   other one is what must not happen: a hit taken from ARASAAC into a METACOM
 *   Sammlung is a key it can no longer export. So the search is not run at all,
 *   and emptyLine() below is the one click that fixes it.
 * - **It must not throw.** That is the interface's rule, and searchIn()
 *   deliberately does - there is no second collection behind it, so swallowing
 *   left the page saying "nichts gefunden" whether the collection held nothing
 *   or the browser never managed to ask. So the reason is kept rather than
 *   dropped: onFailure is how it reaches the sentence, because all the
 *   component can see is that the answer was empty.
 *
 * The caller owns the object for the life of one sheet, which is also how long
 * the answers below stay true: the offered source is read as the sheet is
 * built, and a sheet is never handed a second one.
 */
export function searchProvider(onFailure: (error: unknown | null) => void): SymbolProvider {
  const source = offeredSource();
  const under = symbols.providerFor(source);
  let latest = 0;
  return {
    id: under.id,
    name: under.name,
    /* What is owed for the collection being searched, computed from the source
       and not from the results - so a search that found nothing still says
       where the pictograms come from. The package's own notice is in it
       verbatim; what creditLine() puts in front of that is this product's
       sentence about the same source, which adds to the licence line and never
       stands in for it. */
    get attribution() { return creditLine(); },
    status: () => under.status(),
    isReady: () => under.isReady(),
    getImageUrl: (id) => under.getImageUrl(id),
    labelFor: (id) => under.labelFor(id),
    async search(word: string): Promise<Candidate[]> {
      /* The component holds a stale-answer guard and drops hits that are not
         the current ones; the reason travels beside the hits rather than with
         them, so it needs the same guard or a slow failure lands on top of a
         fast empty answer and calls it a broken search. Same mechanism, one
         layer down. */
      const mine = ++latest;
      const said = (error: unknown | null) => { if (mine === latest) onFailure(error); };
      if (outOfReach(source)) { said(null); return []; }
      try {
        const hits = await symbols.searchIn(source, word);
        said(null);
        return hits;
      } catch (error) {
        said(error);
        return [];
      }
    },
  };
}

/**
 * What an empty answer was, as a sentence.
 *
 * The same four cases findSymbols() picked between, asked at the point the
 * sentence is drawn. `failure` is what searchProvider()'s onFailure handed
 * back: the error where the search threw, null where it did not.
 */
export function emptyLine(word: string, failure: unknown | null): string {
  if (failure !== null) return t("ui.search_failed", { error: reason(failure) });
  const source = offeredSource();
  if (outOfReach(source)) return folderWanted();
  return symbols.statusOf(source).kind === "ready"
    ? t("ui.nothing_found", { word })
    : t("ui.search_no_answer", { word });
}

/**
 * The line above hits that answer something other than what was typed, or ""
 * where one of them really is the word.
 *
 * The near misses are kept whatever they turn out to be. Somebody searching
 * "nicht" may well want nichtbinaer, and the nearest thing the collection holds
 * is the best answer there is to give - it is being taken for something else
 * that was the fault. So they stay, and this says what they are.
 */
export const nearLine = (word: string, hits: readonly Candidate[]): string =>
  !word || !hits.length || matchesWord(hits) ? "" : t("ui.search_near", { word });

/**
 * The tile's name, and the one thing the twins need.
 *
 * METACOM ships parallel rendering folders holding identical file names, so a
 * search can answer four tiles that all say "ja" and differ only in picture.
 * That the labels collide is the component's to notice and it does - `among` is
 * its answer, counted over what is on screen exactly as decorate() used to
 * count it. What the disambiguator *is* stays this product's: the folder the
 * picture sits in, said the way a person would.
 *
 * It goes to aria-label and title, which is where it has always gone here -
 * bildhaft disambiguates in visible text and this page does not, and §6.4
 * records the two as a convergence rather than a difference. Display only
 * either way: the caption must not leak into the reference, and
 * `candidate.label` stays clean because applySymbol may write it onto the key.
 */
export function captionFor(candidate: Candidate, among: boolean): string {
  if (!among || offeredSource() !== "metacom") return candidate.label;
  const folder = symbols.folderOf(candidate.id, symbols.metacomRoot());
  return folder ? `${candidate.label} - ${folder}` : candidate.label;
}

/** The prescribed house for this collection, where the collection can be
 *  reached at all. Whether the *word* asks for one is asksForHome(), which is
 *  synchronous and is asked first, so this is not run for every search.
 *
 * Silent about everything that goes wrong. There is no sentence to write: the
 * search itself already says whatever there is to say about an unreachable
 * METACOM folder or a browser with no network, and a second line about a tile
 * nobody asked for would be the picker explaining a feature instead of
 * answering a search. So an unresolvable picture simply is not offered. */
export async function homeFor(): Promise<HomeSuggestion | null> {
  try {
    const url = await homeSymbolUrl(offeredSource());
    return url ? { url, caption: homeWord() } : null;
  } catch {
    return null;
  }
}

/** The prescribed house, taken - the same act the tiles beside it perform, in
 *  the one shape both collections already answer to. Throws what the download
 *  throws, exactly as takeSymbol() above does, and for the same reason: a
 *  caller that asked for this one picture has somewhere to say so. */
export const takeHome = (): Promise<{ symbol: string; label: string }> =>
  takeHomeSymbol(offeredSource());

/** A hit, resolved to what a layout stores: a reference and the collection's
 *  own word for it. Throws, because a caller that asked for this one symbol
 *  has somewhere to say so. */
export async function takeSymbol(item: Candidate): Promise<{ symbol: string; label: string }> {
  const source = offeredSource();
  if (source === "metacom") {
    // Nothing to fetch and nothing to copy: the layout holds the reference
    // and the picture stays in the licensed folder, which is the whole of
    // the METACOM rule. The browser resolved it, so the server is not asked.
    //
    // Worked out here rather than carried on the hit. decorate() computed it
    // for all twenty-four tiles as the grid was drawn and one of them at most
    // is ever pressed; the id it is computed from is bildquelle's path inside
    // the chosen folder, which is what the component hands back.
    return {
      symbol: symbols.pickReference(item.id, symbols.metacomRoot()),
      label: (item.label || "").trim(),
    };
  }
  // ARASAAC still goes through the server, and this is the one place the page
  // has not left it. The reference an ARASAAC pick *should* become is its id -
  // that is the decision in docs/symbol-search.md - but build.py resolves a
  // symbol by looking in symbols/, so writing an id today would produce
  // layouts the build cannot build. The download stays until the build itself
  // moves into the browser, and then this branch goes - and with it the last
  // symbol call behind the seam.
  const result = await pickSymbol({
    source,
    id: item.id,
    label: item.label || "",
  });
  return { symbol: result.symbol, label: (result.label || "").trim() };
}

/** Somebody's own picture, stored and handed back as a reference.
 *
 * A Blob and a name rather than the File the two of them used to arrive in,
 * because what is kept is no longer always what was chosen: a picture that
 * went through the square is a PNG the page has just drawn and has no name of
 * its own. The name still comes from the file either way, so the key in the
 * store is still recognisably somebody's photograph - safeName() in
 * data/store.ts owns what becomes of it from there.
 */
export async function uploadOwn(picture: Blob, name: string): Promise<string> {
  const result = await uploadSymbol(picture, name);
  return result.symbol;
}

// Which sources exist is no longer fixed at start: METACOM arrives when a
// folder is chosen and leaves when it is forgotten, both without a reload. So
// this runs again whenever the provider says something changed.
/* Which of them the picker offers is a setting, and this is what reads it.
 *
 * Nothing did: the only caller of loadSettings() is the settings sheet
 * opening, so until somebody pressed the gear the page ran on the "arasaac"
 * that symbols.ts starts life with. A METACOM chosen last visit was searched
 * as ARASAAC, the field said ARASAAC, and both quietly changed their mind the
 * first time the sheet was opened.
 *
 * Read rather than remembered, and read again whenever the folder's state
 * changes, because the answer is derived from it: readSettings() only hands
 * back "metacom" once the collection actually answers. That is not a
 * technicality on Chromium - a stored folder handle usually comes back
 * needing its permission re-confirmed, so at load there is honestly no
 * collection and METACOM only exists a click later. Reading once at boot
 * would have been right about that moment and wrong from then on. */
async function adoptSource() {
  try {
    const settings = await readSettings();
    symbols.setActiveSource(settings.activeProvider || "arasaac");
  } catch {
    // A search still works, on the source that needs no folder. This runs
    // unawaited from start(), so a throw here would be nobody's to catch.
  }
}

export async function loadSources() {
  // Before the subscription and not through it: a folder that is not there
  // sends no notification, and that case still has a setting to honour.
  await symbols.restoreMetacom();
  await adoptSource();
  symbols.subscribeMetacom(() => void adoptSource());
}

/** Which collection is being searched, as the words a search field wears.
 *
 * Read by the pick column as it is built, which is why nothing has to repaint
 * it: a sheet that is not open has no stale field in it, and a sheet that is
 * opening asks this afresh. Five calls to a showSources() existed to keep the
 * dialog's copy of this honest, and all five went with the dialog. */
export const searchPlaceholder = (): string =>
  t(offeredSource() === "metacom" ? "ui.search_metacom" : "ui.search_arasaac");

/** What is owed for the collection being searched, as one line.
 *
 * Read the same way, with more riding on it: ARASAAC is CC BY-NC-SA and the
 * wording is a condition of the licence, so wherever its pictures are shown
 * this sentence has to be shown too. The place that is now is the pick column
 * of whichever sheet is open - and, standing rather than per-screen, the
 * ARASAAC panel in Einstellungen, which draws the same notice from the same
 * package.
 *
 * The notice itself is not written here and is not in the text table: it comes
 * from the package that owns the provider - a translated paraphrase beside it
 * is how the two drifted apart, and the copy that was here had lost both
 * arasaac.org and the Regierung von Aragón. METACOM returns nothing, on
 * purpose: it is the user's own licensed copy and owes no notice.
 *
 * Ours to say, and only where it applies: that METACOM is referenced rather
 * than copied, or - when it is not the source - that a licence somebody owns
 * could be one. Nobody opens settings to find that out, so it is said where
 * they are standing.
 *
 * Three cases and not two, because "no collection" was covering a state it has
 * no business covering. A folder chosen last visit comes back needing its
 * permission re-confirmed - routine on Chromium, where the grant is scoped to
 * the site rather than to the app - and the line asked somebody who had
 * already set METACOM up whether they happened to own a licence. The remedy is
 * a click, so the sentence names it, and names the answer in the browser's own
 * prompt that stops it being asked again.
 */
export function creditLine(): string {
  // The one source the picker is offering, which is the Sammlung's before it
  // is the machine's. A key already on the board may have come from the other
  // one - a Sammlung mixed before the picker followed it still opens - but
  // what is owed here is owed for what is on this screen.
  const source = offeredSource();
  const owed = symbols.attributionFor([source]).join(" ");
  const status = symbols.metacomStatus();
  const waiting = status.kind === "needs-setup" && status.code === "permission-needed";
  const ours = source === "metacom"
    // Owed nothing, so the whole line is ours: either the note that these
    // pictures are referenced rather than copied, or - the fourth case, and
    // the one the mixed board was built through - that the collection this
    // Sammlung is drawn in is not reachable from this browser yet.
    ? (outOfReach(source) ? folderWanted() : t("ui.credits_metacom"))
    : waiting ? t("ui.metacom_waiting")
    : symbols.metacomReady() ? "" : t("ui.metacom_offer");
  return `${ours} ${owed}`.trim();
}
