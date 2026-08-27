// The seven things the editor has to know about a talker, copied.
//
// Every one of them is a fact about `layout.bin`, and `layout.bin` is a format
// this repository does not implement: the writer is `loader/src/layout_format.ts`
// and the reader is `firmware/vorlaut/layout_format.h`, both in
// Lautstark/vorlaut-diy-talker, both held against `device/fixtures/`. The
// editor writes a file that page compiles, and it has to know these numbers to
// write one a talker can read at all - normalizeLayout() in data/obf.ts holds
// every builder to the sleep range, which is the writer half of a rule whose
// reader half is layoutIdleSeconds() in the firmware's own header.
//
// Until 2026-08-27 these were imported across a directory boundary and counted
// by tests/unit/layers.test.ts, which called that list "the bill for the
// split". This file is the bill paid. What makes a copy safe rather than a
// second opinion is that neither copy is the authority: device/fixtures/
// belongs to neither implementation (adr/0009), the pinned checkout under
// third_party/ is what this file is compared against, and
// tests/unit/device_facts.test.ts is the comparison. adr/0012's Why is why
// pinning is consumption rather than ownership.
//
// **Adding a name here costs an edit and an argument.** That was
// ALLOWED_FROM_SRC's real value and it is the half worth keeping: a device fact
// the editor holds without a fixture holding it is the duplicate quietly
// growing, which is the same failure the import list was written to catch from
// the other end. tests/unit/device_facts.test.ts enumerates this file and every
// entry has to name the fixture that is its authority.

/** Four keys to a set - the stride every layout fixture was laid out from.
 *
 * Authority: `device/fixtures/layout/*`. */
export const SLOTS_PER_SET = 4;

/** Sixteen bytes of a digest, everywhere a layout points at a file.
 *
 * Authority: `device/fixtures/names.expected.json`, field `hash_bytes`. */
export const HASH_BYTES = 16;

/** The index the device labels its own menu by.
 *
 * Authority: `device/fixtures/language.expected.json`, the table. The device
 * side of it is LANGUAGES in `firmware/vorlaut/texts.h`.
 *
 * Read by data/app_package.ts as well, which writes a package no talker ever
 * sees. So the editor's copy is not purely a duplicate of a device fact - it is
 * also the editor's own default, shared between the device profile and the app
 * profile. It is still held to the fixture, because the device profile is the
 * stricter of the two. */
export const LANGUAGE_CODES = { en: 0, de: 1 };

/** Authority: the same file - `default_code` and `default_index`. */
export const DEFAULT_LANGUAGE = "en";

/* The sleep timeout's range, beside the strides because it is the same kind of
 * thing: a number both halves have to hold. The firmware states it in
 * LAYOUT_SLEEP_MIN, LAYOUT_SLEEP_MAX and LAYOUT_SLEEP_DEFAULT.
 *
 * The field is a uint32, so the format can hold far more than this. What it
 * cannot do is mean it: the device computes `idle * 1000UL` and that wraps
 * above 4294967 seconds, so the range is narrower than the field on purpose.
 *
 * Authority for all three: `device/fixtures/sleep.expected.json` - `min`,
 * `max` and `default`. */
export const SLEEP_MIN = 10;
export const SLEEP_MAX = 86400;
export const SLEEP_DEFAULT = 600;
