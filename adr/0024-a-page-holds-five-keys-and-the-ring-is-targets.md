# ADR 0024 — a page holds five equal keys, and the ring becomes targets

**Status:** accepted · **Date:** 2026-09-01 · **Applies to:**
[`src/core/types.ts`](../src/core/types.ts),
[`src/data/upgrade.ts`](../src/data/upgrade.ts),
[`src/data/obf.ts`](../src/data/obf.ts),
[`src/data/device_package.ts`](../src/data/device_package.ts),
[`src/data/app_package.ts`](../src/data/app_package.ts),
[`src/editor-diy/pages.ts`](../src/editor-diy/pages.ts),
[`src/editor-diy/editor.ts`](../src/editor-diy/editor.ts)

Rests on [ADR 0023](0023-a-step-may-rewrite-a-layout-and-leaves-the-stamp.md),
which is the permission for the migration this needs and is not re-argued here.

## Context

The talker has five keys and this editor was the last place holding one of them
apart. `BoardSet` carried `slots: Slot[]` for four of them and `name`, `symbol`
and `key` for the fifth — a different shape, a different sheet, and one thing
nothing else could do.

The device stopped believing it on 2026-08-31, in
`Lautstark/vorlaut-diy-talker`: [ADR 0020][adr20] §1, *"A set holds five
keys"*, and `0ac0465`, *"the set key is a key like the other four with a sound
of its own"*.

**The distinction cost real bugs, in the one place a distinction is expensive:
a reader that has to guess.** Earlier the same day `src/data/obf.ts` was fixed
for an imported game arriving assembled wrong — the round's question sitting in
an answer's panel and the winning answer gone entirely — because the importer
had to work out which of the five was the set key, first from the `load_board`
and then from the cell. It had been the link, which held for exactly as long as
a speech key could not lead anywhere; a joining game inverts that, and the
board that broke was one that ran on the device.

## Decision

### 1. `BoardSet` is `{ id?, name, slots }` with five slots in reading order

```
 .           slots[0]    slots[1]
 slots[2]    slots[3]    slots[4]
```

The corner is the speaker ([`docs/hardware.md`][hw]). `PAGE_KEY` in
`core/types.ts` is `2` — the last row's first cell, which is where the case
puts it and where [ADR 0020][adr20] §3 says a reader finds it.

**An index means where a key is drawn and nothing else.** `KEYS_PER_SET` in
`device/layout_facts.ts` is `SLOTS_PER_SET + 1` — the same device fact counted
the way a person sees it, written as a sum so the two cannot drift, and held to
`device/fixtures/layout/*` by `tests/unit/device_facts.test.ts` like the seven
beside it.

`layout.bin` keeps its own order — the page key first, then four slots — and
`device_package.ts`'s `DevicePlan` is the one place the two orders meet.
Keeping them apart is what stops a stride in a file from deciding how a board
reads on a screen.

**One thing the seat still decides, and it is a caption.** The firmware prints
the page's `name` on that panel. So a key there with no word of its own is
drawn, exported and read back carrying the page's name — one line in each of
the three export doors, which is what all three already did. It is not a role:
that key speaks, leads onward or stays put exactly like the other four, and
every door finds it by the cell rather than by what it does.

`name` stays on the page rather than becoming that key's text. The device's own
menu reads it ([ADR 0021][adr21]) and a `goto` names a page with it — and a
copy in a key would come loose the moment somebody renamed the page.

### 2. The ring becomes targets, once, in a migration step

An absent `BoardSet.key` meant *press it and the next set comes up, forever, in
the order these sit in*. It was never stored: `device_package.ts` computed it
at export time from a set's position. `data/upgrade.ts` writes it out as what
it meant — a `goto` at the following page, the last at the first, and an id on
every page because something now points at every page — called once from the
step to `DB_VERSION` 6. ADR 0023 is why a step may do that.

**What comes out is unchanged, and that is checked rather than claimed.** All
three export doors already wrote the ring as targets, so a Sammlung nobody has
touched exports the file it exported. `tests/test_obf_frozen.py` brings the
lock's input layouts forward under `THE_KEYS_ARE_FIVE` and compares every
document and every zip member against `obf.py`'s frozen answers **untouched**.

A Sicherung is the one door that also brings a layout forward on the way in.
That is not a second rule: a file can be older than any database this browser
has held and carries no version to run steps from.

### 3. Making a page points nothing at it

Appended, unreachable until a key names it — `editor-app/pages.ts`'s
`addPage()`, one editor along, for its own reason: making a page and deciding
what leads to it are two acts, and the second one is a key.

The tempting alternative was splicing it into the chain behind whatever page is
open, so it would inherit the ring's old behaviour. That is the editor bending
two targets nobody asked it to bend, and on a Sammlung that is a game those two
targets *are* the game. The cost is that a new page spends a few seconds
unreachable, which is visible — the strip marks it — and is the same few seconds
a tablet page spends there.

### 4. Deleting a page counts what pointed at it, and does not mend the chain

Every key that led to it keeps its word, its picture and its cell and loses only
its edge, becoming a key that says its word and stays put. That is
`deletePage()` one editor along and its argument: refusing makes you hunt the
keys down by hand, leaving them pointing at nothing puts a dangling
`load_board` in the package, and deleting them destroys work on another page as
a side effect.

**The chain is not pulled together.** Repairing it would mend a speech
Sammlung's ring and silently rewrite a game — round 6 would come to lead to
round 8 as though nothing had happened. What the delete does instead is
**count**: `askDelete()` already asks a question and already names what is on
the page, and it now also says how many keys lead *to* it and that they will
speak and stay put. Deleting round 7 of a twelve-round game leaves a dead end
in round 6 either way; the difference is whether somebody is told before they
press or finds out on the device.

### 5. Reordering pages goes, and the strip draws reachability

Both the `Alt`+arrow gesture and the tab drag. Reordering was how the ring was
steered — where a page sat *was* where its key led — and with targets in the
file a drag would move a page in the strip and change nothing about what leads
where, which is a gesture that looks like it did something. Rearranging did not
disappear, it moved: one changes targets instead of list positions, and that
can say things a list of positions never could.

The strip draws `pageOrder()` — the order the device reaches the pages in,
following every key that goes anywhere, which is word for word the walk the
loader makes over a package. **A page nothing reaches has no place in such an
order and must not vanish because of it**, so the unreachable ones come last,
in file order, each marked. Reachability is reported and never enforced, which
is `editor-app/pages.ts`'s rule and its reason: the page you cannot reach is
the page you most need to get to in order to fix it.

### 6. One sheet for the five, and the page's own card behind the ⋯

`openKeySheet()` opens on any of them, with the same three answers — **Wort**,
**Wort & weiter**, **weiter**. **Reihum** was a fourth on the fifth key alone
and went with the ring: what it meant is a target now, which is what *Weiter*
already said.

What is left of the page itself — its name, and deleting it — is behind the ⋯
on the open tab, and only there. It used to be behind the fifth cell as well,
which made that the one cell on the board that did not open what was on it.

## What this costs

- **Some import coverage in `obf.lock.json`.** Its answers for how a *foreign*
  board becomes a layout describe a placement rule that is gone rather than one
  that moved — the first link out was the set key and the rest were dropped,
  which a talker of five sets in a ring needed and a talker of sixty-four pages
  does not. Nineteen cases have their pages' keys set aside, named and counted
  where they are skipped; `tests/unit/import_acts.test.ts` carries the new rule
  as an authored check. Exports keep their full value, byte for byte.
- **A new page's fifth key no longer leaves the page.** That is the decision in
  §3 seen from the device: a two-page Sammlung has no way across until somebody
  points a key. The strip says so, and `unreachable()` is what says it.
- **A rename this does not do.** `BoardSet`, `layout.sets` and the `ui.set_*`
  text keys still say *set* where every word on screen says *Seite*. The field
  names describe data already on disk — `core/types.ts`'s own first paragraph —
  so renaming them is a second content migration, and a sweep over unrelated
  files belongs on `main` in a session of its own (`CLAUDE.md` §3). Nothing
  user-facing says *Set*.

## When somebody proposes tidying this up

**"The fifth key still has that caption rule — fold it away."** It is what the
firmware prints on that panel, so the editor either draws it or draws a board
that is not the one on the table. What was folded away is the *role*; a caption
is a fact about a seat, and it is stated once per door.

**"Let the strip be reordered again, just for looks."** The order is the walk
now. A strip somebody can drag is a strip that disagrees with the device the
moment they do.

[adr20]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0020-every-key-says-what-it-does.md
[adr21]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0021-the-device-holds-several-collections.md
[hw]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/hardware.md
