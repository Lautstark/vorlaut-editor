#!/usr/bin/env python3
"""Checks src/data/obf.ts against what obf.py said, without obf.py.

The converter existed twice, and tests/test_obf_js.py held the two together
while both were here; the Python half went on 2026-08-22 and took the live
test with it. This is the half that outlives them: everything in
tests/reference/obf.lock.json was written by obf.py and layout.py through
tools/obffreeze.py, and nothing below imports any of them. Node and the
lock file are the whole of what it needs.

One thing about that tool, because it is the odd one out of the five: it is
still in tools/, kept as the record of how the lock was made, and it can no
longer run - everything it imports, obf.py and layout.py first among them,
went with the Python half. Its presence is not a way to regenerate the lock.
The lock is the record, nothing in the repository can write it again, and a
deliberate change to the mapping means restoring the oracle and its imports
from git for as long as a refreeze takes (docs/frozen-references.md, "The
board as a document").

Which matters more here than for the other three subsystems, because there is
no second opinion to fall back on. Tile rendering has Pillow, layout.bin has
the firmware's own C reader compiled at test time, the speech chain has
ffmpeg. A board is a mapping this project invented, so obf.py was the only
thing that ever knew whether src/data/obf.ts was right - and a mapping compared
against nothing passes for ever.

Five comparisons:

  the helpers      every small rule on the arguments that bite, including the
                   ones obf.py refused.
  layout -> board  the document each layout becomes, field for field.
  board -> layout  the layout each document becomes - the exporter's own, and
                   the foreign ones where the mapping is actually hard.
  the licence      the documents that must be refused, and the sentence.
  the container    the .obz the browser writes, opened with Python's own
                   zipfile and compared member by member with what write_obz()
                   put in; and the files obf.py packed, read back by the
                   browser. Not the compressed bytes - zlib and
                   CompressionStream are two compressors, and only what comes
                   out of the members can be identical.

What this cannot do is answer for a case nobody recorded. If the mapping grows
a field, this file cannot say what the new right answer is; obf.py has to come
back to say it. See docs/frozen-references.md.

Three narrowings and one transformation, all of them the price of a deliberate
mapping change - which is the case obf.lock.json's own invalidated_by
anticipates ("a change to the mapping in obf.py"). The lock is not touched and
is not refrozen: its oracle is gone, so the only thing left that could write it
is src/data/obf.ts, and a lock written by the module it checks is the browser
compared against itself. What is narrowed is what gets compared, and what is
transformed is stated in one function that a reader can check by eye. See
ACTIVE_IS_GONE, THE_CAP_MOVED and THE_KEYS_ARE_FIVE below.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import sys
import zipfile
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# The browser half is TypeScript now, so plain `node` cannot run these
# harnesses. vite-node can - it is vitest's own loader, already installed, and
# it resolves imports exactly the way the bundle does. Deliberately no build
# step in between: a frozen reference compared against compiled output has
# stopped measuring the source it names.
#
# The binary rather than `npx vite-node`, because npx reads its first argument
# as a command name and would try to execute the harness itself.
JS_RUNNER = str(ROOT / "node_modules" / ".bin" / "vite-node")


def have_js() -> bool:
    """Whether the loader is installed. `npm install` puts it there."""
    return Path(JS_RUNNER).exists()

REFERENCE = ROOT / "tests" / "reference"
LOCK = REFERENCE / "obf.lock.json"
MODULE = ROOT / "src" / "data" / "obf.ts"
DRIVER = ROOT / "tests" / "obf_node.mjs"

failures: list[str] = []
# THE_KEYS_ARE_FIVE: the imports whose slot lists were set aside, named at the
# end of that section rather than filtered in silence.
setaside: list[str] = []

# --- what the lock can no longer answer for ----------------------------------

ACTIVE_IS_GONE = """the active/inactive distinction.

A set used to carry `active`, and its board `ext_vorlaut_active`, marking which
of an author's sets went onto the device. Sammlungen replaced it: a Sammlung is
the selection, it ships all its sets, and the field was deleted rather than
migrated. So neither name exists in src/data/obf.ts now.

The lock records 151 answers about those two fields - 123 true, 23 false, and
five odd shapes a foreign document put there. None of them is *wrong*; they are
unreachable, which is a different thing and worth writing down rather than
papering over. They cannot be re-recorded either: obf.py is gone.

Holding the module to a constant instead would not be a check. The lock's own
entries are 123 true against 23 false, so whichever constant were written, the
other 23 (or 123) cases would fail it just the same.

Everything else in the lock keeps its full value: this drops two field names
out of the comparison and nothing else. The board id, the buttons, the grid,
the images, the licence, the colour, the locale, the ring and the container are
all still held to what obf.py said."""

THE_COLOUR_IS_GONE = """the set colour, in the three places this mapping put it.

A set carried a colour. A board carried it as `ext_vorlaut_color`, the hex form
that survived a round trip; every button on that board carried it again as
`border_color`, the CSS form, so that a foreign renderer had something to draw;
and `normalizeLayout()` gave a set without one a colour from the palette. The
talker has no per-set colour at all now - not in the editor, not in layout.bin,
not in an app package - so none of the three has anything to write.

That is the end of a chain rather than a change of mind about the mapping.
`layout.lock.json` went first, under THE_COLOUR_IS_GONE in
tests/test_layout_frozen.py; `BoardSet.color` outlived it by one change purely
because of this file, and this is what lets it go.

**Three kinds of frozen answer are affected, and only one of them is a loss.**

*The layouts.* `color` drops out of every set in every compared layout - the
27 imports, the 54 `normalizeLayout` helper calls, the layouts inside the
containers, and the round trip at the end. Skipped by where it sits and not by
name alone, exactly as `active` is: `sets[N].color` and nothing else, so the
day some other thing is called a colour it is still compared.

*The documents this writer produces.* `ext_vorlaut_color` on a board and
`border_color` on a button drop out of the 8 exports and out of the zip
members. **Only on documents this module wrote.** A document read back from a
container keeps both fields compared, because a board arrives as the dictionary
it was parsed from - a foreign board's own `border_color` is preserved and has
to go on being preserved, and narrowing that too would have stopped checking
the one thing about these fields that is still true.

*`cssColor()`.* This is the loss: the function is gone, so its 10 frozen
answers cannot be asked of anything. They were the only frozen record of what
this project did with a malformed colour - `#abc` expanded, a missing `#`
supplied, `#12345` and `no colour at all` falling back to `#3B5BDB`. Nothing
here can hold anything to that any more, and nothing needs to: there is no
colour to normalize. app_package.ts has a `cssColor` of its own for word-class
colours, which is a different function on a different input - a literal out of
WORD_CLASSES, never a value somebody typed - and it is not what these answers
were about.

The rest of the lock keeps its full value. The board id, the buttons, the grid,
the images, the licence, the locale, the ring, the container and the zip
members are all still held to what obf.py said, and the members are still
compared as text, so sorted keys and two-space indent are still held too."""

THE_CAP_MOVED = """the cap on how many sets a layout may hold.

It used to be two numbers - author up to 25, mark 5 to ship - and collapsing
the distinction above collapsed them into one: how many sets a Sammlung may
hold and how many the device has room for stopped being two questions.
normalizeLayout() holds the second, where obf.py refused more than 25 and
separately refused a sixth *active* set.

**The cap has moved twice, and the second move is what empties this
narrowing.** The one cap was five while the device's MAX_SETS was five; it is
sixty-four now, because the firmware's is - see the note on LIMITS in
src/core/boot_data.ts. Six frozen normalizeLayout cases hand more sets than
obf.py would take, and they hand six, six, six, seven, twenty-five and
twenty-six of them. Under a cap of five all six were refusals, and five of them
were held here to refusing rather than to their wording. Under a cap of
sixty-four not one of them is over the cap at all.

So what these cases can be held to now is decided by their frozen answer rather
than by the new cap:

*Five recorded refusals are set aside.* Four name a cap on *active* sets, which
is ACTIVE_IS_GONE's flag and cannot be asked for; the fifth names the cap of
25, which no longer exists either. All five describe a document this module now
accepts, and accepting it is correct, so there is nothing left in them to
compare. Named and counted below rather than filtered quietly, the way
cssColor's ten answers are.

*The sixth is a gain.* It is the case obf.py answered - six sets of which five
were active - and its frozen value comes back into the comparison, because the
only reason it was held to a refusal was a cap that has moved past it.

What is lost is the coverage: no recorded case reaches sixty-four sets, so the
lock no longer says anything about over-cap refusal, which is the half of this
that was still a fact about the mapping. It is not re-frozen - the oracle is
gone, and a lock written from the module under test is the module compared
against itself. tests/unit/collection_cap.test.ts carries that property
instead, as an authored check rather than a recorded answer. The check below
stays, so a lock that ever gains a case past the cap is still held to it."""

THE_KEYS_ARE_FIVE = """a page holding four keys beside a set key, rather than five.

A BoardSet was four `slots` and, beside them, a `symbol` and a `key` for the
fifth panel. It is five equal slots in reading order now - core/types.ts says
why, and vorlaut-diy-talker's adr/0020 is where the device settled it. Every
frozen layout in this lock is written the old way, so every one of them has to
be brought to the new shape before it can be compared with anything.

**The direction decides what this costs, and the two directions are not alike.**

*A layout becoming a document.* Transformed, and it loses nothing at all. The
lock's input layout is brought forward exactly as data/upgrade.ts brings a
stored one forward - the set key becomes the slot at PAGE_KEY, and the ring
becomes a `goto` at the following page - and **the frozen document is compared
unchanged**. That is the whole byte-for-byte claim of this change, held against
obf.py's own answers: a Sammlung nobody has touched exports the file it
exported. The eight exports and the eight zips are checked that way, members
and all, and a single byte moving anywhere in them fails here.

*A document becoming a layout.* Two things in the frozen answer cannot be
brought forward, and they are narrowed rather than guessed at.

  `sets[N].id`. Which pages get an id is decided by which pages a key names,
  and the ring is a key that names one now - so a document this file wrote
  comes back with an id on every page where it used to come back with none.
  The rule itself did not change and tests/unit/import_acts.test.ts holds it
  ("gives an id only to the pages a key actually names"); what changed is how
  many keys there are to do the naming.

  `sets[N].slots[PAGE_KEY].act`. The ring's target is a board id out of the
  document, and Python cannot say which board that is without walking the
  links - which would be this file re-implementing the reader it is checking,
  and then agreeing with itself. The `text` and the `symbol` of that key ARE
  compared, because both are re-derivable: they were `key.text` and `symbol` on
  the frozen set.

*And a document written by other software is set aside entirely.* The old
reader took a foreign board's first link as its set key and dropped the rest;
the new one reads the cells in order and reads every link. That is a different
answer to a different rule, so those frozen slot lists describe something that
is gone rather than something that moved, and no transformation can reach them.
They are named and counted below. What carries the new rule instead is an
authored check - "reads a foreign board as the keys it has, links and all" in
tests/unit/import_acts.test.ts - which is the arrangement THE_CAP_MOVED already
uses for its own lost coverage.

*The 54 normalizeLayout answers* are transformed on both sides: the argument is
brought forward and so is the frozen result. What that stops measuring is the
padding of a short page, because the argument arrives already five keys long -
tests/unit/upgrade.test.ts carries the padding as an authored check.

The refusals about slot counts are rewritten by the same rule, since a page
that held one too many now holds one too many of five: `has N slots, exactly 4`
becomes `has N+1 slots, exactly 5`. Nothing else in any sentence is touched."""

# The two counts inside a refusal about how many keys a page holds. Rewritten
# rather than set aside, because the sentence still says exactly what it said -
# there is one key more in the page and one more allowed.
A_SLOT_REFUSAL = re.compile(r"has (\d+) slots, exactly (\d+) are allowed\.")

# core/types.ts's PAGE_KEY: which of the five sits on the panel the device
# prints the page's name on. Written here rather than read out of the module,
# because a frozen answer transformed by a number the module under test
# supplies is a transformation the module could quietly move.
PAGE_KEY = 2

# What the ring's target is called, where the frozen layout named no page at
# all. Any string will do - it never reaches a document, because a document
# names boards by their own ids - but it has to be the same on both sides of a
# comparison, so it is derived from the position.
def _lock_id(at: int) -> str:
    return f"lock-page-{at + 1}"


def _page_key_slot(page: dict, ring: dict) -> dict:
    """The set key of an old page, as the slot it becomes.

    data/upgrade.ts's keyAsSlot(), written again here rather than ported: the
    whole value of a frozen reference is that the two sides were arrived at
    separately.

    `text` and `symbol` are carried across raw, whatever they are. A frozen
    argument may hold a number or a null where a string belongs - four of the
    54 normalizeLayout cases do - and it is normalizeLayout's own business what
    those become. Tidying them here would be this file answering the question
    it is asking.
    """
    key = page.get("key") if isinstance(page.get("key"), dict) else {}
    act = key.get("act") if isinstance(key.get("act"), dict) else ring
    slot = {"text": key.get("text", ""), "symbol": page.get("symbol", "")}
    if act.get("kind") != "speak":
        slot["act"] = act
    return slot


def five_keys(layout, pad: bool = False):
    """One layout, brought forward to five keys a page. THE_KEYS_ARE_FIVE.

    The four keys keep their reading order and the fifth goes in at PAGE_KEY,
    which is the cell it was always drawn on. A page with fewer than four keys
    gets nulls in the gaps rather than empty keys: a short page wrote fewer
    buttons than five and has to go on writing fewer, so the hole has to stay a
    hole. src/data/obf.ts skips a slot that is not there for the same reason.

    `pad` fills a short page up to four keys instead, which is what an
    *argument to normalizeLayout* needs: that function pads on the way through,
    so an argument left sparse would come back with keys where this put holes.
    A frozen *answer* has been padded already by the normalize that produced it.
    """
    if not isinstance(layout, dict) or not isinstance(layout.get("sets"), list):
        return layout
    pages = [one for one in layout["sets"] if isinstance(one, dict)]
    ids = [one.get("id") if isinstance(one.get("id"), str) and one.get("id")
           else _lock_id(at) for at, one in enumerate(pages)]
    for at, page in enumerate(pages):
        held = page.get("slots")
        slots = list(held) if isinstance(held, list) else []
        if pad:
            slots = slots + [{"text": "", "symbol": ""}] * max(0, 4 - len(slots))
        else:
            slots = slots + [None] * max(0, PAGE_KEY - len(slots))
        ring = {"kind": "goto", "set": ids[(at + 1) % len(ids)]}
        page["slots"] = slots[:PAGE_KEY] + [_page_key_slot(page, ring)] + slots[PAGE_KEY:]
        page["id"] = ids[at]
        page.pop("symbol", None)
        page.pop("key", None)
    return layout


def our_grid(board) -> bool:
    """Whether a board is one src/data/obf.ts wrote, by the shape of its grid.

    ourGrid() over there, and the same three facts: two rows, three columns,
    and a hole in the corner where the speaker is. Stated rather than ported,
    for five_keys()'s reason.
    """
    if not isinstance(board, dict):
        return False
    grid = board.get("grid")
    if not isinstance(grid, dict) or grid.get("rows") != 2 or grid.get("columns") != 3:
        return False
    order = grid.get("order")
    if not isinstance(order, list) or len(order) != 2:
        return False
    top, bottom = order
    return (isinstance(top, list) and isinstance(bottom, list)
            and (top[0] if top else None) is None
            and bool(bottom[0] if bottom else None))


def ours_throughout(document) -> bool:
    """Whether every board in a document is one this file wrote."""
    boards = (document or {}).get("boards")
    if not isinstance(boards, dict) or not boards:
        return False
    return all(our_grid(one) for one in boards.values())


def shift_a_slot_refusal(message: str, counting: bool = True) -> str:
    """A frozen refusal about how many keys a page holds, one key along.

    Two shifts, because the two refusals count different things. normalizeLayout
    counts the keys it was handed, and the argument gained one - so both numbers
    move. documentToLayout counts the buttons on a board, and it counts the same
    buttons it always did; what moved there is only how many are allowed.
    """
    def moved(found: re.Match) -> str:
        held = int(found.group(1)) + (1 if counting else 0)
        return f"has {held} slots, exactly {int(found.group(2)) + 1} are allowed."
    return A_SLOT_REFUSAL.sub(moved, message)


# A refusal obf.py gave about the number of sets, in the two shapes it had: the
# total cap, and the separate cap on the active ones. Matched on the frozen
# sentence rather than on the argument, because what makes these unanswerable
# is what they say - a cap that is gone - and not how many sets they hand over.
A_CAP_REFUSAL = re.compile(r"At most \d+ sets(,| active at once\b)")


def cap_from_the_page() -> int:
    """How many sets a Sammlung holds, read where src/data/obf.ts reads it.

    Out of the source rather than written down here, for the reason
    check_the_module_still_says_the_format() gives: a number restated in a test
    agrees with itself for ever. MAX_SETS is LIMITS.maxSets, so this reads the
    table that declares it.
    """
    found = re.search(r'^export const LIMITS = \{"maxSets": (\d+)\};',
                      (ROOT / "src" / "core" / "boot_data.ts").read_text(
                          encoding="utf-8"), re.M)
    if not found:
        raise SystemExit("src/core/boot_data.ts no longer declares LIMITS.maxSets")
    return int(found.group(1))


# The lines that no longer appear in a board this module writes, at the indent
# they sit at: ACTIVE_IS_GONE's one field at the top level of a board,
# THE_COLOUR_IS_GONE's one there and one inside every button.
DEAD_LINES = (
    '  "ext_vorlaut_active":',
    '  "ext_vorlaut_color":',
    '      "border_color":',
)


def without_the_dead_fields(lock: dict) -> dict:
    """The frozen zip members, with the lines nothing writes taken out.

    The members are compared as text, not as parsed JSON, and deliberately:
    that is what holds the writer to sorted keys and two-space indent - see
    "sort_keys dropped from the board JSON" in docs/frozen-references.md. So a
    field is removed by deleting its line rather than by re-serializing, and
    every remaining byte still has to match.

    Safe to do line-wise, and the reason is the sorted keys: none of the three
    is ever last in its object, so its trailing comma goes with it and never
    orphans another. `ext_vorlaut_active` and `ext_vorlaut_color` sit at the
    top level of a board and are followed by `format`, `id` and `name` at the
    least; `border_color` sorts before every other key a button can have, and
    every button has an `id`.
    """
    for entry in lock["zips"]:
        for member in entry["members"]:
            member["text"] = "".join(
                line + "\n" for line in member["text"].split("\n")[:-1]
                if not line.startswith(DEAD_LINES)
            ) + member["text"].split("\n")[-1]
    return lock


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + (f"   {detail}" if detail else ""))
    if not ok:
        failures.append(name)


# THE_COLOUR_IS_GONE: the two fields a board this module writes used to carry
# the set colour in. Passed only where the document under comparison is one
# this module produced - see the note at the call sites, and the paragraph in
# THE_COLOUR_IS_GONE about why a document read from a container is not one.
COLOUR_WRITTEN = frozenset({"ext_vorlaut_color", "border_color"})


# THE_KEYS_ARE_FIVE: what a frozen layout cannot say about the new shape. The
# id of a page, because the ring now names every page; and the act of the key
# on the page-key panel, because the ring's target is a board id this file
# would have to walk the document to know.
UNREACHABLE_AFTER_FIVE = (
    re.compile(r"^sets\[\d+\]$"),
    re.compile(rf"^sets\[\d+\]\.slots\[{PAGE_KEY}\]$"),
)


def moved_with_the_fifth_key(key: str, path: str) -> bool:
    """Whether this field is one THE_KEYS_ARE_FIVE cannot answer for."""
    if key == "id" and UNREACHABLE_AFTER_FIVE[0].fullmatch(path):
        return True
    return key == "act" and UNREACHABLE_AFTER_FIVE[1].fullmatch(path)


def difference(want, got, path: str = "", ours: bool = False) -> str | None:
    """Where two answers stop agreeing, as one line naming the field.

    The same function tests/test_obf_js.py has, written out again rather than
    imported: that file imports obf, and the whole point of this one is that
    it runs when there is no obf to import.

    `ours` says the thing being compared is a document this module wrote, which
    is what makes it safe to stop comparing the colour fields in it.
    """
    where = path or "the answer"
    if isinstance(want, dict) and isinstance(got, dict):
        for key in sorted(set(want) | set(got)):
            # ACTIVE_IS_GONE, and THE_COLOUR_IS_GONE's half of it. Skipped
            # where they sit rather than by name alone, so that the day some
            # other field is called "active" or "color" it is still compared:
            # these are the set entry's flag, the board's copy of it, and the
            # set entry's colour, and nothing else.
            if key == "ext_vorlaut_active" or (
                    key in ("active", "color")
                    and re.fullmatch(r"sets\[\d+\]", path)):
                continue
            if ours and key in COLOUR_WRITTEN:
                continue
            # THE_KEYS_ARE_FIVE, by where it sits and not by name alone, like
            # the two above: an `id` anywhere but on a set entry is still
            # compared, and so is an `act` on any of the other four keys.
            if moved_with_the_fifth_key(key, path):
                continue
            if key not in want:
                return f"{where}: JavaScript adds {key!r}"
            if key not in got:
                return f"{where}: JavaScript is missing {key!r}"
            found = difference(want[key], got[key],
                               f"{path}.{key}" if path else key, ours)
            if found:
                return found
        return None
    if isinstance(want, list) and isinstance(got, list):
        if len(want) != len(got):
            return f"{where}: {len(want)} entries frozen, {len(got)} in JavaScript"
        for index, (one, two) in enumerate(zip(want, got)):
            found = difference(one, two, f"{path}[{index}]", ours)
            if found:
                return found
        return None
    if want != got:
        return f"{where}: {want!r} frozen, {got!r} in JavaScript"
    return None


def ask_node(jobs: dict) -> dict:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False,
                                     encoding="utf-8") as handle:
        json.dump(jobs, handle)
        payload = handle.name
    try:
        result = subprocess.run([JS_RUNNER, str(DRIVER), payload],
                                capture_output=True, text=True)
    finally:
        Path(payload).unlink(missing_ok=True)
    if result.returncode != 0:
        raise SystemExit("src/data/obf.ts does not run:\n" + result.stderr)
    # A zero exit with nothing on stdout used to reach json.loads and come back
    # as "Expecting value: line 1 column 1", which says nothing about what
    # happened. Whatever the loader put on stderr is the actual explanation.
    if not result.stdout.strip():
        raise SystemExit(
            "the harness exited cleanly and printed nothing.\n" + result.stderr)
    return json.loads(result.stdout)


def over_the_cap(args: list, cap: int) -> bool:
    """Whether a normalizeLayout argument holds more sets than fit."""
    return (bool(args) and isinstance(args[0], dict)
            and isinstance(args[0].get("sets"), list)
            and len(args[0]["sets"]) > cap)


def set_aside_by_the_cap(one: dict, cap: int) -> bool:
    """Whether a frozen answer is a refusal only a cap that is gone explains.

    THE_CAP_MOVED. Both halves have to hold: the recorded answer refuses the
    document for the number of its sets, and the document is one the cap in
    force now accepts. A case still over the cap keeps its check.
    """
    return (one["call"] == "normalizeLayout" and "error" in one
            and bool(A_CAP_REFUSAL.match(one["error"]))
            and not over_the_cap(one["args"], cap))


def compare_import(name: str, want: dict, answer: dict) -> None:
    """One frozen document-to-layout answer, brought forward - THE_KEYS_ARE_FIVE.

    Three shapes, and which one this is decided by the document rather than by
    the answer:

    *A refusal* about how many keys a page holds moves one key along; any other
    refusal is compared word for word as it always was.

    *A document this file wrote* has its frozen layout brought forward, and
    difference() drops the two fields that cannot be. Everything else - the
    names, the order, the language, the voice, the other four keys - is held to
    obf.py exactly as before.

    *Anybody else's document* keeps every field except the pages' keys, which
    describe a placement rule that is gone rather than one that moved.
    """
    if "error" in want:
        want = {**want, "error": shift_a_slot_refusal(want["error"], counting=False)}
        compare(name, want, answer)
        return
    if ours_throughout(want.get("document")):
        compare(name, {"value": five_keys(deepcopy(want["value"]))}, answer)
        return
    setaside.append(name)
    compare(name, {"value": without_the_pages_keys(want["value"])},
            {**answer, "value": without_the_pages_keys(answer.get("value"))}
            if "value" in answer else answer)


def without_the_pages_keys(layout):
    """A layout with every page's keys taken out, and nothing else touched."""
    if not isinstance(layout, dict) or not isinstance(layout.get("sets"), list):
        return layout
    stripped = deepcopy(layout)
    for page in stripped["sets"]:
        if isinstance(page, dict):
            page.pop("slots", None)
            page.pop("symbol", None)
            page.pop("key", None)
            page.pop("id", None)
    return stripped


def compare(name: str, want: dict, answer: dict, ours: bool = False) -> None:
    """One frozen answer against one from the JavaScript.

    Both are {"value": ...} or {"error": "..."}, so a case obf.py refused is
    compared as a refusal and its sentence, not merely as "something went
    wrong". A converter that throws where the oracle answered is as broken as
    one that answers differently.

    `ours` is difference()'s, and reaches only the callers that hand over a
    document this module wrote.
    """
    if "error" in want and "error" in answer:
        same = want["error"] == answer["error"]
        check(name, same, "" if same else
              f"frozen {want['error']!r}, JavaScript says {answer['error']!r}")
        return
    if "error" in want:
        check(name, False,
              f"obf.py refused it ({want['error']}), JavaScript did not")
        return
    if "error" in answer:
        check(name, False, f"JavaScript refused it: {answer['error']}")
        return
    found = difference(want["value"], answer["value"], ours=ours)
    check(name, found is None, found or "")


def check_the_module_still_says_the_format(lock: dict) -> None:
    """The one constant a document is stamped with.

    Read out of the text rather than out of node, and against the lock rather
    than against obf.py, so that it keeps working when there is no obf.py. A
    format string that moved would make every frozen document wrong in a way
    the field comparison would report as forty failures.
    """
    found = re.search(r'^export const FORMAT = "([^"]+)";',
                      MODULE.read_text(encoding="utf-8"), re.M)
    check("src/data/obf.ts declares FORMAT", found is not None)
    if found:
        agrees = found.group(1) == lock["format"]
        check("and it is the format the answers were frozen under", agrees,
              "" if agrees else f"js {found.group(1)} vs frozen {lock['format']}")


def check_the_fixtures_are_intact(lock: dict) -> None:
    """The frozen answers are about these files and no others."""
    bad = []
    for entry in lock["containers"]:
        path = REFERENCE / entry["file"]
        if not path.is_file():
            bad.append(entry["file"] + " (gone)")
        elif hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
            bad.append(entry["file"])
    check("every frozen file is the one that was read", not bad,
          "" if not bad else
          f"changed: {', '.join(bad)} - restore them from git rather than "
          f"editing. tools/obffreeze.py cannot rewrite them: it is still in "
          f"tools/, but what it imports went with the Python half - "
          f"docs/frozen-references.md, under The board as a document")


def check_the_written_zips(lock: dict, answers: list) -> None:
    """What the browser packs, against what write_obz() packed.

    Byte-identical zips are not available: two deflate implementations agree
    about the format and not about the output. So the file is opened with
    Python's own zipfile - which is not going anywhere - and what is inside it
    is compared, along with the fixed timestamp and mode that make the same
    document the same file twice.
    """
    for entry, answer in zip(lock["zips"], answers):
        name = entry["name"]
        if "error" in answer:
            check(f"{name}: the zip was written", False,
                  f"JavaScript refused it: {answer['error']}")
            continue
        path = REFERENCE / "written.obz.tmp"
        path.write_bytes(base64.b64decode(answer["value"]))
        try:
            with zipfile.ZipFile(path) as bundle:
                got = [{"name": info.filename,
                        "text": bundle.read(info.filename).decode("utf-8"),
                        "date_time": list(info.date_time),
                        "external_attr": info.external_attr,
                        "compress_type": info.compress_type}
                       for info in bundle.infolist()]
        except (zipfile.BadZipFile, UnicodeDecodeError) as exc:
            check(f"{name}: the zip opens and holds text", False, str(exc))
            path.unlink()
            continue
        path.unlink()
        names = [one["name"] for one in got]
        wanted = [one["name"] for one in entry["members"]]
        if names != wanted:
            check(f"{name}: the same members in the same order", False,
                  f"{wanted} vs {names}")
            continue
        # Not ours=True: a member is {"name", "text", ...} and the text is one
        # string, so there is no colour field here to skip - the lines were
        # taken out of the frozen text before the comparison, by
        # without_the_dead_fields().
        found = difference(entry["members"], got)
        check(f"{name}: {len(wanted)} member(s), byte for byte and stamp for "
              f"stamp", found is None, found or "")


def main() -> int:
    if not LOCK.is_file():
        print(f"  {LOCK} is missing - restore it from git. It is frozen "
              f"obf.py output, and tools/obffreeze.py cannot write it again: "
              f"the tool is still in tools/, but what it imports went with "
              f"the Python half. There is nothing to compare against "
              f"without it.")
        return 1
    if not MODULE.is_file():
        print(f"  {MODULE} is missing")
        return 1
    lock = without_the_dead_fields(json.loads(LOCK.read_text(encoding="utf-8")))

    check_the_module_still_says_the_format(lock)
    check_the_fixtures_are_intact(lock)

    if not have_js():
        print("  skipped: node is not installed, so src/data/obf.ts was not run. "
              "Only the format and the fixtures were checked.")
        return 1 if failures else 0

    answers = ask_node({
        # THE_KEYS_ARE_FIVE. A normalizeLayout argument is padded on the way
        # through, so its pages are brought forward with `pad`; everything else
        # here is a layout that has already been normalized.
        "helpers": [{"call": one["call"],
                     "args": ([five_keys(deepcopy(one["args"][0]), pad=True)]
                              + one["args"][1:]
                              if one["call"] == "normalizeLayout" and one["args"]
                              else one["args"])}
                    for one in lock["helpers"]],
        "exports": [five_keys(deepcopy(one["layout"])) for one in lock["exports"]],
        "imports": [one["document"] for one in lock["imports"]],
        "licensing": [one["document"] for one in lock["licensing"]],
        "obz": [five_keys(deepcopy(one["layout"])) for one in lock["zips"]],
        "unobz": [{"name": Path(one["file"]).name,
                   "base64": base64.b64encode(
                       (REFERENCE / one["file"]).read_bytes()).decode("ascii")}
                  for one in lock["containers"]],
    })

    print("\n--- the helpers, on the arguments that bite --------------------")
    cap = cap_from_the_page()
    # THE_COLOUR_IS_GONE. Counted and named rather than quietly filtered: these
    # are ten recorded answers that nothing can be asked for any more, which is
    # a price and reads like one only if it is printed.
    dead = [one for one in lock["helpers"] if one["call"] == "cssColor"]
    if dead:
        print(f"  --    {len(dead)} cssColor answer(s): set aside, the "
              f"function went with the colour (THE_COLOUR_IS_GONE)")
    # THE_CAP_MOVED, counted the same way and for the same reason.
    stale = [one for one in lock["helpers"] if set_aside_by_the_cap(one, cap)]
    if stale:
        print(f"  --    {len(stale)} normalizeLayout refusal(s): set aside, "
              f"they name caps that are gone and none of them is over the "
              f"cap of {cap} (THE_CAP_MOVED)")
    for one, answer in zip(lock["helpers"], answers["helpers"]):
        if one["call"] == "cssColor":
            continue
        name = f"{one['call']}({', '.join(repr(a) for a in one['args'])})"
        name = name[:87] + "...)" if len(name) > 90 else name
        # THE_CAP_MOVED. A case still over the cap is held to refusing, which
        # is the part of the frozen answer that is a fact about the mapping
        # rather than about a sentence obf.py wrote. No recorded case is, at a
        # cap of 64; this stands for a lock that ever gains one.
        if one["call"] == "normalizeLayout" and over_the_cap(one["args"], cap):
            check(f"{name}: more than {cap} sets, and refused",
                  "error" in answer,
                  answer.get("error", "JavaScript normalized it anyway"))
            continue
        # And one that is under it, whose frozen answer refuses it for being
        # over a cap that has since moved, has nothing left to say.
        if set_aside_by_the_cap(one, cap):
            continue
        # THE_KEYS_ARE_FIVE, on the answer this time: the frozen layout is
        # brought forward the same way the argument was, and a refusal about
        # how many keys a page holds is moved one key along with it.
        if one["call"] == "normalizeLayout":
            one = dict(one)
            if "value" in one:
                one["value"] = five_keys(deepcopy(one["value"]))
            elif "error" in one:
                one["error"] = shift_a_slot_refusal(one["error"])
        compare(name, one, answer)

    print("\n--- a layout becomes the frozen document -----------------------")
    print("        THE_KEYS_ARE_FIVE: the layout going in was brought forward, "
          "the document is compared as frozen")
    for one, answer in zip(lock["exports"], answers["exports"]):
        # ours=True: this is the writer's own output, so THE_COLOUR_IS_GONE's
        # two fields are not compared. The import and container comparisons
        # below deliberately do not pass it - a foreign board's border_color
        # arrives in the dictionary it was parsed from and must still survive.
        compare(one["name"], {"value": one["document"]}, answer, ours=True)

    print("\n--- and a document the frozen layout ---------------------------")
    for one, answer in zip(lock["imports"], answers["imports"]):
        compare_import(one["name"], one, answer)

    if setaside:
        print(f"  --    {len(setaside)} foreign document(s): the pages' keys "
              f"set aside, the placement rule they describe is gone "
              f"(THE_KEYS_ARE_FIVE)")
    print("\n--- METACOM cannot be handed over as pixels --------------------")
    for one, answer in zip(lock["licensing"], answers["licensing"]):
        compare(one["name"], one, answer)

    print("\n--- the zip the browser writes ---------------------------------")
    check_the_written_zips(lock, answers["obz"])

    print("\n--- and the files Python packed --------------------------------")
    for one, answer in zip(lock["containers"], answers["unobz"]):
        name = one["name"]
        if "error" in one:
            if one["wording"]:
                compare(name, one, answer)
            else:
                # Both refuse; the reason inside the message is zipfile's on
                # one side and the browser's on the other, and holding one
                # library's wording against the other's would be a test about
                # error strings rather than about a document.
                check(f"{name}: refused, as it was when frozen",
                      "error" in answer,
                      answer.get("error", "JavaScript read it anyway"))
            continue
        if "error" in answer:
            check(name, False, f"JavaScript refused it: {answer['error']}")
            continue
        got = answer["value"]
        found = difference(one["document"],
                           {k: v for k, v in got.items() if k != "layout"})
        check(f"{name}: the same document", found is None, found or "")
        # THE_KEYS_ARE_FIVE, the same reading the imports get one section up:
        # the layout inside a container is documentToLayout's answer.
        compare_import(f"{name}: and the same layout",
                       {"document": one["document"], "value": one["layout"]},
                       {"value": got["layout"]})

    # The whole way round, through the real container: the browser's own zip,
    # read by the browser. Circular on its own, and not circular after the
    # comparison above - those members are known to be the ones Python packed.
    print("\n--- the browser's own file, back through its own reader --------")
    written = [{"name": f"{one['name']}.obz", "base64": answer["value"]}
               for one, answer in zip(lock["zips"], answers["obz"])
               if "error" not in answer]
    if written:
        for one, answer in zip(lock["zips"],
                               ask_node({"unobz": written})["unobz"]):
            # A layout with no sets is a document with no board in it, and
            # that is a file neither implementation will read back - obf.py
            # refuses the one it wrote itself. So the empty case is held to
            # refusing rather than to answering.
            if not one["layout"]["sets"]:
                check(f"{one['name']}: has no board in it, and says so",
                      "error" in answer,
                      answer.get("error", "JavaScript read it anyway"))
                continue
            if "error" in answer:
                check(one["name"], False, f"refused its own file: {answer['error']}")
                continue
            # THE_KEYS_ARE_FIVE. The layout that went in is the frozen one
            # brought forward, exactly as it was handed to the writer above -
            # so this is still "what went in came back", with the two fields
            # difference() cannot answer for dropped.
            found = difference(five_keys(deepcopy(one["layout"])),
                               answer["value"]["layout"])
            check(f"{one['name']}: comes back as the layout that went in",
                  found is None, found or "")

    if failures:
        print(f"\n  {len(failures)} problem(s): {', '.join(failures[:6])}"
              + (" ..." if len(failures) > 6 else ""))
        return 1
    print("\n  All good.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
