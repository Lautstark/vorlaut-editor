import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "./harness.js";

import * as facts from "../../src/device/layout_facts.js";
import {
  SLOTS_PER_SET, HASH_BYTES, LANGUAGE_CODES, DEFAULT_LANGUAGE,
  SLEEP_MIN, SLEEP_MAX, SLEEP_DEFAULT,
} from "../../src/device/layout_facts.js";
import { normalizeLayout } from "../../src/data/obf.js";
import {
  DEVICE_SAMPLE_RATE, DEVICE_CHANNELS, DEVICE_BITS_PER_SAMPLE,
} from "../../src/data/audio_format.js";

/* Every device fact this repository holds a copy of, against the fixtures.
 *
 * This was the builder's half of tests/unit/device_fixtures.test.ts, and it is
 * what the split left of it. The other half - renderLayoutBin() against the
 * .bin files, the tile geometry, the name hash, the cable transcripts - reads
 * modules that are in Lautstark/vorlaut-diy-talker now, and stayed there with
 * them. Nothing was dropped: each side kept the checks for the code it holds.
 *
 * **It is also the successor to ALLOWED_FROM_SRC.** tests/unit/layers.test.ts
 * used to hold the editor to exactly eight names it might import out of
 * loader/, and called that list "the bill for the split". A list of forbidden
 * imports has nothing to read once the two directories are in two
 * repositories - it would match nothing and report eight names and be green
 * for ever, which is the failure mode this repository has been bitten by
 * twice. So the enumeration moved here, where it can still be wrong: what was
 * a list of names the editor may *import* is now a list of facts the editor
 * holds a *copy* of, and each one names the fixture that is its authority.
 * The property worth keeping is unchanged - adding a name costs an edit and an
 * argument - and it is stronger, because a copy nothing checks is worse than
 * an import.
 *
 * **Where the authority is.** device/fixtures/ belongs to neither
 * implementation of the device format (adr/0009) and both implementations are
 * in the other repository (adr/0012). This one is a third consumer, pinned
 * under third_party/, and pinning is consumption rather than ownership. The
 * numbers below are not asserted here; they are read out of the fixtures and
 * the copy is compared against them.
 *
 * What is asked, fact by fact:
 *
 *   SLOTS_PER_SET     the stride every layout fixture was laid out from
 *   HASH_BYTES        names.expected.json's hash_bytes, and the hash width in
 *                     every accepted layout
 *   LANGUAGE_CODES    language.expected.json's table
 *   DEFAULT_LANGUAGE  the same file's default_code and default_index
 *   SLEEP_*           sleep.expected.json's min, max and default, and that
 *                     everything normalizeLayout() emits is inside the range
 *
 * Plus the three audio numbers a writer is bound by, which are src/'s own and
 * are checked against the audio fixtures for the same reason.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, "..", "..", "third_party", "vorlaut-diy-talker",
                         "device", "fixtures");

/* The pin, before anything reads out of it. A clone without
 * `git submodule update --init` leaves the directory empty, and every check
 * below would otherwise fail on a missing file with no hint of why. */
const pinned = existsSync(join(FIXTURES, "index.json"));
check("the pinned device fixtures are checked out", pinned,
      pinned ? FIXTURES.slice(FIXTURES.indexOf("third_party"))
             : "run `git submodule update --init` - see third_party/README.md");
if (!pinned) throw new Error("device/fixtures/ is not checked out");

const readJson = (name: string) =>
  JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));

const index = readJson("index.json");
const listed: any[] = index.fixtures;

check("the fixture index is there and lists something",
      Array.isArray(listed) && listed.length > 0,
      `${listed?.length} fixtures, device interface ${index.device_interface_version}`);

const expectations = new Map<string, any>(
  listed.map((one) => [one.fixture, readJson(one.expected)]));

/** Which fixtures of one kind, in the index's order. */
const ofKind = (kind: string) =>
  listed.filter((one) => one.kind === kind)
        .map((one) => ({ listed: one, want: expectations.get(one.fixture) }));

/** Every layout fixture the reader accepts, as its `read` half. */
const accepted = ofKind("layout")
  .map(({ want }) => want.read)
  .filter((read) => read?.result === "ok" && Array.isArray(read.entries));

// --- four keys to a set ------------------------------------------------------

/* Read out of the fixtures rather than written here beside the constant it is
 * checking. Every set in every accepted layout has the same number of slots,
 * because that is the stride the file is laid out on - a table with a
 * different one would not parse at the length the fixture states. */
{
  const widths = new Set<number>();
  for (const read of accepted) {
    for (const entry of read.entries) widths.add(entry.slots.length);
  }
  check("every accepted layout has one slot count", widths.size === 1,
        `${[...widths].join(", ")} across ${accepted.length} layouts`);
  check("and SLOTS_PER_SET is it",
        widths.size === 1 && SLOTS_PER_SET === [...widths][0],
        `${SLOTS_PER_SET} against the fixtures' ${[...widths].join(", ")}`);
}

// --- sixteen bytes of hash ---------------------------------------------------

{
  const want = expectations.get("names");
  check("HASH_BYTES is the width names.expected.json states",
        HASH_BYTES === want.hash_bytes, `${HASH_BYTES} bytes`);

  /* And the same number again from the other end: every image and audio hash
   * in an accepted layout is that many bytes of hex. The fixture states the
   * rule; the .bin files are laid out by it. */
  const widths = new Set<number>();
  for (const read of accepted) {
    for (const entry of read.entries) {
      for (const slot of entry.slots) {
        widths.add(slot.image.length / 2);
        widths.add(slot.audio.length / 2);
      }
    }
  }
  check("every hash in an accepted layout is that many bytes",
        widths.size === 1 && [...widths][0] === HASH_BYTES,
        `${[...widths].join(", ")} bytes`);
}

// --- the language enumeration ------------------------------------------------

{
  const want = expectations.get("language");
  const table = Object.fromEntries(
    want.languages.map((l: any) => [l.code, l.index]));

  check("the editor's language table is the fixture's",
        JSON.stringify(LANGUAGE_CODES) === JSON.stringify(table),
        JSON.stringify(LANGUAGE_CODES));
  check("and its default is the fixture's default",
        DEFAULT_LANGUAGE === want.default_code
        && LANGUAGE_CODES[DEFAULT_LANGUAGE] === want.default_index,
        `${DEFAULT_LANGUAGE} is ${LANGUAGE_CODES[DEFAULT_LANGUAGE]}`);

  /* What a writer does with a language it has no index for is the fixture's
   * business too, and this end's half of it is one step earlier than the byte:
   * normalizeLayout() is what a foreign document goes through, and what comes
   * out has to be a language the table holds. Which index byte 7 then gets is
   * renderLayoutBin()'s, in the other repository. */
  const foreign = ["kw", "", "de-DE", "EN", "xx-yy", "12"];
  const escaped = foreign.filter((code) =>
    !Object.hasOwn(LANGUAGE_CODES,
                   normalizeLayout({ language: code, sets: [] }).language));
  check("a language the table has no index for is normalised to one it has",
        escaped.length === 0, escaped.join(", ") || `${foreign.length} tried`);
}

// --- the sleep timeout -------------------------------------------------------

{
  const want = expectations.get("sleep");

  check("the editor's sleep range is the fixture's",
        SLEEP_MIN === want.min && SLEEP_MAX === want.max
        && SLEEP_DEFAULT === want.default,
        `[${SLEEP_MIN}, ${SLEEP_MAX}], default ${SLEEP_DEFAULT}`);

  /* The device waits exactly what it is given inside that range, and the
   * fixture is where that is stated rather than layoutIdleSeconds(), which is
   * the other repository's. This is what makes the range worth holding: a
   * value the editor emits inside it is a wait somebody chose. */
  const inside = want.cases.filter((one: any) =>
    typeof one.sleep_seconds === "number"
    && one.sleep_seconds >= SLEEP_MIN && one.sleep_seconds <= SLEEP_MAX);
  const surprises = inside.filter((one: any) =>
    one.idle_seconds !== one.sleep_seconds);
  check("every timeout inside that range is waited exactly, per the fixture",
        inside.length > 0 && surprises.length === 0,
        surprises.map((one: any) =>
          `${one.sleep_seconds} became ${one.idle_seconds}`).join("; ")
        || `${inside.length} cases`);

  /* And the gate, which is this end's whole responsibility. renderLayoutBin()
   * does not clamp - it writes what it is handed - so normalizeLayout() is the
   * only thing between a foreign document and a talker that sleeps at a time
   * nobody chose. Inputs no fixture lists, including the ones a foreign
   * document actually arrives with. */
  const arrivals: unknown[] = [
    undefined, null, 0, 1, 5, 9, 10, 11, 600, 3600, 86400, 86401,
    4294967, 4294967295, -1, -86400, 0.5, 600.7, "600", "1e3", "0x10",
    "not a number", "", true, false, {}, [], NaN, Infinity, -Infinity,
  ];
  const loose: string[] = [];
  for (const given of arrivals) {
    const raw: Record<string, unknown> = { sets: [] };
    if (given !== undefined) raw.sleep_timeout_seconds = given;
    const emitted = normalizeLayout(raw).sleep_timeout_seconds;
    if (!Number.isInteger(emitted) || emitted < SLEEP_MIN || emitted > SLEEP_MAX) {
      loose.push(`${JSON.stringify(given) ?? String(given)} became ${emitted}`);
    }
  }
  check("every timeout the editor emits is inside the fixture's range",
        loose.length === 0,
        loose.join("; ") || `${arrivals.length} foreign values`);
}

// --- a<hash>.wav -------------------------------------------------------------

/* Not one of the seven, and here for the same reason they are: three numbers a
 * writer is bound by, stated by a fixture and implemented in src/. The
 * reader's tolerance for them is the other repository's half. */
for (const { listed: one, want } of ofKind("audio")) {
  if (!want.write) continue;
  const w = want.write;
  check(`${one.fixture}: the editor writes ${w.sample_rate} Hz, `
        + `${w.channels} channel, ${w.bits_per_sample}-bit`,
        DEVICE_SAMPLE_RATE === w.sample_rate
        && DEVICE_CHANNELS === w.channels
        && DEVICE_BITS_PER_SAMPLE === w.bits_per_sample,
        `${DEVICE_SAMPLE_RATE} Hz, ${DEVICE_CHANNELS} channel, `
        + `${DEVICE_BITS_PER_SAMPLE}-bit`);
}

// --- the enumeration itself --------------------------------------------------

/* The half of ALLOWED_FROM_SRC that was never about imports.
 *
 * Its comment said a name left on the list without a live argument is the
 * boundary quietly closing again. The same sentence holds here with one word
 * changed: a device fact copied into this repository with nothing holding the
 * copy is the duplicate quietly growing. So the file is enumerated, and a name
 * added to it without a line here fails rather than passes.
 *
 * Every entry names the fixture that is its authority, in the fixture's own
 * words, so that "which fixture says so?" is answerable by reading rather than
 * by grepping. */
{
  const PINNED = new Map<string, string>([
    ["SLOTS_PER_SET", "device/fixtures/layout/* - the stride they are laid out on"],
    ["HASH_BYTES", "device/fixtures/names.expected.json - hash_bytes"],
    ["LANGUAGE_CODES", "device/fixtures/language.expected.json - the table"],
    ["DEFAULT_LANGUAGE", "device/fixtures/language.expected.json - default_code"],
    ["SLEEP_MIN", "device/fixtures/sleep.expected.json - min"],
    ["SLEEP_MAX", "device/fixtures/sleep.expected.json - max"],
    ["SLEEP_DEFAULT", "device/fixtures/sleep.expected.json - default"],
  ]);

  const exported = Object.keys(facts).sort();
  const unheld = exported.filter((name) => !PINNED.has(name));
  check("every device fact the editor copies is held against a fixture",
        unheld.length === 0,
        unheld.length
          ? `${unheld.join(", ")} - add it above with the fixture that says so`
          : `${exported.length} names, ${new Set([...PINNED.values()]
              .map((one) => one.split(" - ")[0])).size} fixtures`);

  const stale = [...PINNED.keys()].filter((name) => !exported.includes(name));
  check("and nothing is listed here that the editor no longer holds",
        stale.length === 0, stale.join(", ") || `${PINNED.size} listed`);
}
