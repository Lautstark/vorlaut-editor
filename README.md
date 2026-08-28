# vorlaut-editor

The board editor for the Lautstark AAC tools. It runs in a browser tab, holds
your collections, finds symbols, speaks sentences, and writes files. It touches
no device over a cable: the talker's file is compiled and sent by a page in
another repository, and that boundary is [ADR 0011](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0011-editor-exports-the-talker-repository-sends.md)'s.

Three kinds of file leave it:

| | |
|---|---|
| **for the talker** | a device-shaped `.obz` — the sources unresampled, negation as a flag, the device's own WAVs. A page in [`Lautstark/vorlaut-diy-talker`](https://github.com/Lautstark/vorlaut-diy-talker) compiles it and sends it down the cable. |
| **for the tablet** | an app package — PNGs and Opus baked in — that [`Lautstark/vorlaut-app`](https://github.com/Lautstark/vorlaut-app) reads. [`exchange/SPEC.md`](exchange/SPEC.md) is the format. |
| **for other AAC software** | a plain `.obz`: symbols by reference, no pixels. |

**One of the three has a second way out.** A finished app package can be
posted straight to a tablet on the same wifi rather than saved — `POST /paket`
to an address somebody reads off the tablet and types into four boxes, which is
`src/shell/tabletSend.ts`. It is the only request this page makes to anything
on your own network; everything else it fetches is a public service it was
asked for, ARASAAC or a voice. And no other export can reach that door: the
talker's file and the plain `.obz` have no tablet to go to, and
`tests/unit/layers.test.ts` is what keeps it that way rather than a comment
asking nicely. The sentence that used to stand at the top said this page
touched nothing at all; it stopped being true the day the send landed, and
saying so here is cheaper than letting somebody find out.

> **Work in progress.** No board has run any of this yet.

## Where this came from

This repository is the editor half of `Lautstark/vorlaut-diy-talker`, which
split on 2026-08-27 under
[ADR 0012](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0012-the-repository-splits-editor-leaves.md). The talker kept
the repository it is named for — the firmware, the case, the device fixtures
and the page that puts a file on a device — and the editor left.

**Its history here is a filtered copy, and it is for reading rather than for
citing.** `git filter-repo` was run on a clone, so nothing in
`vorlaut-diy-talker` was rewritten and every commit id already published there
— the Android viewer's pin among them — goes on resolving exactly where it did.
The cost of doing it that way is that the same commit now exists twice under
two ids. **`vorlaut-diy-talker` is the repository that is cited**; an id from
here is not a translation of one from there, and a path-filtered commit keeps
its whole message while keeping half its diff. What the copy buys is that
`git blame` on a line of `src/` reaches the commit that wrote it, which a
pointer to another repository cannot do.

**The decisions did not come along.** [`adr/`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/) stays in
`vorlaut-diy-talker`, whole: the sequence is never renumbered, so two copies of
one set of numbers would diverge within the week. Everything here links across
to it, and so does `docs/`.

## Running it

There is nothing behind this page: the boards, the symbols and the speech all
happen in the tab. The published copy is deployed straight from `main`:
**<https://lautstark.github.io/vorlaut-editor/>**. It is the same app as a
clone — it just saves you the clone.

To run it from a checkout:

```bash
git clone --recurse-submodules https://github.com/Lautstark/vorlaut-editor && cd vorlaut-editor && npm install && npm run dev
```

Then open <http://localhost:8801>.

`--recurse-submodules` is for the pinned device fixtures the checks read; see
[`third_party/README.md`](third_party/README.md). The page itself does not
need them.

It needs a browser recent enough for ES2022. WebSerial is not on that list any
more — the cable is the other repository's, and Firefox and Safari edit boards
here exactly as Chrome does.

No key and no `.env` to write: every setting has a default, and the first visit
seeds an empty set with four keys, so there is something to type into
immediately. The boards, the symbols and the settings live in the browser's own
storage — in that browser, on that machine, and nowhere else.

Getting a collection onto a talker is two steps and two pages. Here: *Export
this collection* in the `⋯` beside the collection's name, then *For the
talker*. There: **<https://lautstark.github.io/vorlaut-diy-talker/>**, which
checks the file, compiles it and pushes it down the USB-C cable. The page
offers that link at the moment the file exists.
[ADR 0011](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0011-editor-exports-the-talker-repository-sends.md) is why it
is two pages.

No voice is installed for you. Nothing is needed to start editing — the
interface works without one, and new sentences simply stay silent and say so.
The piper voices are one press away in the voice picker in the header, and
Azure Speech is the other route, against a key of your own. Both are in
[`docs/browser-tts.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/browser-tts.md).

## Working on it

TypeScript, bundled by Vite, with no framework: the interface is plain DOM, and
the markup sits beside the module that wires it, in a `templates/` folder on
each side of one seam.

| | |
|---|---|
| `src/shell/` | what any board builder needs: the list of boards, the symbol picker, the voices, the settings, the import and export |
| `src/editor-diy/` | the five-key talker's Sammlung, and only it: four keys to a set, five sets on the device |
| `src/editor-app/` | the tablet boards the Android viewer renders: a grid, pages, a first column |
| `src/core/`, `src/data/`, `src/backend/` | shared underneath all of it — the texts, the storage, the formats, and the seam to the outside |
| `src/device/` | the handful of things the editor has to know about a talker, copied and pinned. Seven numbers and one rounding rule, and no more than that |

Two boundaries, and one test each.

**The shell may not import out of an editor.** `src/main.ts` and `src/app.ts`
mount and connect them, and are the only modules that may name both.

**`src/` imports nothing outside `src/` but the packages this repository
pins.** That is a stronger statement than the one it replaced: while the two
halves shared a repository, the editor legitimately reached into `loader/` for
eight names — seven facts about the device's format and `thumbnailSize()` —
and the rule could only be a list of exceptions. Those eight are now copies in
`src/device/`, held against the pinned fixtures by
`tests/unit/device_facts.test.ts` and against a frozen table by
`tests/unit/thumbnail_frozen.test.ts`, and the import rule has no exception
left in it.

`tests/unit/layers.test.ts` holds both, because the way either goes wrong is
one import that compiles, runs and passes everything else.

| | |
|---|---|
| `npm run dev` | the page, with reloading |
| `npm run typecheck` | `tsc -b` over three projects — the browser, the config files, and the browser tests, which span both |
| `npm test` | vitest: the frozen references for the OBF converter, the recording chain and the symbol index, the device facts against the pinned fixtures, and the walk that says every module under `src/` is one the page reaches |
| `npm run test:e2e` | Playwright: the page, built and opened in a real browser, under the base a project site is served from |
| `python3 tests/run.py` | the prose and the frozen references whose oracles were Python: no German where English belongs, no link pointing at nothing, and the three locks under `tests/reference/` |

None of it needs a compiler. That is what the split changed:
[ADR 0006](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0006-builder-and-hardware-one-repo.md) gave the old
repository three toolchains because one repository had to hold the firmware's
C++ readers against the browser's writers on a single commit, and both of those
implementations are on the other side of the seam now.

**Run `tests/run.py` after `git add`, not before.** `test_language.py` and
`test_links.py` take their file list from `git ls-files`, so an untracked file
is invisible to them: the suite comes up green and then goes red the moment you
commit.

The four shared packages are git dependencies pinned by release tag — see
[`docs/packages.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/packages.md).

### If you have a METACOM licence

Open the gear, and under *Symbols* choose the folder — Chrome and Edge remember
it, Firefox and Safari read it for the session. Nothing is uploaded, nothing is
copied, and nothing derived from those files leaves the browser; see
[METACOM and what leaves](#metacom-and-what-leaves).

A `metacom:` reference is a file name, so a board keeps working against any
copy of the collection.

## What is pinned, and by whom

`device/fixtures/` — the conformance data for the bytes a talker reads —
belongs to neither implementation of that format
([ADR 0009](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0009-device-interface-fixtures.md)), and after the split both
implementations are in `vorlaut-diy-talker`. This repository is a third
consumer and pins it: [`third_party/`](third_party/README.md) has the
mechanism, and ADR 0012's Why is why pinning is consumption rather than
ownership.

The other direction is `exchange/`, which travelled here with the writer it
describes. `Lautstark/vorlaut-app` pins **it**, by commit SHA, and that pin
now has to be re-pointed at this repository to move forward —
[`exchange/README.md`](exchange/README.md) says so where the instructions are.

## Languages

The **product** comes in German and English, switched at the top right of the
interface. The **content** is untouched by it: what somebody typed stays as
they typed it. Code, comments and commit messages are English throughout, and
`tests/test_language.py` is what says so. The whole of it is in
[`docs/languages.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/languages.md).

## Further

Most of the reasoning is in `Lautstark/vorlaut-diy-talker`, and it stays there.

| | |
|---|---|
| [`docs/repository-map.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/repository-map.md) | The repositories in the family, what each one does, and the seams between them |
| [`docs/exchange.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/exchange.md) | The app package export: two doors rather than one, and why the licence makes that structural |
| [`docs/browser-tts.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/browser-tts.md) | Speaking without a server: what was measured, and which voices survive it |
| [`docs/frozen-references.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/frozen-references.md) | What still checks the browser halves once the Python ones are deleted, and what does not |
| [`docs/packages.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/packages.md) | The four shared packages, how they are pinned, and what is asked of them |
| [`docs/languages.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/languages.md) | German and English in the product, English in the code |
| [`docs/split-crossings.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/split-crossings.md) | What crossed the seam, name by name, and the answer for each |
| [`docs/split-rehearsal.md`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/split-rehearsal.md) | The move, carried out twice on throwaway clones before it was carried out here |
| [`adr/`](https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/) | The decisions that would otherwise be "tidied up" later, and why each of them is not an oversight |
| [`exchange/SPEC.md`](exchange/SPEC.md) | The app package format, with conformance fixtures beside it. This one is here |

## Licence

Code under [MIT](LICENSE).

The ARASAAC pictograms the search loads are by Sergio Palao and are
**CC BY-NC-SA**; nothing derived from them is redistributed here. The piper
voices are public domain and are fetched rather than stored.

### METACOM and what leaves

METACOM is a **commercial symbol set with a per-person licence.** A board built
here can carry METACOM symbols, because that is what the licence is for: making
communication material for the person you support.

Three boundaries keep it that way:

- **Nothing this repository ships ever contains METACOM-derived pixels.** No
  example content, no CI artefact, no file in a release. That is the line that
  would actually be redistribution.
- **The symbols are read from your own licensed folder, and stay there.** They
  are neither downloaded nor copied — a board holds a `metacom:` reference and
  the picture is fetched when it is needed.
- **A board you share stays a reference.** `.obf` and `.obz` are not picture
  containers, so a board sent to someone else carries the names of the symbols
  and renders for them only if they hold a licence too. The app package is the
  one export that bakes pixels in, and
  [`exchange/README.md`](exchange/README.md) says what that means.

Building a board **for somebody else** is a different question, and a per-person
licence is unlikely to cover it. That is not about this software: it would be
the same answer for printed cards. If you get there, ask
[the publisher](https://www.metacom-symbole.de) first.

Without your own METACOM licence none of this applies — the feature simply does
not work, and ARASAAC covers everything on its own.
