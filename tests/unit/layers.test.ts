import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "./harness.js";

/* The shell may not know what a five-key talker is, or what a page of a grid
 * is either.
 *
 * src/editor-diy/ is one device's editor: four keys to a set, five sets on the
 * hardware at once, and a cable at the end of it. src/editor-app/ is the other: pages of a grid, a sentence bar, a
 * colour per word class, and a package at the end of it. Everything else under
 * src/ is the shell - the Sammlungen, the storage, the symbol picker, the
 * voices, the settings, the design tokens, the import and export - and it has
 * to stand without any of that, because two editors is what the split was for.
 *
 * An import is how that stops being true, and it stops being true quietly:
 * `import { render } from "../editor-diy/editor.js"` in the save loop compiles,
 * runs, and passes every other test in this repository. It was there, three
 * times over, before this file existed - save.ts, picker.ts and voices.ts each
 * reached for the board renderer - and each of those was one line that made
 * the shell unable to draw anything else.
 *
 * So the rule is one direction of one arrow, and the exceptions are named
 * rather than pattern-matched: exactly two modules may see every editor, and
 * they are the two that put the page together. If a third ever needs to, that
 * is a design decision and it should cost an edit here.
 *
 * ## What this test does not prove, and cannot
 *
 * **It proves imports, and imports are not the only way to depend on
 * something.** An element id is a dependency the module graph cannot see. Five
 * of them were found when the second editor was written, and the worst was
 * core/save.ts reaching for `$("releaseBtn")` inside load() - a button only
 * editor-diy mounts, in a shell module, with $() throwing by design. This file
 * was green through all of it and would be green through the next one.
 *
 * The mitigation is not a cleverer test. It is that an editor's markup is
 * mounted with the editor and only while it is on screen (core/editor.ts's
 * showEditorFor), so a shell module reaching for another editor's element
 * throws on the first Sammlung that uses it rather than on some later one.
 * That turns an invisible coupling into a loud one, which is the most a
 * structure can do about a dependency written as a string.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "..", "src");

/** Every editor there is. A directory per target, and the names are the ones
 *  core/types.ts's Target holds with `editor-` in front - so a third one is a
 *  line here and nothing else. */
const EDITORS = ["editor-diy/", "editor-app/"];

/** Whether a path is inside any editor. */
const inEditor = (name: string): boolean =>
  EDITORS.some((one) => name.startsWith(one));

/** The composition root: main.ts mounts the shell, app.ts registers both
 *  editors and mounts whichever one a Sammlung needs. Nothing else. */
const ROOT = new Set(["main.ts", "app.ts"]);

/** Every module under src/, however deep, as a path under src/. */
function modules(dir = SRC): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...modules(full));
    else if (entry.endsWith(".ts")) {
      out.push(relative(SRC, full).split(/[\\/]/).join("/"));
    }
  }
  return out.sort();
}

/** What one module imports, as paths under src/, resolved against the file
 *  doing the importing. The same reading reachable.test.ts does, and for the
 *  same reason: "./editor.js" means a different file in each directory that
 *  has one, and there are two. */
function importsOf(name: string): string[] {
  const text = readFileSync(join(SRC, name), "utf8");
  const out: string[] = [];
  for (const [, spec] of text.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)) {
    if (!spec.startsWith(".")) continue;           // a package, not our file
    out.push(posix
      .normalize(posix.join(posix.dirname(name), spec))
      .replace(/\.js$/, ".ts"));
  }
  return out;
}

const all = modules();

for (const one of EDITORS) {
  check(`there is an editor at src/${one} to keep out of the shell`,
        all.some((name) => name.startsWith(one)),
        `${all.filter((n) => n.startsWith(one)).length} modules under src/${one}`);
}

/* Two of them, and that is the assertion rather than a set-up detail. The
 * whole arrangement - the registry, the mount-on-arrival, the per-layout count
 * - is there to carry a second editor, and with one editor present every rule
 * below passes for the wrong reason. */
check("there is more than one, which is what the split is for",
      EDITORS.length > 1, `${EDITORS.length} editors`);

/* A type-only import is still an import for this purpose, and deliberately so.
 * `import type { Editor }` from the shell would be the shell knowing the shape
 * of one particular editor, which is the thing being prevented - and the way
 * to share a shape is core/editor.ts, which both halves may name. */
const crossings: string[] = [];
for (const name of all) {
  if (inEditor(name) || ROOT.has(name)) continue;
  for (const target of importsOf(name)) {
    if (inEditor(target)) crossings.push(`${name} -> ${target}`);
  }
}

check("nothing outside an editor imports out of one, except the two that mount them",
      crossings.length === 0,
      crossings.length ? crossings.join(", ")
                       : `${all.length - 1} modules checked against ${EDITORS.join(", ")}`);

/* The other direction is allowed and is not a mirror of the rule above: an
 * editor draws in the shell's page, saves through the shell's save loop and
 * opens the shell's symbol picker. What it must not do is reach *past* the
 * shell into another editor.
 *
 * This was written while there was one editor, when it could only ever have
 * caught a module importing out of itself. It is live now, and it is the rule
 * that stops the cheap version of a second editor: editor-app reusing
 * editor-diy's thumb, or its drag-and-drop, and thereby making one device's
 * ideas the other's. Anything genuinely shared belongs in the shell. */
const strays: string[] = [];
for (const name of all.filter(inEditor)) {
  const own = EDITORS.find((one) => name.startsWith(one))!;
  for (const target of importsOf(name)) {
    if (inEditor(target) && !target.startsWith(own)) strays.push(`${name} -> ${target}`);
  }
}
check("no editor reaches into another editor", strays.length === 0,
      strays.join(", ") || `${EDITORS.length} editors, importing nothing from each other`);

/* ## The second boundary: the editor is not a party to the device format
 *
 * adr/0011 took the device path out of the editor: the editor exports a file
 * and stops, and the page that compiles it and puts it on a talker is the
 * talker's own repository's. adr/0012 then put the two in two repositories.
 *
 * **What stood here was a list, and it could not survive the move.**
 * ALLOWED_FROM_SRC named the eight things src/ was permitted to import out of
 * loader/ - seven facts about layout.bin and thumbnailSize() out of the tile
 * renderer - and its closing comment called that list "the bill for the
 * split". The bill is paid. What must not happen is the list staying: every
 * one of its checks reads `spec.includes("loader/")`, and in a repository with
 * no loader/ that matches nothing, reports "eight names, from two modules" and
 * is green for ever. This repository has been bitten twice by a test that was
 * green for the wrong reason, and a file whose own comment is about
 * dependencies a module graph cannot see should not end up as one.
 *
 * So it was replaced on both sides rather than moved, and the editor's
 * successors are two files rather than one:
 *
 *  - **tests/unit/device_facts.test.ts** is where the enumeration went. What
 *    was a list of names the editor may *import* is a list of device facts the
 *    editor holds a *copy* of, each one held against the pinned
 *    device/fixtures/ and each one naming the fixture that says so. Adding a
 *    name still costs an edit and an argument, which was the list's real
 *    value; and a copy nothing checks is worse than an import, so it is a
 *    stronger statement than the one retired.
 *  - **tests/unit/thumbnail_frozen.test.ts** is thumbnailSize(), the one name
 *    on the bill that is not a number: a frozen table taken from the original
 *    while both halves were still in one tree.
 *
 * And the rule below is the other half of the replacement. It is what could
 * not be said while loader/ was a legitimate exception eight names wide.
 */

/** The packages this repository pins, which are the only bare names src/ may
 *  take from outside itself.
 *
 *  Four repositories of their own, each pinned by tag - the arrangement
 *  docs/packages.md describes in Lautstark/vorlaut-diy-talker - plus the two
 *  ordinary npm dependencies. They are prefixes rather than a rule about bare
 *  specifiers in general, so that a fifth one costs a line and a look. */
const PINNED_PACKAGES = [
  "@lautstark/", "@diffusionstudio/", "idb", "onnxruntime-web",
];

/** The one absolute URL the page loads code from, and the argument for it.
 *
 *  onnxruntime-web's ESM build off a CDN, fetched at run time by the piper
 *  runtime rather than bundled. It is a fetch and not a build input, which is
 *  why it is a separate list from the one above and not an entry in it: a
 *  package that moved would break an install, and this would break a sentence
 *  somebody is waiting to hear. Anything added here is a second thing this
 *  page cannot do offline. */
const ALLOWED_URLS = [
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/esm/ort.wasm.min.js",
];

/** Every module specifier in one file, static and dynamic.
 *
 * Comments first, then a lookbehind that refuses a keyword sitting inside a
 * string literal - which is not a hypothetical: core/boot_data.ts has an
 * `"ui.import"` key and core/texts.ts asks the page for `$("import")`, and a
 * pattern without it reads both as imports of whatever quoted thing comes
 * next. importsOf() above never noticed because it drops everything that does
 * not start with a dot; this one is asked precisely about the rest.
 *
 * A side-effect import counts (`import "@lautstark/design/components.css"`)
 * and so does a dynamic one, because both are ways out of this directory. */
function specifiersOf(text: string): string[] {
  /* A line comment, except where the two slashes are a URL's - "https://" is
   * a specifier this file has to be able to see, and stripping from the "//"
   * in it leaves `import("https:` and a crossing reported against a scheme. */
  const source = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/[^\n]*/g, "");
  const out: string[] = [];
  const patterns = [
    /(?<!["'\w$.])(?:import|export)\s+(?:[^;"']*?\s+from\s+)?"([^"]+)"/g,
    /(?<!["'\w$.])import\s*\(\s*"([^"]+)"/g,
  ];
  for (const pattern of patterns) {
    for (const [, spec] of source.matchAll(pattern)) out.push(spec!);
  }
  return out;
}

/* ## src/ imports nothing outside src/ but the packages it pins
 *
 * An absolute rule, and it is new. Until adr/0012 nothing could say it: the
 * editor legitimately reached into loader/ for eight names, so the strongest
 * available statement was a list of exceptions kept honest by hand. With the
 * other half of the repository in another repository the exception is gone,
 * and what is left is a statement with no list of names in it.
 *
 * What it catches is the one edit that would undo adr/0011's boundary here: a
 * relative path climbing out of src/ into third_party/ - the pinned checkout
 * of the talker's repository, which exists for device/fixtures/ and happens to
 * hold a whole working copy of code this repository is no longer a party to.
 * third_party/README.md says that in prose; this is the check.
 */
const outward: string[] = [];
let specifiers = 0;
for (const name of all) {
  for (const spec of specifiersOf(readFileSync(join(SRC, name), "utf8"))) {
    specifiers++;
    if (spec.startsWith(".")) {
      const target = posix.normalize(posix.join("src", posix.dirname(name), spec));
      if (!target.startsWith("src/")) outward.push(`${name} -> ${target}`);
    } else if (/^[a-z]+:/.test(spec)) {
      if (!ALLOWED_URLS.includes(spec)) outward.push(`${name} -> ${spec}`);
    } else if (!PINNED_PACKAGES.some((one) => spec === one || spec.startsWith(one))) {
      outward.push(`${name} -> ${spec}`);
    }
  }
}

check("src/ imports nothing outside src/ but the packages this repository pins",
      outward.length === 0,
      outward.length ? outward.join(", ")
                     : `${specifiers} specifiers in ${all.length} modules, `
                       + `${PINNED_PACKAGES.length} pinned packages, `
                       + `${ALLOWED_URLS.length} URL`);

/* And that the rule above is not passing because it reads nothing. A pattern
 * that matched no imports at all would report zero crossings and be green, and
 * this file's own subject is checks that go quiet. */
check("and it read the imports it was meant to", specifiers > all.length,
      `${specifiers} specifiers across ${all.length} modules`);
