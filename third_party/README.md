# What is pinned here, and what it is for

One submodule: [`Lautstark/vorlaut-diy-talker`](https://github.com/Lautstark/vorlaut-diy-talker),
at a commit this repository records rather than a branch it follows.

## Only `device/fixtures/` is of interest

The rest of that repository comes along and is ignored — the same arrangement
[`exchange/README.md`](../exchange/README.md) describes for `vorlaut-app`
pinning this one, pointed the other way.

`device/fixtures/` is the conformance data for the bytes a talker reads: the
layout table's strides, the hash length in a file name, the language index, the
sleep range, and — since ADR 0014 — the device-shaped package the editor
writes. It belongs to **neither** implementation of that format, which is ADR
0009's whole point, and after the split both of those implementations are in
`vorlaut-diy-talker` while this repository is a party to none of them. So this
is a pin by a third consumer, and ADR 0012's Why is what makes that consumption
rather than ownership: pinning acquires no authority over what is pinned.

What is held against it here is [`src/device/layout_facts.ts`](../src/device/layout_facts.ts)
— the seven numbers the editor duplicates — and
[`tests/unit/device_facts.test.ts`](../tests/unit/device_facts.test.ts) is the
holding. A duplicate with nothing holding the copies together is the failure
`docs/frozen-references.md` in the other repository exists to record.

## Data, not code

**Nothing in this repository imports code from the pin, and nothing may.**
ADR 0011's Decision is that there is no shared package and no cross-repository
code dependency between the two halves; the boundary is a file format. A build
that reached into `third_party/vorlaut-diy-talker/loader/` would undo that in
one line, with a plausible reason, and no test outside this paragraph would
notice. `tools/thumbnailfreeze.mjs` is the one tool that reads a module out of
a checkout of that repository, and it takes the path as an argument for exactly
this reason — it never reaches for the pin on its own.

## Getting it, and moving it

```bash
git submodule update --init
```

A clone without that leaves the directory empty, and the checks that read the
fixtures say so rather than passing.

Moving the pin is a deliberate change with a test run attached, never a routine
bump:

```bash
git -C third_party/vorlaut-diy-talker fetch origin main
git -C third_party/vorlaut-diy-talker checkout <sha>
git add third_party/vorlaut-diy-talker
```

There is no `branch` in `.gitmodules`, on purpose: it is what makes
`git submodule update --remote` move the pin, and a pin that follows a branch
is not a pin. When `device-v*` is finally cut, the tag is what to pin instead —
[`exchange/README.md`](../exchange/README.md) has the convention.
