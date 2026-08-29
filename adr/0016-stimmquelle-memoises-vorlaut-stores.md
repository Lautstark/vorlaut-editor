# ADR 0016 — stimmquelle memoises its own output, and vorlaut gives it somewhere to put it

**Status:** accepted · **Date:** 2026-08-29 · **Applies to:**
[`src/backend/local.ts`](../src/backend/local.ts),
[`src/data/store.ts`](../src/data/store.ts),
[`src/data/migrations.ts`](../src/data/migrations.ts)

## Context

This page speaks the same sentence over and over, and pays for it every time.

**Every ▶ press is a full synthesis.** `speak()` in
[`src/shell/speech.ts`](../src/shell/speech.ts) calls `synthesise()`, which
called stimmquelle's `speak()` fresh; that package memoises voice *models* and
nothing else. On an `azure:` voice a second press on one key is a second billed
round trip; on piper it is the model again, on a CPU, in a tab. There are five
▶ call sites and none of them was any cheaper than the first.

**Every export re-speaks every sentence.** `exportDevicePackage()` and
`exportAppPackage()` synthesise every distinct sentence on every run.
`shell/packageExport.ts`'s own header puts a full tablet Sammlung at around 400
utterances, "which is minutes" — minutes paid again for a Sammlung nobody has
touched since the last export.

**And a talker Sammlung exported both ways says everything twice**, once at
`DEVICE_SAMPLE_RATE` for the talker and once at `ENCODER_RATE` for the app
package.

`@lautstark/stimmquelle` 2.8.0 is what makes this addressable. It ships
`keyFor(text, voiceId, options)` — CONTRACT.md §3, the fingerprint, which both
of that package's consumers had implemented by hand and each of which had got a
different clause wrong — and `remember(store, …)`, which is the same name with a
lookup around it. It takes a `{ get, put }` from the consumer and deliberately
owns no storage: "a library owned by a sentence and a cache shared between them
are different lifetimes for the same bytes, and a package that owned it would
have to make one consumer wrong."

`audioName()` already asks `keyFor()` for the name. What has been missing is
somewhere to put anything under it.

## adr/0011 does not forbid this, and it is worth being exact about why

vorlaut had this cache. [ADR 0010][adr10] gave it a `data` object store keyed by
`audioName()`, and a rebuild skipped the model inference when the file was
already there. [ADR 0011][adr11] took it away, and anybody adding it back has to
answer that — the step to 4 in `data/migrations.ts` is `deleteObjectStore("data")`
and it is the commit somebody will find while wondering whether this one is
allowed.

What 0011 decided is that **the export may not read a build's record of a
device**: *"the file is not a record of a device, it is what a device is given."*
The `data` store went because it was the *build's* store and the build left.
`migrations.ts`'s own 3→4 comment says exactly that — a store nothing writes,
holding a megabyte of tiles for a device this page can no longer reach. The
reuse of already-synthesised audio was collateral to that, not a thing anybody
decided against.

Three ways this is a different object from the one that left:

* **It is nobody's record.** A `data` record was part of a build, and the build
  was a claim about a particular talker — which is what made reading it at
  export time a claim the export was not entitled to make. A record here is
  a recording, owned by nothing, referring to no device, and true of any export
  that wants that sentence in that voice.
* **A hit and a miss are the same bytes, by construction rather than by care.**
  The name is a hash of everything that decides how the recording sounds, so an
  entry can only have been produced by this page speaking that sentence, in that
  voice, with those options. The failure 0010 was written against — *"a file
  claiming to be a talker's contents while holding audio that talker has never
  had"* — needs a name that can be right about one recording and wrong about
  another, and §3 is the reason there is no such name here.
* **Every export writes exactly what it would have written with an empty
  cache.** Nothing about *what* is in the file is decided by a lookup. Emptying
  this store changes how long an export takes and nothing else, which is the
  property the eviction policy below is allowed to lean on so hard.

## Decision

**stimmquelle's `remember()` at every call site that used to call `speak()`, over
an IndexedDB object store this repository owns, under a least-recently-used
budget.**

* A new store, `speech`, keyed by CONTRACT.md §3's full hex, holding the
  finished WAV. **Schema 5**, and the step is one `createObjectStore` — no
  layout is read on the way past, the same shape the step that removed `data`
  had.
* `synthesise()` and `exportDevicePackage()` ask with `VORLAUT` — the device's
  rate, fade and pad — so they ask under the same name and **share every entry**.
  A carer who has listened to their Sammlung has already paid for its export.
* `exportAppPackage()` asks at 24 kHz without the device's extras, which is a
  different recording under a different name, correctly.
* **One entry per delivered rate, rather than one master per utterance.** The
  fork is the next section.

## The fork: a master, or one entry per rate

[ADR 0008][adr8] is the rule in view: *one master per utterance, at the voice's
native rate; everything else is derived*, and what it forbids by name is
deriving the app package's Opus from the talker's 16 kHz WAV. Read straight, it
prescribes caching the master and deriving both artefacts from it — one entry
where this decision keeps two, and no sentence ever synthesised twice.

**Today's code already satisfies 0008**, and that is the first thing to say
clearly. Neither delivered artefact is derived from the other: each is
`postprocess()` run over one synthesis at the voice's native rate. The
double synthesis is a duplicated *cost*, not a violation. So what a master cache
would buy is deduplication, and what it would cost is a derivation step — and
`speak()` does synthesis and postprocess in one call, so vorlaut would have to
write that step. There are three ways to write it and each gives something up.

**Run `postprocess()` again over the cached master.** The master is a stored
WAV, so it is levelled; postprocessing it a second time trims, fades, pads and
levels a signal that has already been trimmed, faded, padded and levelled. Two
limiter passes on every recording a child hears. That is "two lossy stages
instead of one, for no gain" — ADR 0008's own argument, arriving through a door
it was not watching.

**Resample the master's samples and encode.** One levelling pass, at the wrong
rate. `postprocess()` measures the loudness and holds the true-peak ceiling
*after* the resample, deliberately: *"resampling can push a peak higher than
anything in the input, and a ceiling checked beforehand would be a ceiling the
output can exceed."* Deriving skips that pass, so the −1.5 dBTP ceiling stops
being enforced on the file the device actually plays — the same file that
carries a fade and a tail pad because of what a class-D amplifier does at its
edges.

**Reimplement `postprocess()`'s tail** from `resample`, `integratedLufs`,
`limitTruePeak`, `TARGET_LUFS` and `TARGET_PEAK_DBTP`, all of which are
exported. This is correct on the day it is written and is a second
implementation of CONTRACT.md §1 living in a consumer. §3 is a section about
what happens next: both consumers assembled that fingerprint by hand, both were
wrong, and neither found out because neither had a cache for the error to spoil.
This would be the same mistake with the levelling instead of the naming, and
`PIPELINE_VERSION` could not say so, because the drift would be on our side of
it.

**Then price the win, which is the part that settles it.** The double synthesis
happens only where one Sammlung goes through both doors. `exportsFor()` leads a
talker Sammlung with the talker's card and folds the app package away beneath
it; a tablet Sammlung is taken straight to the app package, and
`exportDevicePackage()` refuses one outright — *"a tablet Sammlung has no sets
and nothing a talker could show"*. So **the 400-utterance Sammlung that
motivated all of this can only ever go through one door, and is never spoken
twice.** What the master would save is a talker Sammlung's sentences — the code
says up to twenty — spoken a second time, once, on the day somebody also writes
that Sammlung for a tablet.

Twenty one-off syntheses is not worth a second levelling pass on every recording
in the product, and it is not worth an unenforced ceiling on the device's own
file. **One entry per rate.** The storage difference goes the same way: it is
two entries per sentence for a talker Sammlung and one either way for a tablet
one, so it is about four megabytes on the small kind of Sammlung and nothing at
all on the large kind.

### How adr/0008 is honoured, and the one line of it this does not follow

* **Nothing derives one delivered artefact from the other**, and nothing can:
  each is still `postprocess()` over one synthesis at the voice's native rate,
  exactly as before. This decision does not touch that chain.
* **Deduplication is at one level**, keyed by the inputs, so the same sentence on
  three boards is one synthesis — 0008's own reason for keying on `text + voice`.
* **A §1 or §2 change invalidates everything**, because `PIPELINE_VERSION` is one
  of the six inputs to the name. 0008 says a contract change re-renders every
  master; here it renames every entry, which has the same effect and needs
  nobody to remember.
* **The line not followed** is 0008's remark that caching the derived artefacts
  *"would key on the consumer as well and multiply the work"*. It does, and the
  multiplication is accepted with its measurement written down above: ×2 on a
  talker Sammlung's twenty sentences, ×1 on a tablet Sammlung's four hundred.

## The eviction policy, and why the old store needed none

`data` had no eviction because it was not a cache. It was one build, replaced
whole by the next build, bounded by the size of one Sammlung.

This grows with every distinct sentence ever spoken in this browser, in every
voice it was ever spoken in, across every Sammlung, for ever — and it grows
inside the same origin as the Sammlungen themselves. **The store that holds a
child's communication board and the store that holds a recording that can be
made again in eight seconds are competing for one quota**, and only one of them
is irreplaceable.

**Least recently used, against a budget of 96 MB, and the recording just written
is never the one evicted.**

* **A budget in bytes rather than a count**, because what is scarce is bytes and
  utterances are not one length.
* **Big enough that finishing an export cannot evict the beginning of the same
  export.** A sentence at 24 kHz, 16 bit, mono is about 48 KB a second; four
  hundred of them at a second and a half each is a little under 30 MB. 96 MB is
  three of those, which is the smallest number that is not one — a budget
  holding exactly one Sammlung thrashes for somebody keeping two open, and
  keeping two open is what the sidebar is for.
* **Small enough that it cannot crowd out the content.** Chrome and Firefox
  allow far more and Safari around a gigabyte, and this is deliberately a
  fraction of the smallest of them. It is not a quota and must not be read as
  one.
* **Least recently *used*, not written**, so a read stamps the record. That costs
  a write on every hit and buys the property the budget is chosen for: the
  Sammlung somebody is working on stays, however old it is.
* **Never the record just written.** A recording evicted by its own arrival is a
  synthesis paid for and thrown away, and it is what a store holding one
  over-budget recording would do on every write for ever. The consequence is
  that the budget is a target rather than a ceiling.
* **A failed write is swallowed.** `remember()` does not catch a failing `put`,
  on the stated grounds that only the consumer knows whether the bytes can be
  made again. Here they can. A full disk, a browser refusing to grow the origin,
  a private window with no storage at all — each of them means this page speaks
  the sentence again next time, and none of them is worth a sentence on the
  screen or an export that stops.

## Consequences

* **Schema 5**, and a version 3 database now crosses two steps to reach it.
  `tests/unit/store_upgrade.test.ts` is where that composition is held.
* **Nothing in the new store announces**, so nothing is in a Sicherung. The note
  at the foot of `store.ts` recorded that argument when `data` left, against the
  next thing that wanted a folder of derived files; this is that thing.
* **The app package encodes Opus from the WAV rather than from `speak()`'s float
  samples.** A hit has no float samples — what was kept is a file — and a cache
  that returned different audio from a miss would be worse than no cache, so
  both paths read the file. It costs one quantisation to 16 bit, whose noise
  floor sits some sixty decibels below anything Opus leaves at 24 kbit/s, and it
  is what ADR 0008's own diagram draws: the master is *kept*, and a kept master
  is a file.
* **Recordings still do not travel.** §3's consequence stands — sentences move
  between machines, recordings are made again on the other side — and this store
  is one browser's.

## Not to be "fixed" later

**Somebody will propose the master cache again**, and they will have ADR 0008 in
their hand, correctly. What they need to bring is not an argument: it is a way
to derive a delivered artefact at its own rate that neither levels twice nor
leaves the ceiling unenforced. That is a change to `postprocess()` — a shaped and
measured master, and a tail that derives at a rate — **in the package that owns
§1 and §2**, not a derivation written here. If stimmquelle grows that split, this
decision should be revisited on the day it does, and the twenty sentences above
become the least of what it is worth.

**The lesser version is to raise the budget until it stops mattering.** The
budget is not about how much audio is worth keeping; it is about what this
origin is allowed to spend on things that can be made again while holding the
only copy of somebody's boards. A cache that fills the origin to keep a
recording has taken something irreplaceable to keep something that costs eight
seconds.

**And this store does not go in the Sicherung.** It would multiply a backup file
by the whole of a Sammlung's audio, to carry bytes the other side can make for
itself, and the first time somebody's restore failed on a file too large to
write it would be for a cache.

[adr8]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0008-audio-masters-derived-artefacts.md
[adr10]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0010-device-shaped-obz-export.md
[adr11]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0011-editor-exports-the-talker-repository-sends.md
