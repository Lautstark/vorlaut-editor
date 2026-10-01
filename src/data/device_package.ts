// A Sammlung as the device build's own .obz: sources, flags and 16 kHz WAVs.
//
// The third export door, and docs/obz-as-device-input.md is the measurement it
// comes out of. That document asked whether an .obz could be the input to the
// device build and answered yes - every gap between what runBuild() consumes
// and what the existing exports emit is a matter of form rather than of
// presence. This is that form, written down.
//
// ---------------------------------------------------------------------------
// Why a third door rather than a flag on one of the two
//
// exchange/SPEC.md §5.2, in as many words: an export that bakes pixels MUST be
// a separate entry point from the talker's, "a different function, not the
// same one behind a flag". obf.ts writes references and refuses METACOM
// pixels; app_package.ts writes a tablet's pixels; this writes a device's
// sources. Three functions, no shared entry point, and nothing here imports
// obf.ts - not even its grid(), which is twenty lines this file writes again
// on purpose. app_package.ts made the same copy for the same reason, and the
// reason is that a helper shared across that line is where a flag grows.
//
// adr/0010 is the decision, and it exists because three functions that all
// write .obz look exactly like one function with a parameter.
//
// ---------------------------------------------------------------------------
// Why this file is worth having at all
//
// It is the only thing that passes between the editor and the talker.
//
// It began as an artefact somebody could diff, archive or carry to a bench,
// beside a build that lived in IndexedDB and went down a cable from the same
// page. That build is gone from the editor - adr/0011 - and what is left is
// this: the editor writes the file, loader/ reads it, compiles it and sends
// it, and neither half knows the other exists. The reading half is the
// loader's alone - loader/src/device_package.ts and compileDevice() in
// vorlaut-diy-talker. A second reader stayed here after the split, with nothing
// but a test forbidding its import to call it, and went on 2026-10-01: a
// reader nobody runs is a second opinion about the format that nothing checks.
//
// device/fixtures/package/ is where the two halves are held to it, and they
// are held to it SEPARATELY: the writer must produce a package the fixtures
// state, the reader must read the fixtures' packages into the fixtures'
// answers, and neither runner ever sees the other's output. adr/0014 is why.
// Until 2026-08-27 the two were compared against each other in one process by
// tests/unit/device_roundtrip.test.ts, which was a better check and is one no
// repository will have after the split adr/0012 decided - the fixtures are
// what is left of it, and the reason they carry refusals no writer here emits.
//
// ---------------------------------------------------------------------------
// The four form rules, and what each one is
//
// 1. THE PICTURES ARE THE SOURCES. images/ holds what renderSymbol() needs,
//    not what a button needs, and that is the sentence the shape of an app
//    package hides. app_assets.ts fits a source into 512 through a canvas and
//    says so in its own first line - "Not the device's tile." Compiling a tile
//    out of that PNG resamples twice: for any pictogram larger than 512 the
//    result is provably not the pixels tiles.ts produces, fillColour() reads a
//    different edge, and the alpha has been through a canvas premultiply that
//    tiles.ts has hand-written helpers specifically to avoid. Every tile hash
//    would move and tests/reference/tiles.lock.json would be invalidated.
//
//    So the source travels unresampled, at its own size, in whatever format it
//    was stored in. There is no maximum here and there is deliberately none:
//    exchange/SPEC.md §5.3's 1024 cap is about a tablet's decoded bitmap heap,
//    and §1 of that document puts the talker's .obz outside its scope.
//
// 2. NEGATION IS A FLAG. negateInto() fills a hard-edged nine-pixel cross into
//    the composed tile without antialiasing, because a tile is compared byte
//    for byte against a frozen reference; crossOut() strokes an antialiased
//    one onto the tablet's PNG. Two different drawings on purpose. Baking
//    either into the source would put the wrong one on the device and would
//    make one reference two files for no gain, so ext_vorlaut_negated travels
//    and renderSymbol(source, { negated }) runs exactly as it runs today.
//
// 3. THE SOUND IS THE DEVICE'S WAV. adr/0008 settles it: both delivered
//    artefacts derive from the master and never from each other. That rule
//    forbids deriving the device's WAV from the package's Opus. It says
//    nothing against carrying the device's WAV, which is the master's own
//    child and already sits in the data store under its own name. So sounds/
//    holds a<hash>.wav - the bytes the cable would have sent - and adr/0008 is
//    satisfied by construction rather than by care.
//
// 4. THE LANGUAGE IS THE FIELD ITSELF. localeFor() in app_package.ts derives a
//    locale from the *voice*, because on Android the voice hint is nearly
//    always unavailable. layout.language is a different thing - the language
//    the device shows its own menu in, and the index into LANGUAGE_CODES that
//    becomes header byte 7. The two are not interchangeable. Here `locale` is
//    layout.language and nothing else, which is what obf.ts already writes.
//
// ---------------------------------------------------------------------------
// What it did NOT need, which is the part worth reporting
//
// No new ext_vorlaut_* field, and therefore no change to exchange/SPEC.md.
// Every field this profile needs was already being written by obf.ts:
// ext_vorlaut_negated on a button, ext_vorlaut_sleep_timeout_seconds and
// ext_vorlaut_voice on the root board. The rest is plain OBF - `locale`,
// images[].path, sounds[].path - and §1 of SPEC.md puts the talker's .obz out
// of its scope entirely, so none of §5.3's PNG-and-1024 rules reach here.
//
// It needs one for Slot.act, and since 2026-09-01 it writes it. That was a
// boundary and not an omission while it lasted: the three press modes the
// five-key editor offers - say it, say it and lead onward, lead onward - were
// two behaviours the firmware did not have, so writing them here would have put
// a package in front of loader/'s compileDevice() that it had never been asked
// to read, and what a talker did with it would have been decided by whichever
// half was updated second. **The other half arrived on 2026-08-31**, in
// vorlaut-diy-talker's adr/0020, and this is the wait ending rather than the
// rule being broken: `does` and `target` per key, the set key among them.
//
// What that cost while it lasted is worth knowing, because it is the shape of
// every boundary like it: a Sammlung authored with `weiter` keys compiled to a
// board where every key merely spoke, silently and correctly, and the person
// who set them had no way to find out. The wait was right and it was not free.
//
// data/app_package.ts is the door the same acts go through for the tablet.
//
// A marker field saying "this one is compilable" was considered and left out.
// The loader's reader refuses a package it cannot compile by looking at what is
// actually there - an image entry with no bytes behind it, a sound that is not
// a 16 kHz mono WAV - and a structural check beats a flag, because a flag can
// be written by a wrong writer too. docs/device-interface.md §6 is the reason
// it refuses rather than guesses: a key that says the wrong sentence is worse
// than one that says nothing, because it is said to somebody who believes it.
//
// ---------------------------------------------------------------------------
// The references travel too, beside the pixels
//
// images[] carries `symbol` as well as `path`. The pixels are what the
// compiler wants; the reference is what makes this file readable by everything
// that already reads a talker document - obf.importObz() takes its symbol out
// of that field, so a device export dropped into the import door comes back as
// the Sammlung it was rather than as a Sammlung with no pictures. Writing only
// `path` would have been a file that imports silently wrong, which is the one
// failure mode worse than refusing.

import { slotIsEmpty } from "./app_package.js";
import {
  DEVICE_BITS_PER_SAMPLE, DEVICE_CHANNELS, DEVICE_SAMPLE_RATE,
} from "./audio_format.js";
/* Two numbers and nothing else, and that is the whole of what this file needs
 * to know about the device at all. The tile renderer and the layout.bin
 * writer went to loader/src/compile.ts with compileDevice() - see adr/0011 -
 * so the editor writes a package for the talker without holding any of the
 * code that turns one into what the talker reads. What is left is the shape
 * of the device: four keys to a set, and sixteen bytes of hash in a name.
 * device/fixtures/ is the authority on both - pinned under third_party/ now
 * rather than sitting in this repository - and tests/unit/device_facts.test.ts
 * is what holds them to it. */
import { HASH_BYTES, SLOTS_PER_SET } from "../device/layout_facts.js";
import { zipBytes, type ZipMember } from "./zip.js";
import { PAGE_KEY, actOf } from "../core/types.js";
import type { DiyLayout, Slot, SlotAct } from "../core/types.js";

export const FORMAT = "open-board-0.1";
const MANIFEST = "manifest.json";

/** The symbol set a bare file name belongs to, and the one a "metacom:"
 *  reference does. The same two words obf.ts writes, because the field is read
 *  back by obf.importObz() and a third spelling would not round trip. */
const OWN_SET = "vorlaut";
const METACOM_SET = "metacom";

/** `a` + 32 hex + `.wav`: what layout.bin can carry and hashBytes() can read.
 *  A name of any other shape is refused rather than written, because
 *  hashBytes() throws on it at the far end of a build nobody is watching. */
const AUDIO_NAME = new RegExp(`^a[0-9a-f]{${HASH_BYTES * 2}}\\.wav$`);

/* ------------------------------------------------------------- reading --- */

/** What one press does, in the device interface's own three words.
 *
 * `Slot.act` is the editor's vocabulary and this is the file format's, and the
 * translation between them is devicePlan()'s and nowhere else's: `speak`,
 * `goto`, and `goto` carrying its word through become `speak`, `go` and
 * `speak-and-go`. data/app_package.ts makes the same translation into the
 * tablet's - `load_board` and `ext_lautstark_append_on_navigate` - which is
 * why neither of them is `Act` narrowed. */
export type DeviceDoes = "speak" | "speak-and-go" | "go";

/** The set index a key leads to, meaningless where it leads nowhere.
 *
 * A position and not a BoardSet.id, because that is what the file holds: one
 * byte, and the sets are written in order. The editor stores an id for the
 * reason BoardSet.id gives - a target that followed a drag would point
 * somewhere else after a reorder - and this is where the one becomes the
 * other, at the last moment before the bytes. A key naming a set that is no
 * longer there leads nowhere, which is `speak` and 0. */
export interface DeviceKey {
  text: string;
  /** The picture reference, "" for none. Not crossed out: see `negated`. */
  symbol: string;
  negated: boolean;
  does: DeviceDoes;
  target: number;
}

/** One of the four keys the file calls slots: a key, and whether it holds
 *  anything. The page key is a DeviceKey without `empty`, because the compiler
 *  never draws a blank for it. */
export interface DeviceSlot extends DeviceKey {
  /** slotIsEmpty(), asked once and carried.
   *
   *  Carried rather than re-derived at each of the three places that want it,
   *  because the three answering differently is precisely the divergence
   *  docs/obz-as-device-input.md §5 found: an untouched key was an empty cell
   *  on a tablet and a missing-picture cross on the device, and no test could
   *  see it because the paths never met. They meet here. */
  empty: boolean;
}

/** One set as `layout.bin` lays it out: a name, the page key, four slots.
 *
 * **The file's shape and not the editor's.** core/types.ts holds a page as
 * KEYS_PER_SET equal keys in reading order, which is what a person authors;
 * this is the same five in the order the format writes them - adr/0020 §1,
 * "the set key first, where the label hash sat, then the four speech keys" -
 * and `device/fixtures/layout/*` is laid out on it. devicePlan() below is the
 * one place the two orders meet, and keeping them apart is what stops a stride
 * in the file from deciding how a board reads on screen.
 */
export interface DeviceSet {
  name: string;
  /** The key on the page-key panel - core/types.ts's PAGE_KEY, which is a key
   *  like the other four since adr/0020. */
  key: DeviceKey;
  slots: DeviceSlot[];
}

/**
 * A Layout as the nine things runBuild() takes out of one, and nothing else.
 *
 * The one reading, asked by the export, by the compiler and by the build. What
 * makes it worth a type rather than three walks over `layout.sets` is that the
 * three walks are what drifted apart before.
 *
 * Slots are cut at SLOTS_PER_SET and are deliberately NOT padded up to it. A
 * short set is a set layout.bin writes zero hashes for, which is what the
 * device already does with one, and reproducing that faithfully is this file's
 * job - obf.ts's normalizeLayout() is where a short set gets padded, on the
 * way *in*, and correcting one here would make the export disagree with the
 * build it is meant to reconstruct.
 */
export interface DevicePlan {
  /** layout.language: the index into LANGUAGE_CODES, header byte 7. Passed
   *  through as it stands - renderLayoutBin() owns the fallback. */
  language: string;
  /** chosenVoice(layout): what every WAV is named for. The caller resolves it,
   *  because the fallback reads the shipped voice catalogue. */
  voice: string;
  sleepTimeoutSeconds: number;
  sets: DeviceSet[];
}

export function devicePlan(layout: DiyLayout, voice: string): DevicePlan {
  const sets = layout.sets ?? [];
  /* Where each set sits, so that a target stored as an id becomes the byte the
   * file holds. Built once for the whole layout rather than searched per key:
   * sixty-four sets and five keys each is a walk nobody needs to make 320
   * times. */
  const at = new Map<string, number>();
  for (const [index, set] of sets.entries()) {
    if (set?.id) at.set(set.id, index);
  }

  /** One act, in the file's words.
   *
   * A key naming a set that is not there leads nowhere and speaks instead. It
   * is the ordinary consequence of deleting a set that something pointed at,
   * not a corruption: the editor mints an id when a key first points at a set
   * and does not go hunting for the pointers when that set goes. Speaking is
   * the safe half of what the key was doing - a key that fell silent AND
   * stayed put would be a key that does nothing at all. */
  const acted = (act: SlotAct): { does: DeviceDoes; target: number } => {
    if (act.kind !== "goto") return { does: "speak", target: 0 };
    const target = at.get(act.set);
    if (target === undefined) return { does: "speak", target: 0 };
    return { does: act.alsoSpeak ? "speak-and-go" : "go", target };
  };

  /** One key, in the file's words. */
  const keyed = (slot: Slot | undefined) => ({
    text: String(slot?.text ?? ""),
    symbol: String(slot?.symbol ?? ""),
    negated: Boolean(slot?.negated),
    ...acted(actOf(slot ?? { text: "", symbol: "" })),
  });

  return {
    language: String(layout.language ?? ""),
    voice: String(voice ?? ""),
    sleepTimeoutSeconds: Number(layout.sleep_timeout_seconds ?? 0),
    sets: sets.map((set) => {
      const slots = set?.slots ?? [];
      /* The five keys, sorted into the two places the file keeps them. The
       * page key is the one on PAGE_KEY's panel and the other four follow it
       * in reading order - one table, in core/types.ts, and this is the only
       * place that reads it apart.
       *
       * **Nothing is computed here any more.** An absent `BoardSet.key` used
       * to mean the ring, and the ring was worked out at this line from where
       * a set happened to sit. It is targets in the file now - data/upgrade.ts
       * wrote every stored one out on the way to database version 6 - so a key
       * goes where it was pointed and a key pointed nowhere stays put, which
       * is what a joining game's question needs and what this line could not
       * express. */
      const page = keyed(slots[PAGE_KEY]);
      return {
        name: String(set?.name ?? ""),
        key: {
          ...page,
          // What the panel says, which is the key's own word or else the name
          // the firmware prints there - see PAGE_KEY.
          text: page.text || String(set?.name ?? ""),
        },
        slots: slots.filter((_, at) => at !== PAGE_KEY)
          .slice(0, SLOTS_PER_SET).map((slot) => ({
            ...keyed(slot),
            empty: slotIsEmpty(slot),
          })),
      };
    }),
  };
}

/* -------------------------------------------------------------- shapes --- */

/** One source picture, exactly as it is stored, un-resampled and un-crossed.
 *
 * Keyed by the reference alone rather than by pictureKey(): the cross is a
 * flag here (form rule 2), so a reference and the same reference crossed out
 * are one file in this archive where they are two in an app package. */
export interface DeviceSource {
  /** The content hash the member is named for. Computed by whoever read the
   *  bytes rather than here, because hashing is asynchronous and this half of
   *  the work is a pure function - the same division BakedImage makes. */
  key: string;
  bytes: Uint8Array<ArrayBuffer>;
  /** What the bytes actually are - "image/png", "image/jpeg", "image/svg+xml".
   *  Written into the entry rather than guessed from the reference, because a
   *  reference is a store key and somebody's upload keeps its own name. */
  contentType: string;
}

/** One spoken sentence as the device's own WAV, under the device's own name. */
export interface DeviceSound {
  /** a<hash>.wav, as runBuild() named it. The name travels rather than being
   *  re-derived here: the rule is text, voice, PIPELINE_VERSION and every
   *  option that changes how a sentence sounds, and it lives beside the
   *  synthesis in backend/local.ts where the options are. Carrying the name
   *  keeps that rule in one place and makes the compiler a copy. */
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}

export interface DeviceInput {
  layout: DiyLayout;
  /** The Sammlung this is, from the store's own CollectionRef.
   *
   * Passed in rather than derived: the layout does not know which Sammlung
   * holds it, and the whole point of the id is that it is stable across every
   * rename and every edit. See ext_lautstark_package_id on DeviceBoard. */
  collection: { id: string; name: string };
  /** chosenVoice(layout) - see DevicePlan.voice. */
  voice: string;
  /** Sources by reference. */
  sources: Map<string, DeviceSource>;
  /** WAVs by the sentence they say. */
  sounds: Map<string, DeviceSound>;
}

export interface DeviceImageEntry {
  id: string;
  /** Where the source lives in the archive - absent when the reference
   *  resolved to nothing, which is a gap the file records rather than hides.
   *  See putImage(). */
  path?: string;
  content_type?: string;
  /** The reference this picture came from, so the file still imports as a
   *  Sammlung. obf.symbolOf() reads exactly this. */
  symbol: { set: string; filename: string };
}

export interface DeviceSoundEntry {
  id: string;
  path: string;
  content_type: string;
  /** Seconds, off the WAV's own header. OBF has the field and a person
   *  reading the file at a bench has no other way to see the length. */
  duration: number;
}

export interface DeviceButton {
  id: string;
  label: string;
  vocalization?: string;
  image_id?: string;
  sound_id?: string;
  load_board?: { id: string; name: string; path: string };
  /** Slot.negated. Form rule 2 - the flag, not a baked cross. */
  ext_vorlaut_negated?: boolean;
  /** The key says its own word before it leads onward.
   *
   * `SlotAct`'s `alsoSpeak`, and exchange/SPEC.md's own field rather than an
   * `ext_vorlaut_*` one: the tablet writes the sibling
   * `ext_lautstark_append_on_navigate` for the same shape of button, and
   * saying the same thing twice in two namespaces is what adr/0001 keeps them
   * apart to avoid. Written only when true, so a key that merely leads onward
   * is the file it always was. */
  ext_lautstark_speak_on_navigate?: boolean;
}

export interface DeviceBoard {
  format: string;
  id: string;
  /** layout.language itself. Form rule 4. */
  locale: string;
  name: string;
  buttons: DeviceButton[];
  grid: { rows: number; columns: number; order: (string | null)[][] };
  images: DeviceImageEntry[];
  sounds: DeviceSoundEntry[];
  /** Root board only, both of them - a manifest is an index of a zip and gets
   *  rebuilt by any tool that touches it, whereas a board is the document.
   *  obf.ts puts them in the same place for the same reason. */
  ext_vorlaut_sleep_timeout_seconds?: number;
  ext_vorlaut_voice?: string;
  /** **Which Sammlung this is, and what it is called.**
   *
   * OBF identifies boards and never packages, which exchange/SPEC.md says
   * outright where it defines these two: "A package with three pages has three
   * names and no name." A device-shaped export had neither until 2026-09-01,
   * and both absences turned into faults the moment a talker could hold more
   * than one collection: without the id every export landed on the same file
   * on the device, because boardId() below calls every root board `set-1`;
   * without the name the talker's menu had only the first set's name to show.
   *
   * SPEC.md's own words rather than a third `ext_vorlaut_*` one for a thing
   * that already has one - adr/0001 keeps the namespaces apart because they
   * describe different things, and a package's identity is not a device-only
   * setting. On the board rather than in the manifest, which is where SPEC.md
   * puts them, for the reason above about manifests being rebuilt. */
  ext_lautstark_package_id?: string;
  ext_lautstark_package_name?: string;
}

export interface DeviceManifest {
  format: string;
  root: string;
  paths: {
    boards: Record<string, string>;
    images?: Record<string, string>;
    sounds?: Record<string, string>;
  };
}

export interface DevicePackage {
  manifest: DeviceManifest;
  boards: DeviceBoard[];
  /** Archive path -> bytes, for everything that is not a board document. */
  files: Map<string, Uint8Array<ArrayBuffer>>;
}

/* -------------------------------------------------------------- naming --- */

const boardId = (at: number) => `set-${at + 1}`;
export const boardPath = (id: string) => `boards/${id}.obf`;
const stemOf = (path: string) =>
  path.slice(path.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");

/** The extension a content type gets in the archive.
 *
 * The source keeps its own format, so the member has to say which one it is
 * twice: in content_type, which is the authority, and in the name, which is
 * what somebody running `unzip -l` reads. Anything unrecognised keeps .bin
 * rather than being refused - the compiler decodes by content type and an
 * archive member's extension decides nothing. */
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/**
 * What a source picture actually is, read out of its first bytes.
 *
 * The reference is a store key and an upload keeps whatever name its file had,
 * so the extension is not evidence - "grandma.png" is whatever somebody saved
 * under that name. The magic numbers are, and content_type is the field the
 * compiler decodes by, so getting it from the bytes is the only honest way.
 *
 * "application/octet-stream" for anything unrecognised rather than a refusal:
 * decoding is the host's, browsers take formats this list has never heard of,
 * and a source that will not decode draws the grey cross renderSymbol() draws
 * for every other unresolved picture. Refusing here would turn a key that says
 * nothing into an export that does not exist.
 */
export function sniffImageType(bytes: Uint8Array): string {
  const starts = (...magic: number[]) =>
    magic.every((byte, at) => bytes[at] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes.length > 12
      && [0x57, 0x45, 0x42, 0x50]
        .every((byte, at) => bytes[8 + at] === byte)) return "image/webp";
  // SVG is text and has no magic number, so it is recognised by its first
  // element - after everything XML allows in front of it. A declaration, a
  // comment and a DOCTYPE are all legal there, and all three are what a vector
  // program writes: Illustrator opens with a generator comment, and older
  // exports with <!DOCTYPE svg PUBLIC ...>. Looking only at the first bytes
  // answered octet-stream for those, and the device drew a grey cross for a
  // picture that was perfectly good. Only the prolog is skipped - a "<svg"
  // after any element is a string in some other document.
  return svgRoot(new TextDecoder().decode(bytes.slice(0, 4096)))
    ? "image/svg+xml" : "application/octet-stream";
}

/** Whether a text's first element is <svg>, past a BOM, whitespace, an XML
 *  declaration, processing instructions, comments and a DOCTYPE. A DOCTYPE
 *  with an internal subset is skipped bracket and all. */
function svgRoot(text: string): boolean {
  let at = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (;;) {
    while (at < text.length && /\s/.test(text[at]!)) at++;
    const rest = text.slice(at);
    if (rest.startsWith("<?")) {
      const end = text.indexOf("?>", at + 2);
      if (end < 0) return false;
      at = end + 2;
    } else if (rest.startsWith("<!--")) {
      const end = text.indexOf("-->", at + 4);
      if (end < 0) return false;
      at = end + 3;
    } else if (/^<!DOCTYPE/i.test(rest)) {
      const subset = text.indexOf("[", at);
      const close = text.indexOf(">", at);
      if (close < 0) return false;
      if (subset >= 0 && subset < close) {
        const end = text.indexOf("]", subset);
        if (end < 0) return false;
        const after = text.indexOf(">", end);
        if (after < 0) return false;
        at = after + 1;
      } else {
        at = close + 1;
      }
    } else {
      return /^<svg[\s>/]/.test(rest);
    }
  }
}

/** A short content hash, which is what a source is named for.
 *
 * Content rather than a counter, so the same picture on three keys is one
 * member of the archive - and so that an unchanged Sammlung exports to
 * unchanged bytes. Sixteen hex characters, matching app_package.digest(): this
 * is the *archive* member's name and never reaches layout.bin, where the
 * device's own 32-character tile hash goes. */
export async function digest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0"))
    .join("").slice(0, 16);
}

/**
 * The id an unresolved picture's entry carries.
 *
 * A resolved one is named for its content hash, which an unresolved one has
 * none of - there are no bytes. The reference itself is what is left, and it
 * is used with the characters an OBF id should not carry replaced. That
 * replacing can fold two references into one id, so putImage() claims it
 * rather than trusting it. It never names a member of the archive: there is
 * no member.
 */
const unresolvedId = (reference: string): string =>
  `none-${reference.replace(/[^A-Za-z0-9._-]+/g, "-")}`;

/** A reference split the way obf.ts splits it, so the field round trips. */
function splitReference(reference: string): { set: string; filename: string } {
  return reference.startsWith(`${METACOM_SET}:`)
    ? { set: METACOM_SET, filename: reference.slice(METACOM_SET.length + 1) }
    : { set: OWN_SET, filename: reference };
}


/* ---------------------------------------------------------------- WAVs --- */

export interface WavFormat {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** Bytes in the data chunk, which is what a length is worked out from. */
  dataBytes: number;
}

/**
 * What a RIFF/WAVE file declares about itself, or null if it is not one.
 *
 * The check audio_format.ts says nobody was making. Its own comment is that
 * the obligation runs one way - a writer MUST produce 16 kHz mono 16-bit, and
 * the device checks none of it, because seekToWavData() finds the data chunk
 * and plays whatever is in it at the rate I2S was started with. A file at
 * another rate is therefore not refused on the device, it is a word at the
 * wrong pitch. So the rule has to be kept on this side, and this is the first
 * place in this repository that keeps it.
 *
 * The chunks are walked rather than read at fixed offsets: a synthesiser is
 * entitled to write LIST or fact between fmt and data, and a reader that
 * assumed the canonical 44-byte header would reject a perfectly good file.
 */
export function wavFormat(bytes: Uint8Array): WavFormat | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) =>
    String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;

  let found: Omit<WavFormat, "dataBytes"> | null = null;
  let dataBytes = -1;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const name = tag(at);
    const size = view.getUint32(at + 4, true);
    if (name === "fmt " && size >= 16 && at + 8 + 16 <= bytes.length) {
      found = {
        channels: view.getUint16(at + 10, true),
        sampleRate: view.getUint32(at + 12, true),
        bitsPerSample: view.getUint16(at + 22, true),
      };
    } else if (name === "data") {
      // Against what is actually there as well as what is declared: a
      // truncated file declares the length it meant to have.
      dataBytes = Math.min(size, Math.max(0, bytes.length - (at + 8)));
    }
    // Chunks are word aligned, and an odd size carries a pad byte that is not
    // counted in it.
    at += 8 + size + (size % 2);
  }
  if (!found || dataBytes < 0) return null;
  return { ...found, dataBytes };
}

/** Whether a WAV is the one the device plays: 16 kHz, mono, 16-bit. */
export const isDeviceWav = (format: WavFormat | null): boolean =>
  format !== null
  && format.sampleRate === DEVICE_SAMPLE_RATE
  && format.channels === DEVICE_CHANNELS
  && format.bitsPerSample === DEVICE_BITS_PER_SAMPLE;

/** How long the clip runs, from the header alone. */
export const wavSeconds = (format: WavFormat): number => {
  const perFrame = format.channels * (format.bitsPerSample / 8);
  return perFrame > 0 && format.sampleRate > 0
    ? format.dataBytes / perFrame / format.sampleRate : 0;
};

/* ------------------------------------------------------------ building --- */

/** The five keys where they really sit - two rows of three, and the top left
 *  cell empty because that is where the speaker is (docs/hardware.md).
 *
 *      .        key 1    key 2
 *      set      key 3    key 4
 *
 *  Written again rather than taken from obf.ts or app_package.ts. Both of
 *  those have their own copy already, and the reason is the one at the head of
 *  this file: a helper reaching across the §5.2 line is where a flag grows.
 *  Twenty lines is the price of three doors that cannot be talked into being
 *  one, and adr/0010 is where that price is argued.
 *
 *  Every slot gets a cell, including an empty one. That is where this differs
 *  from diyBoards(), and the difference is not a disagreement: a tablet grid
 *  can leave a cell out, and the device has five panels that are always lit,
 *  so a key that holds nothing is still a key. Which of them hold nothing is
 *  DeviceSlot.empty, and the compiler draws tiles.blank() for those. */
function deviceGrid(id: string, slots: number) {
  const key = (at: number) => (at < slots ? `${id}-key-${at + 1}` : null);
  return {
    rows: 2,
    columns: 3,
    order: [
      [null, key(0), key(1)],
      [`${id}-set`, key(2), key(3)],
    ],
  };
}

/**
 * The package as data. Pure: no canvas, no store, no clock, no synthesiser.
 *
 * Everything expensive has already happened - the sources are bytes out of the
 * store or out of a licensed folder, the WAVs are bytes out of the same build
 * cache the cable reads. What is left is a mapping over data, which is what
 * makes it checkable under node.
 *
 * It refuses rather than writes a file that cannot be compiled: a WAV that is
 * not the device's, or a name layout.bin cannot carry. Both would travel all
 * the way to a talker before anything noticed.
 */
export function buildDevicePackage(input: DeviceInput): DevicePackage {
  const plan = devicePlan(input.layout, input.voice);
  if (!plan.sets.length) {
    throw new Error("There is nothing in this Sammlung to export yet.");
  }

  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  const boards: DeviceBoard[] = [];
  const ids = plan.sets.map((_, at) => boardId(at));

  for (const [index, set] of plan.sets.entries()) {
    const id = ids[index]!;
    const images = new Map<string, DeviceImageEntry>();
    /* Which id each reference was given on this board. An entry is a
     * REFERENCE - its `symbol` is what the file imports back as - so two
     * references are two entries even where their bytes are one member. They
     * used to share the id their content hash gave them, the second entry
     * overwrote the first, and a key holding somebody's own upload came back
     * as a METACOM reference that happened to have the same pixels. */
    const idOf = new Map<string, string>();
    const claim = (base: string, reference: string): string => {
      const had = idOf.get(reference);
      if (had) return had;
      // The plain id for the first reference to want it, which is every
      // reference on a board that has no such pair - so a package without one
      // is the file it always was. A second one counts up.
      let id = base;
      for (let n = 2; images.has(id); n++) id = `${base}-${n}`;
      idOf.set(reference, id);
      return id;
    };
    const sounds = new Map<string, DeviceSoundEntry>();
    const buttons: DeviceButton[] = [];

    /**
     * The source behind a reference, as an entry and a member.
     *
     * A reference that resolved to nothing still gets an entry - the reference,
     * and no `path`. That is the case this file got wrong first, and the round
     * trip is what found it: dropping the entry altogether loses the reference,
     * so the Sammlung comes back with an empty key where it had a picture
     * nobody could find. Two things then go wrong, and the second is the one
     * that matters. The file stops being a record of the Sammlung, and - if
     * that key also has no word - slotIsEmpty() answers differently on the way
     * back in, so a key the build drew the grey cross for compiles to a blank.
     * That is the divergence of docs/obz-as-device-input.md §5, re-entering by
     * the door built to close it.
     *
     * So the gap travels as a gap. The build drew "a picture is missing" and
     * the export says a picture is missing, which is the same sentence.
     */
    const putImage = (reference: string): string | undefined => {
      if (!reference) return undefined;
      const source = input.sources.get(reference);
      // The id by reference, the member by content: the same bytes behind two
      // references are one file in images/ and two entries pointing at it.
      // An unresolved one is claimed the same way, because unresolvedId()
      // folds characters together - `metacom:Haus` and `metacom-Haus` are
      // one id after it and two references before.
      const entry: DeviceImageEntry = source
        ? {
            id: claim(`img-${source.key}`, reference),
            path: `images/${source.key}.${EXTENSIONS[source.contentType] ?? "bin"}`,
            content_type: source.contentType,
            symbol: splitReference(reference),
          }
        : { id: claim(`img-${unresolvedId(reference)}`, reference),
            symbol: splitReference(reference) };
      images.set(entry.id, entry);
      if (source && entry.path) files.set(entry.path, source.bytes);
      return entry.id;
    };

    const putSound = (text: string): string | undefined => {
      const sound = text ? input.sounds.get(text) : undefined;
      if (!sound) return undefined;
      // Refused here rather than at the far end of a build nobody is
      // watching. A name of another shape is one hashBytes() throws on; a WAV
      // of another format is a word at the wrong pitch, which the device does
      // not refuse and cannot report - see wavFormat() above.
      if (!AUDIO_NAME.test(sound.name)) {
        throw new Error(
          `${sound.name} is not a name layout.bin can carry: a device WAV is ` +
          `"a" and ${HASH_BYTES * 2} hex characters.`);
      }
      const format = wavFormat(sound.bytes);
      if (!isDeviceWav(format)) {
        throw new Error(
          `${sound.name} is not the WAV the device plays. It wants ` +
          `${DEVICE_SAMPLE_RATE} Hz, ${DEVICE_CHANNELS} channel, ` +
          `${DEVICE_BITS_PER_SAMPLE}-bit, and this is ` +
          (format
            ? `${format.sampleRate} Hz, ${format.channels} channel, ` +
              `${format.bitsPerSample}-bit.`
            : "not a RIFF/WAVE file at all."));
      }
      const entry: DeviceSoundEntry = {
        id: `snd-${stemOf(sound.name)}`,
        path: `sounds/${sound.name}`,
        content_type: "audio/wav",
        duration: wavSeconds(format!),
      };
      sounds.set(entry.id, entry);
      files.set(entry.path, sound.bytes);
      return entry.id;
    };

    /** Where a key that leads onward leads, as OBF says it.
     *
     * `load_board` plus, where the key carries its word through,
     * exchange/SPEC.md's `ext_lautstark_speak_on_navigate`. Written on any of
     * the five keys now: until adr/0020 the set key was the only one that
     * could lead anywhere, and the ring was the only place it led. */
    const leadsTo = (button: DeviceButton, does: DeviceDoes, target: number) => {
      if (does === "speak") return;
      const to = ids[target];
      // A target past the end is a set that is not there. devicePlan() already
      // turns that into `speak`, so nothing reaches here - and if the two ever
      // disagree, a button naming a board the package does not hold is the one
      // shape the loader's reader refuses outright.
      if (to === undefined) return;
      button.load_board = {
        id: to,
        name: plan.sets[target]!.name,
        path: boardPath(to),
      };
      if (does === "speak-and-go") button.ext_lautstark_speak_on_navigate = true;
    };

    for (const [at, slot] of set.slots.entries()) {
      const button: DeviceButton = {
        id: `${id}-key-${at + 1}`,
        // Both, and the same text, exactly as obf.ts and app_package.ts write
        // them: the label is what any other editor shows, the vocalization is
        // what gets spoken. The device writes no caption, so on this profile
        // they are one sentence - but saying it twice is what keeps the spoken
        // half right if somebody later shortens the label.
        label: slot.text,
      };
      if (slot.text) button.vocalization = slot.text;
      const picture = putImage(slot.symbol);
      if (picture) button.image_id = picture;
      // Written only when true, so a Sammlung with no crossed-out key exports
      // byte for byte the file it did before this existed.
      if (slot.negated) button.ext_vorlaut_negated = true;
      const recording = putSound(slot.text);
      if (recording) button.sound_id = recording;
      leadsTo(button, slot.does, slot.target);
      buttons.push(button);
    }

    // The key on the page-key panel, which is a key like the other four since
    // adr/0020: it may say its own word, lead onward, or do both, and where it
    // leads is where it was pointed. It is written last because that is where
    // it has always sat in buttons[]; the grid is what says where it is drawn.
    const switchKey: DeviceButton = {
      id: `${id}-set`,
      // Its own word, or the name the firmware prints on that panel where it
      // has none. devicePlan() is where the fallback is applied, so this is
      // one field rather than a second copy of the rule.
      label: set.key.text,
    };
    const setPicture = putImage(set.key.symbol);
    if (setPicture) switchKey.image_id = setPicture;
    // Crossed out like any of the four, and written the same way: only when
    // true. It was not written at all until 2026-10-01 although devicePlan()
    // carried it, so a page key the editor drew as "nicht ja" reached the
    // talker as "ja" - device/fixtures/package/set-key-crossed-out now asks.
    if (set.key.negated) switchKey.ext_vorlaut_negated = true;
    // What it says, if it says anything. The text is the key's own rather than
    // the page's name, which is what it falls back to - see PAGE_KEY.
    if (set.key.does !== "go" && set.key.text) {
      switchKey.vocalization = set.key.text;
      const spoken = putSound(set.key.text);
      if (spoken) switchKey.sound_id = spoken;
    }
    leadsTo(switchKey, set.key.does, set.key.target);
    buttons.push(switchKey);

    const board: DeviceBoard = {
      format: FORMAT,
      id,
      locale: plan.language,
      name: set.name,
      buttons,
      grid: deviceGrid(id, set.slots.length),
      images: [...images.values()].sort(byId),
      sounds: [...sounds.values()].sort(byId),
    };
    if (index === 0) {
      board.ext_vorlaut_sleep_timeout_seconds = plan.sleepTimeoutSeconds;
      board.ext_vorlaut_voice = plan.voice;
      board.ext_lautstark_package_id = input.collection.id;
      board.ext_lautstark_package_name = input.collection.name;
    }
    boards.push(board);
  }

  const manifest: DeviceManifest = {
    format: FORMAT,
    root: boardPath(ids[0]!),
    paths: { boards: Object.fromEntries(boards.map((one) => [one.id, boardPath(one.id)])) },
  };
  const listed = (prefix: string, mark: string) => {
    const members = [...files.keys()].filter((one) => one.startsWith(prefix)).sort();
    return members.length
      ? Object.fromEntries(members.map((path) => [`${mark}-${stemOf(path)}`, path]))
      : undefined;
  };
  const images = listed("images/", "img");
  const sounds = listed("sounds/", "snd");
  if (images) manifest.paths.images = images;
  if (sounds) manifest.paths.sounds = sounds;

  return { manifest, boards, files };
}

const byId = (a: { id: string }, b: { id: string }) =>
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/* -------------------------------------------------------------- writing --- */

/** The bytes obf.py's _json_bytes() writes, and the ones this writes too:
 *  sorted keys, indented by two, a newline at the end. Sorted so that a diff
 *  of two exports is about the Sammlung rather than about object order. */
export function jsonBytes(value: unknown): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(sortDeep(value), null, 2) + "\n");
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as object).sort()) {
    out[key] = sortDeep((value as Record<string, unknown>)[key]);
  }
  return out;
}

/**
 * The package as the bytes of a .obz.
 *
 * Manifest first, then boards, then media, so that `unzip -l` reads in the
 * order the format describes itself in.
 *
 * The media are stored rather than deflated. A PNG and a WAV of speech are
 * both already about as small as they go, and a device export is a thing
 * somebody opens at a bench - a stored member can be pulled out of the archive
 * with dd and a byte offset when whatever they have to hand cannot inflate.
 */
export async function devicePackageBytes(
  pkg: DevicePackage,
): Promise<Uint8Array<ArrayBuffer>> {
  const members: ZipMember[] = [
    { name: MANIFEST, data: jsonBytes(pkg.manifest) },
    ...pkg.boards.map((board) => ({
      name: boardPath(board.id), data: jsonBytes(board),
    })),
    ...[...pkg.files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, data]) => ({ name, data, deflate: false })),
  ];
  return await zipBytes(members);
}
