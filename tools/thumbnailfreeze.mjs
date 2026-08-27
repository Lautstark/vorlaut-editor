#!/usr/bin/env node
// Writes down what thumbnailSize() answers, by asking the real one.
//
//     node tools/thumbnailfreeze.mjs --check  ../vorlaut-diy-talker/loader/src/tiles.ts
//     node tools/thumbnailfreeze.mjs          ../vorlaut-diy-talker/loader/src/tiles.ts
//
// The oracle is loader/src/tiles.ts in Lautstark/vorlaut-diy-talker, and it is
// named on the command line rather than found: it is in another repository now,
// and a tool that reached for it on its own would be a cross-repository code
// dependency, which adr/0011 does not have. The pin under third_party/ is for
// device/fixtures/ - data both halves are held against - and widening it to
// code would be the one edit that quietly undoes that.
//
// This is kept for the same reason tools/obffreeze.py is: as the record of how
// tests/reference/thumbnail.lock.json was made, so that a case can be added to
// it against the oracle rather than guessed. docs/frozen-references.md is the
// rule it obeys, and the rule is that the lock is never regenerated from
// src/device/thumbnail.ts - the half being checked. --check is the safe verb
// and is the one to reach for.
//
// The oracle takes `max` as a default argument (TILE_SIZE), so it is read as
// text and evaluated with that name supplied rather than imported: the copy
// under src/ deliberately has no default, and this file has no business
// holding the device's tile geometry either (adr/0013).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCK = resolve(HERE, "..", "tests", "reference", "thumbnail.lock.json");

const argv = process.argv.slice(2);
const check = argv.includes("--check");
const source = argv.find((one) => !one.startsWith("--"));
if (!source) {
  console.error("Name the oracle: a checkout's loader/src/tiles.ts.");
  process.exit(2);
}

/** thumbnailSize() out of the oracle's text, with TILE_SIZE supplied.
 *
 * A regular expression over the file rather than an import, because importing
 * it would pull in a module full of canvases and a constant this repository
 * must not hold. What is extracted is one self-contained function. */
function oracleFrom(path) {
  const text = readFileSync(path, "utf8");
  const body = text.match(/^export function thumbnailSize[\s\S]*?^}$/m);
  if (!body) throw new Error(`no thumbnailSize() in ${path}`);
  const factory = new Function(
    "TILE_SIZE",
    `${body[0].replace(/^export /, "")}; return thumbnailSize;`,
  );
  // Any number will do: every case below states its own max, so the default
  // never fires. It is passed only so the signature evaluates.
  return factory(116);
}

/** The cases, as sizes rather than as answers.
 *
 * Widened by editing this list and re-running, which is the only way a case is
 * ever added: an answer typed in by hand is a guess wearing a lock's clothes. */
function sizes() {
  const out = [];
  const add = (w, h, m) => out.push([w, h, m]);
  // The device's tile is 116; exchange/SPEC.md 5.3's cap is 512. Both, because
  // what is frozen is one rounding rule and not one caller's use of it.
  for (const m of [116, 512]) {
    // Never enlarges: both sides under the cap, one side under it, exactly on it.
    add(1, 1, m); add(m, m, m); add(m - 1, m, m); add(m, m - 1, m);
    add(Math.round(m / 2), Math.round(m / 3), m);
    // Square, and the two straightforward rectangles.
    add(1000, 1000, m); add(2048, 1536, m); add(1536, 2048, m);
    // Extreme aspect ratios, where the short side is what rounding decides and
    // where round_aspect()'s clamp to 1 is the only thing between it and zero.
    add(4000, 3, m); add(3, 4000, m); add(10000, 1, m); add(1, 10000, m);
    // A sweep either side of each cap, one pixel at a time, which is where
    // floor and ceil disagree and where a tie has to land on floor.
    for (let w = m * 2 - 4; w <= m * 2 + 4; w++) { add(w, m * 2, m); add(m * 2, w, m); }
  }
  // The sizes ARASAAC and METACOM actually hand over, at the package's cap.
  for (const [w, h] of [[500, 500], [2048, 2048], [512, 384], [800, 600],
                        [1024, 768], [640, 480], [300, 900], [900, 300]]) {
    add(w, h, 512);
  }
  const seen = new Set();
  return out.filter(([w, h, m]) => {
    const key = `${w},${h},${m}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const thumbnailSize = oracleFrom(resolve(source));
const cases = sizes().map(([width, height, max]) => {
  const [x, y] = thumbnailSize(width, height, max);
  return { width, height, max, x, y };
});

const lock = JSON.parse(readFileSync(LOCK, "utf8"));

if (check) {
  const was = JSON.stringify(lock.cases);
  const now = JSON.stringify(cases);
  if (was === now) {
    console.log(`  ok    ${cases.length} case(s) - the oracle still answers what is frozen`);
    process.exit(0);
  }
  console.error("  FAIL  the oracle no longer answers what tests/reference/thumbnail.lock.json holds.");
  console.error("        docs/frozen-references.md: that is a finding, not a reason to rewrite the lock.");
  process.exit(1);
}

lock.cases = cases;
writeFileSync(LOCK, JSON.stringify(lock, null, 2) + "\n");
console.log(`  wrote ${cases.length} case(s) to ${join("tests", "reference", "thumbnail.lock.json")}`);
