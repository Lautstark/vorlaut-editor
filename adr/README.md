# Decisions, and why the numbering starts at 0016

This repository's first fifteen ADRs are not here, and they are not missing.
They are in [`Lautstark/vorlaut-diy-talker/adr/`][theirs], where they were
written — the editor was half of that repository until
[ADR 0012][adr12] split it out on 2026-08-27, and 0001 to 0015 were decided
while it still was.

**So the numbering continues rather than restarting.** Every citation already
in this tree says `adr/0011` or `adr/0013` and means the file with that number
next door; a second 0001 here would make every one of those ambiguous, in
comments nobody would think to check. One sequence, two directories, and a
number names one decision wherever it was made.

What that costs is coordination: both repositories take the next free number,
and the day they both take the same one is the day this needs a rule rather
than a paragraph. Read the other directory before claiming a number.

A decision belongs here when it is the editor's alone — the store, the shell,
what an export writes. One that binds the device format, the wire or the
firmware belongs next door, because that is where both implementations of it
are; `CLAUDE.md` §5 is the boundary and `tests/unit/layers.test.ts` is what
holds it.

[theirs]: https://github.com/Lautstark/vorlaut-diy-talker/tree/main/adr
[adr12]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0012-the-repository-splits-editor-leaves.md
