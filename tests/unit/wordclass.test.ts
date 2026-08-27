import { describe, expect, it } from "vitest";
import { guessWordClass } from "../../src/data/wordclass.js";
import { WORD_CLASSES } from "../../src/core/boot_data.js";

/* What the editor is allowed to fill a word class in from.
 *
 * The value of a guess is not how often it is right. It is that it is never
 * wrong: the answer is written into a field nobody has touched, on a board
 * somebody else reads, and a field that is already filled in is a field nobody
 * looks at twice. A word class left at "Keine Wortart" costs one press. A
 * button coloured as a verb because it happens to end in -en costs a colour
 * that says something untrue, quietly, for as long as that board exists.
 *
 * So this file is written the other way round from most: the refusals are the
 * assertions that matter, and the words it finds are the ones that make the
 * refusals worth having.
 *
 * `-en` is the whole reason the verb test is what it is. A German infinitive
 * ends in -en, so "in the lexicon's non-noun table and ending in -en" reads
 * like a verb test and is not one: morgen, oben, unten, neben, gegen, hinten,
 * innen and sieben are all in that table and none of them is a verb. They are
 * in NOT_VERBS below, and they are why the module asks the lexicon to map an
 * inflected form back to the exact lemma instead.
 */

/* Every answer this module may give. It hands back a key from the tablet's own
 * list or "", and a key that is not on that list would reach the dropdown,
 * match no option and leave the control standing on nothing. Read out of
 * boot_data rather than core/boot.ts, which wants a navigator to have a
 * language on. */
const CLASSES = new Set(["", ...WORD_CLASSES.map((one) => one.key)]);

const de = (word: string) => guessWordClass(word, "de");
const en = (word: string) => guessWordClass(word, "en");

const NOUNS = ["Apfel", "Hund", "Mama", "Papa", "Schule", "Toilette", "Wasser",
               "Brot", "Auto", "Musik", "Bett", "Hilfe", "Schmerzen"];
const VERBS = ["trinken", "essen", "spielen", "gehen", "lesen", "malen", "singen",
               "kommen", "machen", "waschen", "tragen", "halten", "weinen",
               "lachen", "kuscheln", "schlafen", "sehen"];
const NOT_VERBS = ["morgen", "oben", "unten", "sieben", "neben", "gegen",
                   "hinten", "innen", "eben", "draußen", "zusammen", "wegen"];
const PRONOUNS = ["ich", "du", "wir", "mein", "sie"];

describe("what German words the lexicon can place", () => {
  it("finds the nouns", async () => {
    for (const word of NOUNS) {
      expect(await de(word), word).toBe("noun");
    }
  });

  it("finds the verbs, in the infinitive and inflected", async () => {
    for (const word of VERBS) {
      expect(await de(word), word).toBe("verb");
    }
    // The same word arriving conjugated, because a button may well say
    // "trinkt". lemmatize() is what puts it back, and the class is the lemma's.
    expect(await de("trinkt")).toBe("verb");
    expect(await de("gespielt")).toBe("verb");
  });

  it("finds the pronouns, which are a list because a closed class is one", async () => {
    for (const word of PRONOUNS) {
      expect(await de(word), word).toBe("pronoun");
    }
    expect(await en("you")).toBe("pronoun");
    expect(await en("they")).toBe("pronoun");
  });
});

describe("what it refuses, which is the part that has to hold", () => {
  it("does not call a word a verb for ending in -en", async () => {
    for (const word of NOT_VERBS) {
      expect(await de(word), word).not.toBe("verb");
    }
  });

  it("says nothing about an adjective, an adverb or a word it has not met", async () => {
    // Beschreibung is a real word class and is unreachable: the lexicon's
    // second table holds adjectives, adverbs and function words together with
    // the verbs and says nothing about which is which. Silence, not a guess.
    for (const word of ["schnell", "müde", "traurig", "jetzt", "nochmal",
                        "Kaugummiautomat", "wuppdi"]) {
      expect(await de(word), word).toBe("");
    }
  });

  it("says nothing about a phrase, whichever words are in it", async () => {
    // A button captioned "Ich habe Durst" has no word class. Neither the first
    // word nor the last one is the button.
    expect(await de("nach Hause")).toBe("");
    expect(await de("Ich habe Durst")).toBe("");
    expect(await de("")).toBe("");
    expect(await de("   ")).toBe("");
  });

  it("offers English nothing but its pronouns", async () => {
    // No noun table, no capitalisation to read one off with, and no verb
    // lexicon: the English half of the package is stopwords and irregulars.
    // A guess is not offered rather than being offered badly.
    for (const word of ["apple", "drink", "water", "run", "fast"]) {
      expect(await en(word), word).toBe("");
    }
  });
});

describe("every answer is one the dropdown has an option for", () => {
  it("stays inside the tablet's own list of classes", async () => {
    for (const word of [...NOUNS, ...VERBS, ...NOT_VERBS, ...PRONOUNS,
                        "schnell", "nach Hause", ""]) {
      expect(CLASSES.has(await de(word)), `${word} -> ${await de(word)}`).toBe(true);
    }
  });
});
