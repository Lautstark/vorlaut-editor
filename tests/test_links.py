#!/usr/bin/env python3
"""Checks that every relative link in the documentation still leads somewhere.

Markdown does not fail on a broken link. A path that no longer exists renders
as a link like any other and gives way when it is clicked; an anchor that
names a heading nobody wrote any more is worse, because the browser silently
lands at the top of the file and the reader believes they are in the right
place and reads the wrong section.

That is not hypothetical here. The documentation was one file that grew into
two, and the sections did not all stay on the side the links assumed. Two
anchors pointing at a heading that had moved to the other file would have
looked exactly like two anchors that worked.

So both halves of a link are checked: the file has to exist, and if there is a
`#something` after it, some heading in that file has to actually produce that
anchor. The anchors are derived the way GitHub derives them - lowercased,
punctuation dropped, spaces turned into hyphens, and a repeated heading
counted up - because that is what decides whether the link works when somebody
reads the file on the web rather than in an editor.

**This is a copy, and it is half the file it is in Lautstark/vorlaut-diy-talker.**
Both halves of the split need this check - the finding is in that repository's
docs/split-rehearsal.md section 5 - but they do not need the same halves of it.
Two things are missing here on purpose, and neither is an omission to be
tidied back in:

  * **The written-out `docs/*.md` mentions.** That check exists because half
    the references into the documentation live in comments, where there is no
    link syntax and a file name is simply written out - and nothing about one
    looks broken after a rename. 187 of them at the last count, and `adr/` and
    `docs/` both went with the talker, so the files they name are not in this
    repository and cannot be checked from it. Every such path in this
    repository's comments is a cross-repository citation now; the check that
    they lead somewhere is the one running next door, over the files they
    actually name.

  * **The named sketches.** It read .github/workflows/ci-firmware.yml and
    firmware/, and this repository has neither.

What is left is the half this repository does need: the relative links and
anchors in its own prose, which is README.md, CLAUDE.md and the two files under
exchange/. Those go somewhere or they do not, exactly as before.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Fenced blocks are examples, not prose: a link inside one is being shown, not
# followed, and a line starting with # in a shell block is a comment and not a
# heading.
FENCE = re.compile(r"^\s*(```|~~~)")

# [text](target) and ![alt](target), with an optional "title" after the path.
LINK = re.compile(r"!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+\"[^\"]*\")?\s*\)")

HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")

# Links that are somebody else's problem.
EXTERNAL = re.compile(r"^(https?:|mailto:|tel:|ftp:|//|/)")

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}" + (f"   {detail}" if detail else ""))
    if not ok:
        failures.append(name)


def tracked(pattern: str = "") -> list[str]:
    command = ["git", "ls-files"] + ([pattern] if pattern else [])
    out = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                         check=True)
    return out.stdout.split()


def without_fences(text: str) -> str:
    """The same text with fenced code blocks blanked out, line count intact."""
    kept, inside = [], False
    for line in text.split("\n"):
        if FENCE.match(line):
            inside = not inside
            kept.append("")
            continue
        kept.append("" if inside else line)
    return "\n".join(kept)


def slug(heading: str) -> str:
    """The anchor GitHub gives a heading.

    Inline code and link syntax are unwrapped first - what counts is the text
    the reader sees, so `layout.json` becomes layout.json and then layoutjson.
    """
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", heading)
    text = text.replace("`", "").replace("*", "").replace("_", " ")
    text = text.lower()
    # Everything that is not a letter, a digit, a space or a hyphen goes; what
    # is left keeps its spaces, which then become the hyphens.
    text = re.sub(r"[^\w\- ]", "", text, flags=re.UNICODE).replace("_", "")
    return text.strip().replace(" ", "-")


def anchors_of(path: Path) -> set[str]:
    """Every anchor the headings of one file offer.

    A heading repeated in the same file gets counted up, the way GitHub does
    it: the second `## Pairing` answers to pairing-1.
    """
    found: set[str] = set()
    seen: dict[str, int] = {}
    for line in without_fences(path.read_text(encoding="utf-8")).split("\n"):
        matched = HEADING.match(line)
        if not matched:
            continue
        base = slug(matched.group(2))
        if not base:
            continue
        count = seen.get(base, 0)
        seen[base] = count + 1
        found.add(base if count == 0 else f"{base}-{count}")
    return found


def check_markdown_links() -> None:
    anchor_cache: dict[Path, set[str]] = {}

    for name in tracked("*.md"):
        source = ROOT / name
        broken: list[str] = []
        links = LINK.findall(without_fences(source.read_text(encoding="utf-8")))
        for target in links:
            if EXTERNAL.match(target):
                continue
            path_part, _, anchor = target.partition("#")
            destination = source.parent / path_part if path_part else source

            if not destination.exists():
                broken.append(f"{target} - no such file")
                continue
            if not anchor or destination.suffix != ".md":
                continue
            if destination not in anchor_cache:
                anchor_cache[destination] = anchors_of(destination)
            if anchor.lower() not in anchor_cache[destination]:
                broken.append(f"{target} - no heading makes #{anchor}")

        check(f"{name}: {len(links)} link(s)", not broken)
        for problem in broken:
            print(f"          {problem}")


def main() -> int:
    check_markdown_links()

    if failures:
        print(f"\n  {len(failures)} problem(s)")
        return 1
    print("\n  All good.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
