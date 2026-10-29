# The concepts — every word the hub uses, in one page

Each term in two to four sentences, with the file it lives in. Read it once; after that the documents
define themselves.

## The hub

A repository that holds **what** is being built, in what order, by which code repo, and whether it is
done — and none of the code. Your code repos hold the code and the proof. The hub is the one place status
lives, so a question about where anything stands has exactly one answer.

## `hub.json`

One file naming the product, the owner, each code repo (with its id prefix and local path), the id prefixes
for cross-repo work and decisions, and the contributors. Every tool, skill and mod reads it, so a rename
happens once.

## The constitution

`.claude/context/constitution.md` — what the product **is**: who it is for, what each repo owns, the
binding principles, what it is NOT, the promises asserted by tests, the live scorecard, data and privacy.
**It beats the code**: a service that behaves differently is wrong, not the document. It changes only by a
dated amendment on the owner's word. Each code repo's `specs/mission.md` is a pointer to it, never a
document of its own — a mission copied into each repo drifts.

## The roadmap, and the one planning layer

`.claude/context/roadmap.md` — the owner's queue first, then 🔥 NOW (committed), NEXT, LATER, known issues,
and the `▶` notes sessions leave each other. Every item of work in every repo has a row here with an id and
a status; a code repo's own `specs/roadmap.md` says what its phases *are* and carries no status. **One
committed outcome per repo per week** sits in NOW; everything else waits, and *parked means parked*.

## The owner's queue

The roadmap's opening section: every decision and owner-only action waiting on the owner, oldest first,
each pointing at where it is recorded. The commit that records a ruling removes its line; a session that
puts a new question adds one. The `hub-desk` mod shows it in every session, so the owner's part of the work
is always visible.

## Ids and prefixes

`WEB-1`, `API-7`, `X-3`, `D-1`, `KI-2`. The prefix says which repo the work is in (from `hub.json`), or `X`
for cross-repo work whose plan lives in the hub, `D` for a decision only the owner can make, `KI` for a known
issue. **Ids are never reused or renumbered**; `python tools/next_id.py <PREFIX>` reads every hub document
and a mention anywhere takes an id — so hub documents write `X-<next>` until one is issued.

## A brief

`.claude/briefs/<id>.md` — the document that makes a problem real enough to build from: **the problem · the
evidence** as queries anyone can run again, each reading with its date **· the success metric** as a chain of
events with the last one named **· non-goals · who is affected · the verdict gates**. A brief names a
problem, not a feature and not a repo. `/hub-brief` writes one by interview.

## Intake

`/hub-intake` — the act that makes a brief real: the next free id, the text filed **verbatim** below a
header block, one line in the briefs index, one row in the roadmap at 🔲 `INTAKE`, one commit. Above the
rule is the hub's; below the rule is the author's and is never edited. Intake does not judge, rewrite or
start the work.

## The fan-out

`/hub-fan-out` — one agent per repo in `hub.json`, all spawned in one turn, each reading **only its own
tree** and answering *which requirements of this brief are mine?* in a fixed block: repo, what it read, YES
or NO, the REQs claimed, the evidence as `file:line`, the other repos it names, what its tree says that the
brief does not. The blocks are written verbatim into a note under the item's row. The agents never see each
other's answers; Claude relays.

## The cross-review

`/hub-cross-review` — every NO from the fan-out is challenged with three written checks before it is
believed: **C1** does a YES block or a REQ name this repo? **C2** in whose process does the success metric's
**last event** happen — whoever owns it is on the critical path by definition? **C3** read the tree for every
contract the brief names. A NO with any cell blank is a failing output. Verdicts: `YES`, `NO — checked`,
`NEEDS REVIEW`.

## REQ tags, rows and the checker's R13

Every requirement of a cross-repo item carries its owning repo on its own definition line —
`**REQ-X1.4 · API+JOB — …**` — and every repo tagged gets a half-row in the roadmap (`API-1` for the API half
of `X-1`). `tools/specs_check.py` R13 fails a REQ with no tag and a tag whose repo has no row; R13c, run
from a code repo's CI, fails a REQ tagged to that repo that its `specs/` never mentions. The tags prove an
owner was *recorded*; the cross-review is what made it *right*.

## The triad

`specs/phase-N/` in a code repo (or `.claude/context/phase-<id>-<slug>/` in the hub for a cross-repo item):
**`requirements.md`** — what must become true, and why, every `REQ-N.x` numbered, with explicit non-goals;
**`specs.md`** — how, with real file paths and a plan in dependency order; **`verification.md`** — how we
will know, a check per REQ and the verdict gates copied word for word. `/spec-phase` writes it from the
brief; it writes no code.

## A verdict gate 🚦

A measurement with a bar and a date, written in the brief and copied **verbatim** into `verification.md`.
It is taken **once**, on its date, and **never retried for a better number** — a recorded FAIL is a complete
outcome, and a fix is a new item. Checks are written underneath a gate; the gate's text is never edited. If
it cannot be measured, that is a return, not a rewrite.

## A tick

`- [x]` in a `verification.md`. **A tick means verified, not written**: the check was run and its result
recorded. The session that did the work does not tick a verdict gate — it writes a `VERDICT-DRAFT.md` with
the evidence and no verdict, and the owner rules. The checker's R8 fails a phase the roadmap calls done
that still has an open box it owns.

## One REQ per session

`/spec-next` — read the three files, find the first unchecked requirement, write the code, run that
requirement's check, tick the box, commit, **stop**. The next session starts clean instead of inheriting a
long context. `/spec-run` repeats it autonomously and halts at every point that needs the owner.

## A return

`.claude/returns/<item>-<question>.md` — a question back to the brief's author that the implementer cannot
answer: a gate that proves unmeasurable, a brief that assumes something the code contradicts, an ownership
question. **A return blocks, it does not decide**: evidence, options with their costs, a recommendation,
and what has *not* been done. One mark in the returns index — 🔲 open · ✅ ruled · ⛔ closed — set once.

## An inbox note

`### ▶ <ID> — inbox: …` in the roadmap, under the row of the repo that must **act**, with the fact cited as
`file:line`, what that repo does, what it does not, and what is still the owner's. The receiving repo closes
it in place with `✅ PICKED UP`. `python tools/inbox.py <PREFIX>` lists what waits on a repo. Five rules:
read everywhere, write only your own · confirm by reading · note first, then ring · a fix your repo does not
own is a return · the hub is the collision point — pull first, push at once.

## The checker

`tools/specs_check.py` — asserts the rules from every repo's CI: the files exist, every phase carries the
triad and has a row, a done phase has no open boxes, only the one status vocabulary is used, every link
resolves, every cross-repo REQ names an owner that has a row. **It reports and never repairs.**
`python tools/check.py` runs everything the hub's CI runs; the `hub-gate` mod holds `git commit` until it is
green.

## The mods

Code that runs inside Claude Code and can draw. **hub-desk**: a pane with the open inbox notes for this repo
and the owner's queue, re-read after every turn. **hub-gate**: holds `git commit` / `git push` until the
checker exits 0; refuses a contributor's Edit or Write to a protected path. **phase-progress**: a bar of the
current phase's ticked boxes on the default branch, re-counted each time something merges, with a toast.
They load from the hub checkout once Claude Code knows where it is (`/plugin marketplace add <path>`).

## Owner and contributors

The owner rules: merges, gates, production, the governing documents, access, assignments. A contributor
writes their assigned item's code and triad text and an inbox note under their own row, on a branch, by pull
request — and nothing else, including when asked. **A Claude Code session is the person running it**: it
reads `git config user.email`, looks it up in `hub.json`, and applies that person's write set.
`onboarding/team-roles.md` is the record.

## History

`.claude/context/history/` — closed items' triads and notes, moved whole, folder names unchanged, links
re-pointed. Read, never built from. A retired item's requirements are the record of what was tried and
withdrawn, not a spec.
