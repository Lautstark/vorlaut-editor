# ADR 0023 — A migration step may rewrite a layout, and leaves the stamp for the next write to make

**Status:** accepted · **Date:** 2026-09-01 · **Applies to:**
[`src/data/migrations.ts`](../src/data/migrations.ts),
[`src/data/store.ts`](../src/data/store.ts), and every future step whose change
is to what is *inside* a layout

Amends the last-but-one consequence of [ADR 0015][adr15]. Everything else that
decision says — one step per version, inside the `versionchange` transaction,
abort rather than proceed blind, forgetting a step is safe — is unchanged and
is what this rests on.

## Context

[ADR 0015][adr15] closed a door on purpose and said so:

> **Nothing in a step may `await` a non-request** — no hashing, no base64, no
> folder write, no question put to a person. Concretely: a step may **move** a
> layout and may not **rewrite** one, because the stored `text` and the
> `version` hash over it are a matched pair and re-deriving the hash is a
> `crypto.subtle` call. **A change to what is inside a layout cannot be done as
> a step**, and has to come back to this ADR rather than around it. That is a
> known gap, not an oversight.

The gap has been reached. `BoardSet.key` absent means *the ring* — press the
set key, the next set comes up, forever, in the order the sets happen to sit
in — and that rule exists only in this editor. The device stopped believing it
on 2026-08-31: [ADR 0020][adr20] took `(rtcCurrentSet + 1) % layout.setCount`
out of the sketch, and every key now carries a `does` and a `target` a builder
writes down. `src/data/device_package.ts` computes the ring at export time from
the array order, which is the same arithmetic one repository along and is wrong
the moment anything reorders a set.

Taking the rule out means *absent* has to start meaning what it means on every
other key in this product — the key says its word and stays put, which is what
a joining game's question key needs. Every Sammlung already stored means the
other thing. So the ring has to be written into those Sammlungen as the targets
it always stood for, and that is a change to what is inside a layout: the thing
0015 says cannot be a step.

Both halves of the trap are real and neither is negotiable. A `versionchange`
transaction stays open only while requests are outstanding on it, so one
`await` on `crypto.subtle.digest` commits it underneath a half-run migration —
and `versionOf()` in `store.ts` is exactly that call.

## Decision

**A step may rewrite a layout's `text`. It leaves that record's `version`
exactly as it found it, and the next ordinary write re-stamps it.**

No hashing happens inside the transaction, so 0015's rule about awaiting only
requests on `tx` is kept in full — this does not weaken it, it removes the
consequence somebody drew from it. A step that rewrites still does its work in
`JSON.parse`, plain object edits and `JSON.stringify`, all of which are
synchronous, between two requests on `tx`.

What it costs is a window in which the stamp over a record is not the hash of
that record's bytes.

## Why

**The stamp is only ever compared against itself.** That is the whole of the
argument, and it is checkable rather than asserted. There is exactly one
comparison in this repository — [`store.ts:864`](../src/data/store.ts), inside
`writeLayout()`:

```ts
if (expected && expected !== (held ? held.version : EMPTY)) {
```

`expected` is what the caller last read, and `held.version` is what the store
holds. Both sides come out of the same record. Nothing anywhere re-derives a
hash from stored bytes and checks it: `readLayout()` hands the stamp out as it
found it, `save.ts` carries it in `layoutVersion` and hands it back, and
`replaceCollections()` computes fresh stamps outside the transaction from text
it is writing for the first time. So a stamp that is *stale* and a stamp that
is *correct* are indistinguishable to every reader, and both do the one job the
value has: telling this tab whether another tab wrote first.

**The window closes on the first write, correctly.** After a migrated record is
read and saved once, `writeLayout()` puts `text` and `versionOf(text)` together
and the pair is matched again. Nothing has to remember that a repair is owed,
and nothing has to sweep.

**Two tabs still cannot overwrite each other during the window.** This is the
case worth being explicit about, because it is the one the stamp exists for.
Both tabs read the same stale stamp; the first to save finds `held.version`
equal to what it read, writes, and puts a fresh stamp there; the second finds
`held.version` moved and gets `{conflict: true}`. Staleness is shared, so the
comparison is unaffected — what would break the mechanism is two records
disagreeing, not one record being old.

**A tab that read *before* the migration cannot write after it, and the stamp
is not what stops it.** This is the case the paragraph above does not cover and
the one worth being most careful about: a stale stamp held across a migration
would let a page save its pre-migration layout over the migrated one and see no
conflict, because the value it holds is the value in the store. What rules it
out is the version number rather than the stamp. A page holding a layout read
before the step ran is by definition a build whose `DB_VERSION` is lower, and
`store.ts` gives it two ways to end, both of them safe:

- It still holds its connection, so the newer tab's upgrade is **blocked** and
  does not run at all — `blocked()` in `store.ts`. There is no migrated record
  yet, so there is no stale stamp to hold.
- It lets go, through `blocking()`, which closes the connection and drops
  `opening` so the next call opens again. That reopen asks for its own lower
  version against a database that has moved past it, and `openDB` answers
  `VersionError`. [ADR 0015][adr15] records that outcome as verified rather
  than assumed.

So the pre-migration reader never reaches `writeLayout()`'s comparison: it
cannot write, because it cannot open. That is worth stating precisely because
it is *not* the stamp doing the work — anyone reasoning about this decision
from the stamp alone will find the hole and be right to.

**The alternative keeps the thing being removed.** Normalising on read — the
loader rewrites the ring into explicit targets on the way out of the store,
storage keeps the old shape until somebody saves — needs no schema change at
all and is genuinely safe. It is refused because of what it is: the silent rule
does not go away, it moves from `core/types.ts` into a normaliser, where it is
harder to find and has to be kept correct forever. The point of the change that
brought this ADR about is that a set key's target is *written down*. A
migration is what makes that true of the Sammlungen that already exist; a
read-time fixup is the rule wearing a different coat.

**The two-phase version is worse than either.** A step that bumps the version
and leaves the app to rewrite the layouts afterwards, through the ordinary
write path with real stamps, sounds like it gets everything. It does not: the
sweep is not atomic across Sammlungen, so a tab closed halfway leaves some
migrated and some not — which means the reader needs the normaliser anyway, and
we have paid for both.

## Consequences

- **`versionOf()`'s docstring is no longer unconditionally true**, and says so.
  It is the stamp over the bytes *as of the last write*, which is what every
  reader of it has always used it as.
- **A rewriting step is O(the layouts), and that is a cost 0015 was right
  about.** `deleteObjectStore("data")` reads nothing and cannot lose anything;
  this reads and writes every board there is. So such a step is the exception
  and needs the reason written into it — the general preference for a step that
  moves rather than rewrites stands.
- **A rewriting step is where a layout can be lost**, which no previous step
  could do. It therefore gets a test that seeds the version it starts from
  *and* asserts the content that came across, not only the count.
- **This does not license awaiting anything else.** No hashing, no base64, no
  folder write, no question put to a person — the rule is untouched. What
  changed is only that not hashing is now survivable rather than disqualifying.
- **If anything ever checks a stamp against its own bytes, this decision has to
  come back.** A corruption check over the store is the obvious candidate. It
  would find every un-re-saved migrated record and call it damaged.

## Not to be "fixed" later

**"Just re-stamp the record in the step — write `version` as something new."**
Something new is not the hash, so this is the same decision with an extra write
and a worse property: an invented stamp differs from what the tab that is open
read a moment ago, so the next save comes back `{conflict: true}` and a person
is asked to resolve a conflict with nobody. Leaving the old value is what keeps
the open tab's read valid.

**"Make `versionOf()` synchronous so a step can hash."** That means a SHA-256
written out in this repository, on the path that decides whether somebody's
board is overwritten, to save a value that is compared only against itself. The
stamp is not a checksum and nothing verifies it; giving it a second
implementation buys nothing and adds a way for the two to disagree.

**"Rewrite the whole database through the current schema again, now that steps
may rewrite."** No. That is the arrangement [ADR 0015][adr15] replaced, and its
**What was tried first** section is the argument. This permits one step to
touch layouts because that step's change is inside them; it does not restore
dispatch-on-shape or the full read-and-write-back.

[adr15]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0015-a-schema-change-carries-the-boards-across.md
[adr20]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0020-every-key-says-what-it-does.md
