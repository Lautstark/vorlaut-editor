// What the page does when it opens.
//
// Two steps, and the order is the point: put the structure in the document,
// then wire it. Everything that touches an element lives in app.ts, which is
// imported *after* the templates have mounted - see the note there for why a
// separate module is what makes that ordering hold rather than a comment
// asking people to be careful.
//
// The stylesheets are imported rather than linked, so the bundler knows they
// exist: it hashes them, inlines what is small enough and fails the build on a
// url() pointing at nothing. Tokens first - ui.css reads the custom properties
// they define.
//
// The tokens come from @lautstark/design, generated per product from one line
// of input (vorlaut's accent) - see that repo's README for how every value that
// has to clear a contrast ratio is solved for it. There used to be a copy of
// this file checked in here, byte-identical to the package's; a copy that is
// identical today is a copy that drifts tomorrow, and the lockfile pin is what
// says which version this page wears.
import "@lautstark/design/tokens/vorlaut.css";
// The components layer, between the tokens and this page's own rules: the
// button, the field, the chip, the menu, the sheet and the folded panel,
// each written once against the token names. It restyles nothing by itself
// except :focus-visible - everything else is opt-in by class - which is why
// ui.css below is now the layout that is vorlaut's alone, and no longer a
// second copy of the vocabulary. The panel in it came from here in the first
// place and has gone home.
import "@lautstark/design/components.css";
import "./styles/ui.css";

// The page's structure, as one component tree.
//
// There were five mount points here and each was a markup string put in the
// document with innerHTML: a frame, a footer, and three sheets, every one of
// them filled in afterwards by a module that looked its elements up by id.
// shell/Shell.svelte is all five, and the words are read out of the text table
// where they are drawn rather than in a pass that named a hundred elements.
// adr/0025.
//
// The editors are not here, and that has not changed. Shell.svelte lays out the
// page with a hole in the middle of it - the list of Sammlungen down the side,
// and #editor - and one editor fills the hole, but *which* one is a fact about
// the Sammlung that has not been read out of the database yet. So app.ts mounts
// the editor's own page at the moment a layout arrives and again whenever a
// different one does. This file and app.ts are still the two that may name both
// halves; see tests/unit/layers.test.ts.
import { flushSync, mount } from "svelte";
import Shell from "./shell/Shell.svelte";
import { initTheme } from "@lautstark/design/theme";

// Before anything renders, though the attribute it would set is already set by
// the inline script in index.html. What this adds is the address bar, which
// needs the token import above to have a --bg to read, and the listener that
// keeps it right when the OS turns over under a page that is following it.
initTheme("vorlaut.theme");

// Synchronously, which is what keeps the ordering this file has always had: the
// structure is in the document before the module that wires it is imported. See
// the note in app.ts for why a separate module is what makes that hold rather
// than a comment asking people to be careful.
//
// flushSync() is the half of that which is Svelte's rather than the module
// graph's. mount() puts the elements in the document and *queues* the effects;
// the components use theirs to hand over the four nodes the page's wiring needs
// - the status line, the name field, the list of Sammlungen, and the hole an
// editor's board is mounted into. A queue drains on a microtask, and the two
// awaits below happen to be two of those, so in practice this was already
// ordered - which is exactly the kind of "in practice" the note above is about.
mount(Shell, { target: document.body });
flushSync();

/* Before anything reads the database. Where a folder is the store it is the
   truth, and a first paint from the browser's copy would be a board that changes
   under somebody a moment later. */
const { ablage, adopted, watchFolder } = await import("./data/folder.js");
const { pullFromFolder } = await import("./data/store.js");
await ablage.restore().catch(() => null);
await pullFromFolder().catch(() => false);

const { start } = await import("./app.js");
start();

/* Somebody else's edit, arriving as a file that changed under this browser. */
if (await adopted()) {
  watchFolder(() => void pullFromFolder().then(() => { location.reload(); }));
}
