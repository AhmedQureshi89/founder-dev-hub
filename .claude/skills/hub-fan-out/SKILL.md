---
name: hub-fan-out
description: Run step ③ of the hub workflow — the intake fan-out that decides which code repos a brief really touches. Spawn one subagent per repo in hub.json, each reading only its own tree and answering "which REQs of this brief are mine?", record every answer verbatim in a ▶ <ID> — intake fan-out note under the item's roadmap row in the fixed shape, adjudicate the hand-overs by reading, then hand the blocks to hub-cross-review. Use this skill whenever a brief has just been filed by hub-intake and sits at INTAKE, whenever a brief's header says the fan-out is still to be run, and whenever anyone asks "run the fan-out", "fan out X-〈n〉", "which repos does this brief touch", "is the worker / the API / the web app involved in this", "who owns this REQ", or "/hub-fan-out" — even for a brief that looks hub-only or single-repo, because a "no" that is assumed rather than read is exactly how a cross-repo item loses a half.
---

# Hub fan-out — step ③ of the hub workflow

A brief names a problem, not a repo. Deciding which repos it becomes is the step that goes wrong
the same way every time: one session reads one repo and concludes about the item. This skill is
the procedure that replaces that — one read per repo, none able to see the others, written down
as returned, then challenged. **The session follows it; the session spawns the agents.** A
subagent cannot fan out.

**Bound by:** the hub's two checks for *which repos a brief becomes* — assign from the success
metric (whoever owns the **last event** in the metric chain is on the critical path by
definition), and tag every requirement with a repo, then count (any repo holding one or more REQ
gets a half-row and a triad of its own) — and *then tag it, and the tag is checked* (`specs_check.py`
R13 / R13c). Where this file and the hub's `CLAUDE.md` disagree, `CLAUDE.md` wins. What went wrong
before, and the runs this shape is read from: [`references/why.md`](references/why.md). The prompt
and the note to copy from: [`references/templates.md`](references/templates.md).

```
   brief filed (② hub-intake, INTAKE)
        │
        ▼
   0 inputs ──► 1 one agent per repo, one turn ──► 2 the note ──► 3 round two by reading ──► 4 hand off to ④
                  WEB │ API │ JOB  (hub.json)        six parts       every names: line         hub-cross-review
                  each its own tree                  fixed heading   answered file:line        verdicts, then ⑤ rows
```

## 0. Write the inputs down before anything is spawned

From the brief: the REQ (or R-) list; the success metric and the **last event** in its chain; every
table, enum, endpoint, event name, copy string and contract the text names; the item's id and its
roadmap row. From `hub.json`: every repo — its `prefix`, `name`, `what`, and `path` (relative to the
hub root; resolve it, do not guess it) — and the hub's `default_branch`.

In the kit's example that table is:

| Prefix | Repo | What | Path (from `hub.json`) |
|---|---|---|---|
| `WEB` | `garden-web` | the web app people use | `repos[0].path` |
| `API` | `garden-api` | the API and the database | `repos[1].path` |
| `JOB` | `garden-worker` | the background jobs that send the reminders | `repos[2].path` |

*Why:* every agent gets the same question and the same list of things to search for. A contract
missing from the list is a contract nobody reads for, and it is the unlisted one that turns out to
belong to the repo everyone assumed was out.

## 1. Spawn one agent per repo, all in one turn

One `Agent` call per repo in `hub.json`, **all in the same turn**, from `references/templates.md` §A.
Each is told: its repo, its `what` and its path; that it reads only that tree and the brief, writes
nothing, runs only read-only git; the question — *which of these REQs are mine?*; the contracts and
key strings from step 0 to search for; and the exact block to return:

```
repo:      <PREFIX — one of hub.json repos[].prefix>
read at:   <commit> on <branch>, <n> dirty files
answer:    YES | NO
reqs:      <REQ ids claimed, or none>
evidence:  <file:line reads, separated by " · " — or the searches that found nothing>
names:     <other repos this answer depends on, or none>
own tree:  <what this tree says that the brief does not — or nothing>
```

`repo · answer · reqs · evidence · names` are the five fields `hub-cross-review` §1 reads, in its
order. `read at:` and `own tree:` are this step's own; step ④ ignores them.

*Why one turn:* an agent spawned after another's answer is already in the transcript can be
steered by it. Reads that cannot see each other is the whole point. *Why the block:* a `NO` with an
empty `evidence:` is legal — that is exactly what the missed half of a cross-repo item looks like
when it is first answered — and it is step ④'s job to refuse it as a verdict, not this step's to
make it look better.

## 2. Write the note, in the shape every fan-out note already has

Under the item's row in `.claude/context/roadmap.md` — the `↩` on the row, the note after the
table, newest first, exactly as `hub-inbox` A.3–A.4 place a note — from
`references/templates.md` §B, heading **fixed**, `<n>` being the number of repos in `hub.json`
written as a word:

```
### ▶ <ID> — intake fan-out, round one: what <n> repos found reading separately
```

Six parts, in this order:

1. **Provenance** (italic): who ran it, when, at which hub commit, per this skill; that nothing
   here is tagged and the cross-review below turns answers into verdicts.
2. **Trees as read** — commit, branch and dirty count per repo, and which are off their
   `default_branch`.
3. **The blocks, as returned** — verbatim, in one fenced block, one per repo.
4. **✅ What the repos reached independently** — a table: finding · which repos, by what route.
5. **🔴 / 🟡 What <repo> found about its own tree that the brief does not say** — numbered, from
   the `own tree:` lines. These shape the triad.
6. **🟡 What the NO repos handed to <the YES repos>** — a table: from · the check · answer. Filled
   in step 3.

*Why the shape:* the receiver of this note is the triad's author, and every earlier note in the
same shape has taught the reader where to look. *Why the heading is fixed:* a code repo's own
triad may cite `▶ <ID> — intake fan-out, round one` by name from its `specs/phase-N/requirements.md`;
a renamed heading breaks the citation without anyone noticing.

## 3. Round two: adjudicate by reading

For every line a block's `names:` hands to another repo — *"API must expose …"*, *"the worker
delivers …"*, *"does `plant_added` fire on the form submit or on the 201?"* — the session opens that
repo's tree (its path from `hub.json`), reads the answer, and writes it with `file:line` into the
hand-over table (part 6).

Spawn a second parallel read **only** when step ④ returns `NEEDS REVIEW` for a repo, and only for
the REQs in question; its block goes under a `round two` heading beneath the first note.

*Why:* in every run so far the contested points were narrow and checkable — a field's name, an
event's timing, a column's owner — and the session is the only relay between agents. A second
round of every agent would cost more than it settled. The `NEEDS REVIEW` case is the one where a
repo's own read is owed, because the challenge found something the first read missed.

## 4. Hand off to step ④

Run `hub-cross-review` on the blocks as they stand. Its verdicts — `YES`, `NO — checked`,
`NEEDS REVIEW` — are what step ⑤ tags and opens rows from. **The fan-out never tags a REQ and never
opens a row.**

*Why:* `specs_check.py` R13 proves an owner was *recorded*, never that it is *right*. A tag that
comes from an agent's own claim has skipped the challenge; a missed half's tag would pass R13.

## 5. Commit the hub

Per `hub-inbox` A.5: pull, read the branch you are on, commit with a message naming the item and
every repo's answer, push at once. If the push is rejected, merge the hub's default branch from
origin, re-run `python tools/specs_check.py . --hub .`, push again.

## Rules this skill must not break

- **One agent per repo in `hub.json`, one turn, none sees another's answer.**
- **Every block carries all five fields.** An empty `evidence:` is data, not a verdict.
- **The session relays.** Agents never message each other.
- **The fan-out never tags.** Verdicts come from step ④; tags and rows are step ⑤.
- **Nothing is written in a code repo's tree.** Read only, every time.
- **The heading pattern is never changed.**
- **`tools/next_id.py`'s output is never quoted as a number** — a mention is a mention, and a hub
  burns an id every time one is.
