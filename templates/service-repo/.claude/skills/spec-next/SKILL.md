---
name: spec-next
description: >
  Implement exactly one unchecked requirement from a spec-driven project's current
  phase — read specs/phase-N/{requirements,specs,verification}.md, write the code,
  run that requirement's gate, tick the box, commit, stop. This is the Execute +
  Verify half of the loop. Trigger on "/spec-next", "implement the next requirement",
  "continue the phase", or "work the next REQ".
---

# Spec Next Skill

One requirement. One session. One commit.

The discipline this enforces: the plan already exists on disk, so this session does
no planning and no exploring. It reads three small files, does one bounded thing,
proves it, and ends — leaving the next session to start clean rather than inheriting
a bloated context.

---

## Workflow

### Step 1: Locate the work

1. **Resolve the project's status vocabulary before reading the status column.**
   Take it from the legend comment in `roadmap.md` if there is one, otherwise from
   the distinct values the Status column already uses. Never match on a specific
   marker you expect — `🛠️ In Progress` is one project's convention, not a standard,
   and matching it literally is why sessions announce "no phase is in progress" in
   projects that say `📋 Specced`, `In Flight`, or `🟡 Active`.
2. Read `specs/roadmap.md` and find the phase that is **started but not finished**,
   in that vocabulary.
   - More than one → ask which.
   - None → don't just ask. A phase that is **not marked finished**, has a complete
     triad on disk, and has unchecked boxes *is* started, whatever the column says;
     the marking step was simply skipped. If exactly one phase fits that, take it,
     say plainly that you are doing so, and correct its status in this session's
     commit (Step 4). If several fit, ask. If none fits, ask.
3. **Check for a halt note.** If `specs/phase-N/RUN-HALTED.md` exists, read it first
   and reconcile it against reality:
   - **Still live** — its blocking condition is unresolved → **stop.** Report what it
     says the user has to decide. Never work around a halt; the decision it was
     waiting for has not been made.
   - **Overtaken by events** — the requirement it halted on is now done, or the phase
     has since completed → say so plainly, delete the note in this session's commit,
     and continue. A halt note that outlives its condition misreports the project's
     state to every session after it.
4. Read all three of `specs/phase-N/requirements.md`, `specs.md`, `verification.md`.
   All three. `verification.md` alone will tell you what to do but not why or how.
5. Find the **first unchecked box in gate order**. Gates are ordered for a reason —
   never skip ahead to an easier requirement in a later gate.
6. Check that every gate blocking this one has passed. If a blocking gate is
   unresolved, stop and say which.

If the user named a specific `REQ` id, do that one instead — but still honor the
halt-note and blocking-gate checks.

### Step 2: Implement

Write the code specified for that requirement in `specs.md`. Follow the project's
existing conventions — if source modules cite their requirement ids in a docstring,
yours does too.

**Scope is exactly one requirement.** Not the obvious adjacent fix, not the tidy-up
you noticed. If you find something out of scope and worth doing, note it for the user
at the end; don't do it.

### Step 3: Verify

Run that requirement's check from `verification.md` — the actual command, not an
inspection. Then:

**Ordinary check (plain `- [ ]`)** — it tests your code. Failure means you got it
wrong: fix and retry. Retry freely.

**Verdict gate (`🚦 VERDICT GATE — no retry`)** — it measures reality. Failure is a
*result*.

> Stop immediately. Do not adjust the threshold, the data, the metric, or the code to
> get a different number. Do not retry. Report the failure with its measured values
> and let the user decide. A well-executed negative is a valid outcome; a negative
> massaged into a positive is the one unrecoverable failure mode of this whole system.

If a check can't be run because the spec is ambiguous or incomplete — **stop**. Do not
improvise. An ambiguity here means `specs.md` is wrong, and fixing the spec is a
planning act (`/spec-phase`), not something to paper over mid-implementation.

### Step 4: Record

- Tick the box in `verification.md`. Write measured numbers into it where the check
  produced any — a ticked box with no number is weaker evidence than it looks.
- **If Step 1 found the phase unmarked or mismarked, correct its status column** in
  `roadmap.md`, in the same commit. Status is bookkeeping and it is yours; a verdict
  is not (hard rule 3).
- **If Step 1 found a stale halt note, delete it** in the same commit, and say in the
  commit body why it no longer applies.
- Commit. The message states the **outcome**, not the activity:
  `REQ-2.1: binned baseline recovers per-bin rates (max err 0.004)` — not
  `add baselines.py`.

### Step 5: Stop

Report: which `REQ` was done, what the check measured, what the next unchecked
requirement is, and anything you deliberately left out of scope.

Then end the session. Do not continue to the next requirement — that is `/spec-run`'s
job, and it will start it with fresh context, which is the whole advantage.

---

## Hard rules

1. **Never edit `verification.md` except to tick a box and write in a measured value.**
   A session that can rewrite the test it is judged by is not being tested.
2. **Never edit `requirements.md` or `specs.md`.** If they're wrong, stop and report.
   Amending the plan is a planning session.
3. **Never write a phase _verdict_ into `roadmap.md`.** Ending a phase is a decision
   the user makes on the evidence, not a step in a checklist. The status *column* is
   different, and the line between them is exact: you may mark a phase **started**;
   you may never mark it finished, passed, failed, or blocked. Marking a phase
   started is recording what is already true. Marking it finished is a judgment.
4. **Never explore beyond the spec.** If implementing requires spelunking the codebase,
   `specs.md` is incomplete — that is a finding to report, not an obstacle to route around.
5. **Never retry a verdict gate.**
6. **One requirement per session.**

## Error handling

| Situation | Action |
|---|---|
| No unchecked boxes remain | Report: phase complete, awaiting the user's exit verdict. Do not write it |
| The requirement is already implemented but unticked | Verify it, tick it with measured values, commit the tick alone |
| A blocking gate hasn't passed | Stop; name the gate |
| `specs.md` doesn't cover this requirement | Stop; report the gap. Do not design it yourself |
| Tests fail for an unrelated reason | Report it; do not fix out-of-scope breakage silently |
| A permanently-unticked box (struck through, or marked as a consequence of a prior failure) | Leave it. It is a record, not a task |
| `RUN-HALTED.md` present, its condition still unresolved | Stop; report the decision it is waiting on. Never step over a live halt |
| `RUN-HALTED.md` present but overtaken by events | Say so, delete it in this session's commit, continue |
| No phase marked started, and several have triads with unchecked boxes | Ask which. Do not guess between them |
| Roadmap has no status legend and no Status column | Use the column-free default, and say which marker you used |
