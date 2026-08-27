# Working in this repository

This is the editor half of `Lautstark/vorlaut-diy-talker`, split out on
2026-08-27. The conventions below came across with it. **They were written for
a repository with four agents in it at once, and this one has had one so far** —
which is a reason to keep them rather than to drop them: the rules cost a
command each when nobody else is here, and the day a second session starts is
never the day anybody remembers to introduce them. All four exist because on
2026-08-24 three agents independently committed the same repository rename,
none of them wrong to do it.

## 1. The branch name is the only name

A worktree lives at `.claude/worktrees/<branch without the `claude/` prefix>`.
No generated names. A worktree named after one task while holding another
task's branch is how parallel agents become untrackable, so `git worktree list`
is meant to be the whole dashboard:

```bash
git worktree list
```

## 2. Say who you are, first

Before anything else — before reading the task, before the first edit — an
agent records what it is working on:

```bash
git config branch.$(git branch --show-current).description "Agent A - what this branch is for"
```

At spawn time, never retroactively: a description written afterwards is a
reconstruction, and the case that made this rule necessary was one where
authorship could no longer be established at all. Read them all back with:

```bash
git config --get-regexp 'branch\..*\.description'
```

## 3. Repo-wide edits belong on main, and to one session

A repo-wide edit is anything touching unrelated files for a single mechanical
reason: a rename, a mass find-and-replace, a formatting sweep, a dependency
bump, a licence header.

A feature branch never contains one. It lands on `main` in its own session, and
every other branch rebases onto it.

The temptation is to clear the ground before starting the real task — one of
the three duplicate renames said so outright, that it went first so the work
after it had a clean base. That instinct is right and the rule still holds:
ask for it on `main` and wait, rather than doing it yourself.

## 4. Land your own finished work

**Ask about decisions, not about permission to merge.** A design fork, a
tradeoff, something the task did not settle — those are worth stopping for.
Work that is finished and green is not.

From the worktree:

```bash
git push -u origin "$(git branch --show-current)"
```

GitHub answers that with an offer to open a pull request. Ignore it — that hint
comes from GitHub and applies to every repository, and this family has never
merged through a pull request. What the push is actually for is CI.

**Know what that push proves, and what it does not.** Only
`commit-messages.yml` runs on a `claude/**` branch. The tests and Pages trigger
on `main` and on pull requests, so a green branch push means the commit
subjects are well formed and nothing else. Run the rest yourself, and run it
**after `git add`** — `test_links.py` and `test_language.py` take their file
list from `git ls-files`, so an untracked file is invisible to them and the
suite comes up green until you commit:

```bash
git add -A
npm run typecheck && npm test && npm run test:e2e && python3 tests/run.py
```

Then land it:

```bash
git -C <the main checkout> status -sb          # must say main, and be clean
git -C <the main checkout> merge --no-ff "$(git branch --show-current)"
git -C <the main checkout> push origin main
```

`--no-ff` always, even where the branch would fast-forward. A branch stays
visible as a unit that way, which is worth more than a linear history.

Delete the branch and its worktree afterwards, so `git worktree list` stays the
dashboard rule 1 says it is.

## 5. What is not here, and must not arrive

Three things this repository is deliberately not a party to. Each has a test,
and each is the kind of thing that comes back one plausible line at a time.

**The device format.** The editor writes a file and stops; the page that
compiles that file and sends it down a cable is in `vorlaut-diy-talker`, beside
the firmware that reads it — [ADR 0011][adr11] and [ADR 0012][adr12]. `src/`
holds seven numbers and one rounding rule about the device, in `src/device/`,
each of them held against a pinned fixture or a frozen table. Adding an eighth
costs an edit to `tests/unit/device_facts.test.ts` and an argument.

**Code out of `third_party/`.** That directory is a whole checkout of
`vorlaut-diy-talker`, pinned for `device/fixtures/`. It is data. A build, a
test or a tool that reaches into its `loader/` would undo the boundary above in
one line with a plausible reason; `tests/unit/layers.test.ts` is the check and
`third_party/README.md` is the argument.

**A regenerated lock.** `tests/reference/` is governed by
[`docs/frozen-references.md`][frozen] in the other repository, and its rule is
that a lock is never rewritten from the module under test — that leaves the
module compared against itself. A red lock is a finding. The oracles that could
answer for the layout and the tiles went on 2026-08-22.

[adr11]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0011-editor-exports-the-talker-repository-sends.md
[adr12]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/adr/0012-the-repository-splits-editor-leaves.md
[frozen]: https://github.com/Lautstark/vorlaut-diy-talker/blob/main/docs/frozen-references.md
