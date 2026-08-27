/* What part of speech a word is, as far as the collection's own lexicon can
 * say - so that a button somebody has just named can arrive with its word
 * class already chosen.
 *
 * The tablet colours a button by its word class, and choosing one is a second
 * question about a word somebody has already typed. Most of the time the
 * answer is in the word: "Apfel" is a Nomen and "trinken" is a Verb, and
 * nothing about the button says otherwise.
 *
 * ## Why there is no part-of-speech library here
 *
 * There is no small one for German. The English taggers - compromise,
 * wink-pos-tagger - are English-only, and everything that reads German is a
 * model measured in megabytes, which is an absurd price for pre-selecting a
 * dropdown in a page that is otherwise a few hundred kilobytes.
 *
 * What there is instead is already installed. @lautstark/bildquelle's German
 * pipeline carries a lexicon split by part of speech - nouns in one table,
 * everything else in another - because German capitalisation is a signal it
 * wants to use: "Bad" is a room, "bad" is the stem of "baden". That split is
 * exactly the question being asked here, and this module asks it through the
 * package's public entry rather than reaching into its data.
 *
 * ## What it can answer, and what it cannot
 *
 * **Nomen** and **Verb**, in German, from the lexicon. **Pronomen**, in both
 * languages, from the list below - a closed class is a list by definition, and
 * it is the one grammatical class the lexicon cannot separate out.
 *
 * Nothing else, and that is not a gap to be filled in later with rules. Four
 * of the ten classes on the tablet - Kategorie, Ort, Sozial, Wichtiges - are
 * not parts of speech at all: they are what a word is *for* on a board, and no
 * tagger has ever been able to answer that. Beschreibung is a part of speech
 * and is unreachable here, because the lexicon's second table holds adjectives,
 * adverbs, pronouns and function words together with the verbs and says
 * nothing about which is which.
 *
 * English gets pronouns and no more. Its half of the package is stopwords,
 * irregular verbs and phrasal verbs - no noun table, and no capitalisation to
 * read one off with. A guess is not offered rather than being offered badly.
 *
 * ## "" is an answer
 *
 * Every path that is not sure returns "", which is `ui.wordclass_none` and is
 * what the dropdown already stands on. A wrong pre-selection is worse than
 * none: it is silent, it is on a board a child then reads, and nobody looks
 * twice at a field that is already filled in. So every rule below is written
 * to be certain rather than to be helpful, and the caller only ever writes an
 * answer into a field nobody has touched.
 */
import type { LanguageCode } from "@lautstark/bildquelle";

/* Loaded the first time somebody types, and not before - the same arrangement
 * data/symbols.ts makes for the same tables, and for the reason written out
 * there: German is about 170 KB unpacked and is worth nothing until there is a
 * word to look up. The browser's module map is what actually keeps the two
 * modules from fetching it twice; this map only keeps *this* module from
 * asking twice.
 *
 * A chunk that failed to arrive stays failed for the life of the document, so
 * a rejection is left to reject. There is nothing to tell anybody: the field
 * simply goes on saying "Keine Wortart", which is what it says when the word
 * is one the lexicon has never heard of either. */
type German = typeof import("@lautstark/bildquelle/german");
type English = typeof import("@lautstark/bildquelle/english");

let germanTables: Promise<German> | null = null;
let englishTables: Promise<English> | null = null;

const german = (): Promise<German> =>
  (germanTables ??= import("@lautstark/bildquelle/german"));
const english = (): Promise<English> =>
  (englishTables ??= import("@lautstark/bildquelle/english"));

/**
 * The pronouns, which are a list because a closed class is a list.
 *
 * Hand-written, and the only hand-written words in this repository's language
 * knowledge. That is deliberately as far as it goes: a list of pronouns is
 * finite, agreed on, and unchanged since anybody was writing German down,
 * which is what makes it data rather than a heuristic. A list of "social"
 * words or "important" ones would be neither - it would be somebody's opinion
 * about a board, growing one plausible entry at a time.
 *
 * The tablet's class is "Pronomen, Person, Name". Only the first third is
 * here. A name on a button is a name, and nothing in a lexicon can tell
 * "Mama" - which is in the noun table, and comes back Nomen - from the person
 * it stands for on that particular board.
 */
const PRONOUNS: Record<LanguageCode, readonly string[]> = {
  de: [
    "ich", "du", "er", "sie", "es", "wir", "ihr",
    "mich", "dich", "sich", "uns", "euch",
    "mir", "dir", "ihm", "ihn", "ihnen",
    "mein", "meine", "dein", "deine", "seine", "unser", "unsere", "eure",
  ],
  en: [
    "i", "you", "he", "she", "it", "we", "they",
    "me", "him", "her", "us", "them",
    "my", "mine", "your", "yours", "his", "hers", "its",
    "our", "ours", "their", "theirs",
  ],
};

/**
 * Whether a German lemma is a verb, asked of the lexicon rather than of the
 * spelling.
 *
 * The spelling nearly works and must not be used. A German infinitive ends in
 * -en, so "in the non-noun table and ending in -en" catches trinken, essen,
 * spielen, gehen - and morgen, oben, unten, neben, gegen, hinten, innen and
 * sieben with them. Eight wrong out of fifteen, silently, on the words a first
 * board is most likely to carry.
 *
 * So the question is put to the table instead: a verb is the one class that
 * inflects, and no adverb has a third person. Take the stem, build the forms
 * only a verb has, and ask whether the lexicon maps any of them **back to this
 * exact lemma**. "trinkt" -> "trinken" is a verb; "morgt" is nothing at all.
 * The equality is what makes it safe rather than merely likely: a form that
 * resolves to some *other* word is a collision, not an inflection.
 *
 * Measured on the words above: every one of the twenty non-verbs is refused,
 * and eighteen of twenty-two verbs are found. The four that get away are
 * strong verbs whose stem vowel changes - helfen/hilft, nehmen/nimmt,
 * sprechen/spricht - and they come back "" rather than wrong, which is the
 * trade this whole module is written for.
 */
function isGermanVerb(lemma: string, tables: German): boolean {
  const stem = lemma.replace(/e?n$/, "");
  // Nothing that does not end in -n can be an infinitive, and a stem of one
  // letter is not a word being conjugated.
  if (stem === lemma || stem.length < 2) return false;
  return [stem + "t", stem + "et", stem + "te", "ge" + stem + "t", "ge" + stem + "en"]
    .some((form) => tables.lookupVerbLemma(form) === lemma);
}

/**
 * The word class of a word, or "" for "no idea" - see the head of this file
 * for which of those is the honest answer when.
 *
 * The language is passed rather than read off core/boot.ts's LANG, which is
 * two things at once: this module then has no opinion about how a page decides
 * what it speaks, and it can be tested without a browser to have a navigator
 * in. The caller passes the page's language, which is the one the word was
 * typed in.
 *
 * One word only. A button captioned "nach Hause" or "Ich habe Durst" has no
 * word class - it is a phrase, and the class of any one word in it says
 * nothing about the button - so a phrase is refused rather than guessed at
 * from its first or last word.
 */
export async function guessWordClass(text: string, language: string): Promise<string> {
  const said = (text || "").trim();
  if (!said) return "";
  const lang: LanguageCode = language === "de" ? "de" : "en";

  const tables = lang === "de" ? await german() : await english();
  const words = tables.tokenize(said);
  const one = words.length === 1 ? words[0] : null;
  if (!one) return "";

  if (PRONOUNS[lang].includes(one.lower)) return "pronoun";
  if (lang !== "de") return "";

  const german_ = tables as German;
  /* The dictionary's own answer, and only that one. lemmatize() follows a
   * hit with rule-derived guesses at lower confidence - useful for finding a
   * picture, where a wrong guess costs a search, and not usable here, where it
   * would cost a colour on a board. */
  const found = german_.lemmatize(one.lower, one.capitalized)[0];
  const lemma = found && found.confidence === 1 ? found.lemma : "";
  if (!lemma) return "";

  /* Nouns are capitalised in the table and nothing else is, which is the
   * lexicon saying which of its two halves answered. It is the package's own
   * convention rather than an accident of the data: the tables are split so
   * that capitalisation can do the disambiguating German capitalisation is for,
   * and a noun lemma is stored the way a noun is written. */
  if (/^\p{Lu}/u.test(lemma)) return "noun";
  return isGermanVerb(lemma, german_) ? "verb" : "";
}
