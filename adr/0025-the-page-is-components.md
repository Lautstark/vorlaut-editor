# ADR 0025 — the page is components, and the shell stops reaching for elements

**Status:** built · **Date:** 2026-09-16 · **Applies to:**
[`src/main.ts`](../src/main.ts), [`src/app.ts`](../src/app.ts),
[`src/shell/`](../src/shell), [`src/editor-app/`](../src/editor-app),
[`src/editor-diy/`](../src/editor-diy), [`src/core/texts.ts`](../src/core/texts.ts),
[`src/core/save.ts`](../src/core/save.ts)

The family's pilot is
[wochenwerk's ADR 003](https://github.com/Lautstark/Wochenwerk/blob/main/docs/decisions/003-svelte-for-the-two-pages.md),
decided and built the same day. What it settled — Svelte 5 with runes, the
whole app rather than islands, the design system's dialog frame kept, the
shared vanilla panels kept — is not re-argued here. This records what the
second product found, which is three things that product could not: a layout
two editors mutate in place, a shell that must not know what an editor is, and
a stylesheet that is the product rather than the components'.

## Context

This page was drawn three ways at once, and the third was the expensive one.

`src/shell/templates/` held five markup strings — the frame, the footer and
three sheets — each put in the document with `innerHTML` and then *filled in*
by a module that found its elements by id. `applyTexts()` in
`src/core/texts.ts` was two hundred lines of
`byId("dsgAzureHead").textContent = t("ui.dsg_azure_head")`, ninety-nine more
of the same, and nothing at all holding the two halves together: which sentence
went where was a fact spread across two files, agreed only because one person
had written both. Everything else — the board, the cells, the tabs, the sheet
bodies, the four vanilla panels — was `document.createElement`, redrawn by
hand-written `draw*()` functions that emptied a container and built it again.

The failures were counted rather than feared. `tests/test_texts_used.py` exists
because twenty-nine text entries outlived the screen that drew them and read
exactly like the live ones around them. `tests/unit/settings_panels.test.ts`
exists because a list of panel ids in one file drifted from the markup in
another and the comment above it said the opposite of what the code did. And
`tests/unit/layers.test.ts` has a section headed *"What this test does not
prove, and cannot"* about element ids being a dependency the module graph
cannot see — five of them were found when the second editor was written, the
worst being the save loop reaching for a button only one editor mounts.

The 2026-09-15 architecture review counted three rendering idioms across the
four web products and named the DOM-ownership question — who builds a node and
who repaints it — as the thing that had blocked every larger shared surface.

## Decision

The UI layer is Svelte 5 components. `src/shell/Shell.svelte` is the whole
page; each editor's board is a component the composition root mounts into the
hole the shell leaves; every sheet body and every sheet foot is a component
mounted into `@lautstark/design/dialog`'s own containers.

Nothing in `src/` reads an element by id any more. `byId` is gone from
`src/shell/dom.ts`, which is what is left of that file: the status line, handed
the node by the component that draws it. The ids are all still *on* the
elements — they are what `e2e/` presses and what a handful of `ui.css` rules
draw against, and taking them off would have made this a change to the page
rather than to how it is drawn.

### What was kept, and what it cost to keep it

**The dialog frame is still `@lautstark/design/dialog`'s.** `shell/parts.ts` is
wochenwerk's `openSheet()` under a different name — it mounts a body component
and a foot component straight into the frame's `.body` and `.foot`, with no
wrapper, because `components.css` styles those children directly.

**No Svelte frame component, including for the picture-column sheet.** That
sheet was the one place one would have been arguable: two columns, a foot with
three seats, and a width modifier on the dialog. It is `openParts()` plus
`SheetBody.svelte` and `SheetFoot.svelte` like every other sheet, and the two
columns stay a class on the shared dialog (`.sheet--button`). A frame component
would mean this product drawing `.sheet > .head` for itself, which is the one
thing the shared layer exists to stop four products doing four ways — and it
would have moved the anatomy out of the package on the say-so of one sheet. The
twenty visual baselines at a tolerance of zero are what proved the markup came
across; they are also what would have caught the wrapper element a frame
component makes it easy to add.

**The shared vanilla panels are still vanilla.** `@lautstark/sicherung`'s two,
`@lautstark/bildquelle`'s METACOM panel, `@lautstark/stimmquelle`'s voice
picker and `@lautstark/design`'s language row, collections list, rename field,
menu and toast are all built once and put in place by
`shell/pieces/Vanilla.svelte`, a `display: contents` host. Nothing in any
shared package changed for this product to move.

**`src/styles/ui.css` is untouched, and scoped CSS did not arrive with this
change.** Scoped styles are one of the reasons the family chose Svelte —
conventions.md §4.12, *"a module that emits markup brings its CSS"*, true by
construction — and pushing 2,172 lines of product layout into eighty components
is a second change with the same twenty baselines standing behind it. The
components carry the classes `ui.css` has always drawn; the stylesheet's hash
is byte-identical before and after. The move is worth making and is not this
one.

**The core is untouched except in two places, and both were markup.**
`model`-shaped core — `types.ts`, `boot.ts`, `boot_data.ts`, `state.ts`,
`editor.ts` — did not change at all, and neither did `src/data/`,
`src/backend/`, `src/device/` or a single unit test that reads them. The two
exceptions are the two core files that held DOM: `texts.ts`, whose
`applyTexts()` is now four lines — the editor's own labels hook, and
`<html lang>` — and `save.ts`, whose conflict banner was four `byId` calls and
is now two fields on a rune (`shell/conflict.svelte.ts`) that
`shell/Conflict.svelte` draws. Both were the shell's markup living in `core/`;
neither is a change to what `core/` *is*.

### How the layout becomes reactive

This is the decision wochenwerk did not have to make, and it is the interesting
one.

`core/state.ts` holds one object that both editors mutate in place — a key is
typed into `slot.text`, a button is pushed onto `page.buttons` — and then call
`commit()`, which redraws and writes. That contract is older than this change
and was not a candidate for changing: `save()` hands the same object to
`structuredClone()` and to IndexedDB, and `comparable()` stringifies it. A
`$state` object is a Proxy, and a proxy is exactly what those three refuse —
which is the gotcha wochenwerk's pilot found and wrote down for the next
product.

So the layout stays the plain object it has always been, and what is reactive
is *a note that it moved*. `shell/live.svelte.ts` holds a `$state.raw` box
carrying the object and a counter; `layout()` reads the box, `touched()`
replaces it, and each editor's existing `render()` is now one line. Nothing is
proxied, no write goes through a snapshot, and `state.layout` is byte-for-byte
what it was. The counter is not decoration: `$state.raw` compares before it
notifies, so a box holding the same object would be a write of an equal value
and every mutation this page makes would go unreported.

**The cost is one rule, and it cost an afternoon to find.** `$derived`
propagates on inequality, and the layout is the same object before and after
every edit — so `const layout = $derived(board())` re-runs and then stops,
because what it produced is `===` what it produced last time, and everything
downstream goes on drawing the board from before the press. Nothing warns and
nothing throws. What it looked like was an editor that had stopped accepting
input: "+ Neue Seite" added a page to the file and nothing to the strip, and
twelve of the twenty-three cases in `e2e/happy.spec.ts` failed in a way that
read as a broken save. The rule is written at the head of
`shell/live.svelte.ts`: **never put the layout, or anything inside it, in a
`$derived`** — call `board()`, `page()` or `set()` inside the expression that
needs the answer, and where a component wants a record to read fields off, derive
a shallow copy, which is a new object every time and so says what changed.

This is the honest price of the layout staying plain, and it is the one to pay.
The alternative is `$state` on `state.layout`, which makes every record a proxy
and hands one to `structuredClone()`, to `comparable()` and to IndexedDB — three
call sites in code this change had no business touching.

### The seam between the shell and the editors is unchanged

`tests/unit/layers.test.ts` holds one arrow: nothing outside an editor's own
directory may import out of one, except the two modules that put the page
together. That arrow is why `EditorHalf.mount()` existed at all, and it comes
through this change intact — an editor's board is a component `app.ts` mounts,
never something the shell imports. The three hand-overs the shell offers an
editor are the same three, one shape along: `collectionPages()` takes a
component instead of a function with a container, `collectionSheetPanel()` takes
a component and two questions instead of a build function and a callback to
write a heading with, and `collectionMenuExtras()` is untouched.

What the layers test needed was to be taught that a component is a module. Both
it and `reachable.test.ts` walk `.svelte` now; without that they would have gone
quiet about most of the page, which is exactly the shape of green this
repository has been bitten by twice. `svelte` is the fifth name in
`PINNED_PACKAGES`, and the send-door rule gained the two components that *are*
the send door's sheet — both edits the tests are designed to cost.

## What this measured

The contract is `e2e/` — 178 cases in 23 files, seven of them screenshots
compared at a tolerance of zero against baselines committed for two platforms —
and 500 unit assertions. Every one of them was written against the old rendering
and passes against the new one, unchanged. **No baseline was re-recorded**, and
the fourteen PNGs are byte-identical in the diff.

The seven are the surfaces this change had the most opportunity to move: the
settings sheet as it opens, three of its panels unfolded, the voice picker, the
work head with a name in it, and the footer. Between them they cover the folded
panel, the field, the button row, the segmented control, the shared vanilla
blocks and the sheet's own anatomy.

**Five real regressions were found by the contract**, which is the whole reason
it is the contract, and four of them are worth naming because each is a way this
conversion can go wrong rather than a typo:

- a `$derived` holding the layout, which is the rule above and cost the strip
  its pages;
- `pageName()`, which short-circuits on a page that has one — so the one
  expression that had to notice a rename was the one that was not watching the
  layout;
- the editor's panels in the Sammlung's sheet, left mounted when the sheet
  closed: a `<dialog>` is hidden rather than emptied, so the grid panel carried
  a half-made choice into the next open. A `{#key}` on the open count is what
  destroys them, which is what the old build-on-every-open did for free;
- a picture that was not in the store when the board was first drawn — a new
  Sammlung's start key, on its way down from ARASAAC — keeping the "no picture"
  sentence for ever, because a component is not thrown away and rebuilt the way
  a cell used to be.

`test_texts_used.py` caught the fifth, the two sidebar reveal buttons losing
their titles, and `test_language.py` caught a German word in an English comment.
Every one of the four above is a component outliving something that used to be
rebuilt, which is the shape to look for in the next product.

Bundle, gzipped, what the browser actually fetches for a first paint in German:

| | before | after |
| --- | --- | --- |
| `index.html` | 1.2 kB | 1.2 kB |
| the page's own stylesheet | 7.9 kB | 7.9 kB |
| the entry, and the runtime with it | 9.0 kB | 10.9 kB |
| the store and the folder | 8.4 kB | 8.4 kB |
| the data layer, the shared packages, and now the compiled templates | 57.7 kB | 93.1 kB |
| the wiring, imported at boot | 38.4 kB | 21.9 kB |
| the German text table | 33.4 kB | 33.4 kB |
| **whole page** | **156.0 kB** | **176.8 kB** |

Thirteen per cent more on the wire, all of it the runtime and the compiled
templates, and slightly under what the pilot paid (+15%). The two chunks that
moved are one change seen twice: what the compiler emits is larger than the
`document.createElement` it replaced, and the wiring that used to walk the page
filling elements in is most of what went. `jszip` and the piper runtime are
another 52.2 kB and are fetched only by somebody exporting or speaking; neither
moved, and neither did the stylesheet — its hash is the same before and after,
which is the shortest proof that the markup came across class for class.

Lines: 12,113 of TypeScript across the three UI directories became 11,973 of
TypeScript and Svelte, of which 3,518 is Svelte — in 90 files where there were
41. `core/texts.ts` went from 232 lines to 54. Every `draw*()`, `paint*()` and
`render*()` that emptied a box and built it again is gone, and so is
`usePaint()`, the slot `editor-app/standing.ts` handed its drawing in through
because the parts could not import the module that drew them.

`npm run typecheck` is `svelte-check` against `tsconfig.app.json`, then `tsc -b`
for the three projects that are not components. The unit and browser suites are
checked by `tsc` and both `include` `src/`, so `types/svelte-modules.d.ts`
says what a `.svelte` import is for them — deliberately outside `src/`, because
an ambient declaration inside the tree `svelte-check` reads would shadow the
per-component types and the check that matters would quietly become that one.

## Consequences

- **`@lautstark/toolchain` is adopted here first**, while `package.json` was
  open: vite, vitest, typescript and Playwright arrive through it, and the
  tsconfig and vitest bases are extended. The Playwright base is extended too,
  with four things passed back over it — the project *names*, because a name is
  in the file name of every visual baseline; `locale: undefined`, because the
  base asks for de-DE and this page reads its language out of `navigator`; the
  90-second timeout; and two retries rather than one.
- **Components import `t` from `shell/live.svelte.ts`**, which is
  `core/texts.ts`'s lookup with the note attached so that whoever drew a label
  is drawn again when the page changes language. One table, one lookup, two
  subscriptions. Every other module imports it from `core/texts.ts` as before.
- **The next product to move gets the same shape**, and one thing wochenwerk
  could not tell it: if the app mutates a shared object in place, put the object
  behind a `$state.raw` box with a counter and never `$derive` the object
  itself.
- **The dialog frame and the shared panels are now two-consumer**, which is the
  bar `@lautstark/design`'s own rule sets for promoting something into the
  shared layer. `shell/parts.ts` and `shell/pieces/Vanilla.svelte` are the same
  file in two repositories; they are the first thing worth turning into shared
  components, and the panels the second.
- **`src/styles/ui.css` stays a product stylesheet** until somebody spends the
  baselines on moving it. `node node_modules/@lautstark/design/shadows.js
  --strict` reports none, which is the state that had to be kept.
