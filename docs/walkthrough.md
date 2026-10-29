# The walkthrough — one problem, from brief to ruling

This page follows one problem through the hub, with what you type and what you get back. The problem is
the example's: **Pocket Garden** reminds people to water their plants, and nobody can tell whether the
first reminder ever arrives. On a fresh copy of the kit every artifact below already exists, so you can
open each one as you read. On your own hub, the same steps produce the same shapes with your names in them.

```
   0 set up ─► 1 brief ─► 2 intake ─► 3 fan-out + cross-review ─► 4 rows ─► 5 triad ─► 6 build ─► 7 gate ─► 8 close
     10 min      15 min     2 min       10 min                      5 min      30 min     a session   a week    5 min
     hub         hub        hub         hub                         hub        code repo  per REQ     owner     hub
```

## 0. Set up (about ten minutes)

Open Claude Code in the hub folder and type:

```
/hub-setup
```

Claude asks about your product, you, this repo, each code repo (name, what it is, where it is cloned, a
short prefix for its ids) and anyone else who writes code. It shows the `hub.json` it will write, writes
it, renders the documents, deletes the example, and runs the checker. Then it fills the constitution with
you — what the product is, who it is for, what it never does. Then it offers to connect each code repo:

```
python tools/service_init.py API
```

which gives `garden-api` a `specs/` folder, a `CLAUDE.md` that points at the hub, a CI job, and the
`spec-*` skills. One commit, on your word. **Skip this step to follow the example as shipped.**

## 1. Write the brief (about fifteen minutes)

You: *"People add a plant and I have no idea whether they get a reminder."*

```
/hub-brief
```

Claude asks, two or three questions at a time: what happens today, to whom, how you know; what numbers show
it and where each would be read; the chain of events from the first thing a person does to the last thing
the product does, and which event says "it worked"; what is deliberately left out; how you would know it
worked — a measurement, a bar, a date.

What you get back is a draft at `.claude/briefs/_drafts/reminders-people-act-on.md` in the fixed shape:
**the problem · evidence** (a table of what, the query, the reading and its date) **· success metric**
(`plant_added → first_reminder_delivered`, with the last event named) **· non-goals · who is affected ·
verdict gates** (🚦-1, 🚦-2, 🚦-3, each with a bar and a date, each taken once).

> The brief names a **problem**. It does not say "add a reminders table" and it does not say which repo
> does the work. That comes next, and it comes from reading, not from guessing.

Open the filed version to see the shape: `.claude/briefs/x-1.md` on a fresh copy of the kit (setup deletes
the example; its template stays at `tools/templates/example/brief-x-1.md.tmpl`).

## 2. File it (two minutes)

```
/hub-intake
```

Claude reads the next free id — `python tools/next_id.py X --show` prints `X-1`, because the brief
touches more than one repo — and writes `.claude/briefs/x-1.md`: a **header block** above a `---` rule
(who wrote it, when, its status 🔲 `INTAKE`, what the text assumes that the hub does not do, what is the
owner's to decide) and **your text below the rule, verbatim**. It adds one line to the briefs index and one
row to the roadmap's NEXT table, runs the checker, commits, and stops. Nothing is built.

> Above the rule is the hub's; below the rule is yours. Intake never edits your words — a brief that is
> wrong is filed as it is and answered with a **return**.

## 3. Which repos? (about ten minutes)

```
/hub-fan-out X-1
```

Claude spawns **one agent per repo in `hub.json`**, all in the same turn, each reading only its own tree:
*which of REQ-X1.1 … X1.5 are mine?* Each returns a fixed block — repo, what it read, YES or NO, the REQs it
claims, the evidence as `file:line`, what other repos it names, and what it found in its own tree that the
brief did not say. Claude writes the three blocks, verbatim, into a note under X-1's row in the roadmap.

In the example, the web app said YES, the API said YES, and the worker said **NO**, with an empty evidence
line: *"the reminder is created by the API; the worker just runs a loop."*

```
/hub-cross-review X-1
```

Every NO is challenged with three written checks. **C1** — does any YES block name this repo? The API's
does: *"the worker must send what the row says."* **C2** — in whose process does the metric's **last event**
happen? `first_reminder_delivered` happens in the worker's send loop; the metric ends there. **C3** — read
the tree for every contract the brief names: nothing exists there *yet*, which is the point — the REQ
creates the dependency. Verdict: **NEEDS REVIEW**; a round two asks the worker again with REQ-X1.3 and
REQ-X1.4 in hand, and it answers YES.

Read both notes under X-1's row in [`roadmap.md`](../.claude/context/roadmap.md).

> A "no" is checked, never believed. One agent reading one repo cannot tell *true of a script* from *true of
> the item*. This is the step the whole hub exists for.

## 4. Rows and tags (five minutes)

Claude adds a half-row per repo under X-1 — **WEB-1**, **API-1**, **JOB-1** — and tags every requirement with
its owner on its own line in the hub's triad:

```
**REQ-X1.3 · JOB — The worker sends every due reminder within 15 minutes and records the send**
**REQ-X1.4 · API+JOB — The row is the contract**
```

`python tools/check.py` runs the checker's R13: a REQ with no tag fails; a tag whose repo has no row fails.
Each code repo's CI runs R13c: a REQ tagged to it that its `specs/` never mentions fails. The tags prove an
owner was *recorded*. The cross-review is what made it *right*.

## 5. The plan — the triad (about thirty minutes, in the code repo)

In `garden-api`:

```
/spec-phase 1
```

Claude reads the brief and the hub's requirements, explores the code, and writes
`specs/phase-1/requirements.md` (what must become true, and why — every `REQ-1.x` numbered),
`specs.md` (how: the schema, the endpoint, a file plan in dependency order) and `verification.md` (how we
will know: a check per REQ, and the brief's **verdict gates copied word for word**, with checks underneath
and empty boxes). No code is written.

The hub's own copy of the cross-repo plan is `.claude/context/phase-x1-reminders-delivered/` on a fresh
copy of the kit; open its `verification.md` to see what a gate looks like with its checks beneath it.

> Gates copy verbatim. Checks go underneath. The gate's text is the brief author's and is never edited; if
> it cannot be measured, that is a return, not a rewrite.

## 6. Build one requirement (one session per REQ)

```
/spec-next
```

Claude reads the three files, finds the first unchecked requirement, writes the code, runs **that
requirement's check**, ticks its box, commits, and **stops**. The next session starts clean. The
`phase-progress` pane shows the bar move: *3 of 14 boxes · 11 to go*. A contributor does the same on a
branch, by pull request; `hub-gate` refuses their write to any path that is not theirs.

While building, the API session finds that the worker reads a column the API is about to stop writing. It
does not touch the worker. It files a note under **JOB-1's** row — `▶ JOB-1 — inbox` — citing
`garden-worker/jobs/remind.py:41`, and carries on. The next worker session runs
`python tools/inbox.py JOB`, sees the note, acts in its own tree, and closes it with `✅ PICKED UP`.

> Read everywhere, write only your own. Note first, then ring. Never ring a session running a gate.

## 7. The gate, and the ruling (a week later)

🚦-1 says: *of the people who add their first plant in the week after release, ≥ 60 % receive a first
reminder within 24 hours.* On the date it names, the query is run **once**. The session writes a
`VERDICT-DRAFT.md` with the reading, the query and the date — and **no verdict**. You read it and rule:
pass, or fail. Either is recorded. A fail is a complete outcome; a fix is a new item with a new gate, not a
re-run.

> The session that did the work does not grade it. A tick means verified, not written.

## 8. Close (five minutes)

On your word, X-1's row moves to ✅ `Completed` or 🟢 `Live`; its notes move, byte for byte, to
`roadmap-archive.md`; its brief's header records the outcome; the briefs index does not change (it never
holds status). Your queue loses D-1's line in the same commit that records your ruling. The checker's R8
now guards the row: a done phase with an open box fails CI.

## What a week looks like, once it is running

| Day | You | Claude |
|---|---|---|
| Sat | pick the week's one outcome per repo; it enters 🔥 NOW | moves the rows, re-reads the queue |
| Sun–Wed | answer what lands in your queue | one REQ per session; notes between repos; returns when blocked |
| Thu | rule on the gates taken this week; read what moved | the week in review, if you want one |

Parked means parked: a row below NOW is not worked on, not reported on, not re-raised until the committed
outcome lands. Most of the discipline is in that one line.
