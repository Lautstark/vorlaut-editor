# ADR 0018 — a link names a Sammlung by id, and the editor fetches it

**Status:** accepted · **Date:** 2026-08-30 · **Applies to:**
[`src/shell/shelf.ts`](../src/shell/shelf.ts),
[`src/shell/adopt.ts`](../src/shell/adopt.ts),
[`src/app.ts`](../src/app.ts)

## Context

The editor starts a new person with an empty Sammlung. There is now a shelf of
ready-made ones at `lautstark.tech/sammlungen/`, published out of
`Lautstark/lautstark.github.io`, and until this decision the only way across was
the file: download it, find it again, open the settings, press
„Sammlung einlesen". Four steps, three of them file management, for the thing a
person came to the page to do.

This is the first address this page has ever read. There was no router, no hash
handling and no query parameter anywhere in `src/` — so the shape of the first
one is a decision rather than an extension of an existing pattern, and it is
also the first request the editor makes to a Lautstark host.

## Decision

**The address carries an entry's id, and never a URL.**

```
…/vorlaut-editor/?sammlung=erste-woerter
```

The id is checked against `/^[a-z0-9]+(-[a-z0-9]+)*$/` — the shape the shelf's
own check enforces on a folder name — and
`https://lautstark.tech/sammlungen/download/<id>.json` is fetched. Neither the
host nor the pattern is a parameter of anything.

**Both of those live in `@lautstark/werkzeuge/sammlung`** as of v1.1.0, because
mitreden and bildhaft read the same links. What is worth sharing is not the
thirty lines but the check: a regex nobody tests is one somebody relaxes when
they need a character through it, in whichever of three repositories they
happen to be standing in. The package stops at handing back a `File` — what a
product makes of one, and what it says about it, stay the product's.
`src/shell/shelf.ts` is now that half alone.

**The alternative was `?von=https://…`, and it was fewer lines.** It is the
version not to write. It turns a link into "fetch whatever this names and import
it", and what gets imported is a board a child then reads. With an id there is
one host it can come from, the regex is the whole attack surface, and the worst
a crafted link achieves is naming an entry that is not there.

**It is the file import's own path.** `shell/adopt.ts` holds the sequence —
read, create the Sammlung, add the pictures, open it, draw — and `wireImport()`
calls it too. It was inline in `settings.ts` and had one caller; two callers
doing it in two places is how the second one ends up without `addSymbols()`, and
a Sammlung whose pictures never landed reads as a bad file rather than as a bug
here.

**`openNamed()` takes the address and the forgetting as arguments**, with the
live ones as defaults, rather than reaching for `window` twice inside. The unit
suite runs in `node`; adding a DOM to it to reach one regex would be the tail
wagging the dog. It is called as `() => openNamed()` in the boot chain and never
handed to `.then` — which would pass the previous step's value in as the
address.

**The parameter leaves the address as soon as it is read**, so a reload is a
reload and not a second copy of a Sammlung somebody has since edited.

## Consequences

**A new outbound request, and the Datenschutz says so.** `ui.dsg_shelf` sits
beside the ARASAAC section, and `ui.about_leaves` — the summary of what leaves
the machine — names it too. What travels is which Sammlung is meant; nothing
from anybody's own Sammlungen goes with it, and none of it happens unless such
a link is opened. GitHub Pages sees an IP it already sees when this page is
opened at all.

**An import is a copy, and stays one.** Nothing links the new Sammlung to the
published one, and a later change on the shelf never reaches it. That is the
promise the file import already made and this does not weaken it.

**The id is now a published contract.** An entry renamed on the shelf breaks
every link anybody wrote down. That is the shelf's problem to keep, and
`ui.shelf_unknown` is what a reader sees when it is not kept.

**What this does not decide.** Whether the editor ever browses the shelf. It
does not today: `index.json` is published and read by nobody, because browsing
happens in one place — on the site — rather than once per product. A picker in
here would be a second browse UI for people who have already used the first, and
that question is open rather than answered.

## Alternatives

**A file handler in the manifest**, so the OS opens a downloaded `.json` with
the editor. Chromium only, and it does nothing for somebody looking at a web
page, which is where the links are.

**Bundling the shelf into the build.** Then no request leaves at all — and every
new entry needs a release of the editor. The shelf changes on its own rhythm and
the editor should not have to.
