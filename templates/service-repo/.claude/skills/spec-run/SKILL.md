---
name: spec-run
description: >
  Run a spec-driven phase autonomously — repeatedly implement and verify unchecked
  requirements, one subagent per requirement, halting at every point that requires
  human judgment. Can span several phases if their triads were written in advance.
  Trigger only on explicit request: "/spec-run", "run the phase autonomously",
  "work through the remaining requirements", "run phases 5 and 6 overnight".
---

# Spec Run Skill

Autonomous execution of an already-written plan.

**The governing rule: this runs up to the next decision, never through one.**

Everything mechanical — implement, test, tick, commit — repeats freely. Everything
that is a judgment — a phase verdict, interpreting a failed gate, re-scoping, an
amendment — halts the run and waits for the user.

## What autonomy is bounded by

You can autonomously **execute** phases. You cannot autonomously **plan** them —
authoring a triad is a judgment act (`/spec-phase`).

So the run's reach is exactly how far ahead the user has specced. If phase N+1 has
no `specs/phase-(N+1)/` triad, the run stops at the end of phase N. That is the leash,
and it is the correct one: the runner can only go as far as the user's judgment
already reached.

---

## Workflow

### Step 1: Establish the run's scope and announce it

1. Identify the phase(s) in play, reading the status column in **the project's own
   status vocabulary** — from `roadmap.md`'s legend if it has one, otherwise from the
   values the column already uses. Do not match on a marker you expect to find.
   Confirm each phase has a complete triad (`requirements.md`, `specs.md`,
   `verification.md`). List phases with no triad — those bound the run.
2. **Clear or honour any halt note.** For every phase in scope, check for
   `specs/phase-N/RUN-HALTED.md`:
   - Its blocking condition is still unresolved → **the run does not start.** Report
     the outstanding decision and stop. A run that steps over a live halt is a run
     that decided something the user was asked to decide.
   - It has been overtaken by events → delete it in the run's first commit and report
     it as cleared. Never leave a note whose condition is gone; every later session
     reads it as current.
3. Count the unchecked requirements and identify every 🚦 verdict gate in the path.
4. Confirm the working tree is clean. A dirty tree makes the run's commits unreadable
   as an audit trail.
5. **Tell the user before starting:** the phases in scope, the requirement count, where
   the verdict gates sit, any halt note cleared, and the halt conditions. Then begin.

### Step 2: The loop

For each unchecked requirement, in gate order:

1. **Spawn a subagent** to do that one requirement, following `/spec-next`'s rules
   exactly: read the triad, implement, run the check, tick with measured values, commit.
2. Wait for it. Read its report.
3. Evaluate against the halt conditions below.
4. If clear, proceed to the next requirement.

**One subagent per requirement — never do them inline.** A single session grinding
through twelve requirements accumulates context until quality decays, which is the
exact failure the spec design exists to prevent. Each subagent recovers full state
from three small files. That is the property that makes autonomy safe here.

**Commit after every requirement.** A run that dies at 3am must leave a git history
readable at 8am.

### Step 3: Halt conditions

Halt immediately, without exception, on any of these:

| Condition | Why it's a decision, not a step |
|---|---|
| 🚦 **A verdict gate fails** | It's a finding. The user decides what it means |
| **A phase's boxes are all ticked** | The exit verdict is the user's to write |
| **The next phase has no triad** | Planning is a judgment act |
| **A requirement needs exploration the spec doesn't cover** | `specs.md` is incomplete — a finding |
| **Two consecutive requirements make no progress** | Something is wrong that retrying won't fix |
| **A subagent reports it wants to edit `requirements.md`, `specs.md`, or a gate** | The plan is being questioned. That's the user's call |
| **Budget or time limit reached** | — |

### Step 4: On halt, write the note and stop

Write `specs/phase-N/RUN-HALTED.md`:

```markdown
# Run halted — <date>

**Reason:** <halt condition>
**At:** REQ-N.x — <title>
**Measured:** <the actual values, if a gate produced any>

## Completed this run
- REQ-N.a — <outcome> (commit <sha>)
- REQ-N.b — <outcome> (commit <sha>)

## Still unchecked
- REQ-N.y, REQ-N.z

## What the user needs to decide
<one paragraph, no recommendation dressed as a conclusion>
```

Then report the same summary in chat and stop.

**The note is deleted when its condition is resolved** — by this skill on the next
run, by `/spec-next`, or by hand. It is not the run's private bookkeeping: while it
sits there it is the project's stated reason for stopping, and a note that outlives
its condition misreports the state to every session that follows.

---

## Hard rules

1. **Never write a phase _verdict_ into `roadmap.md`.** Not MET, not FAILED. Halt and
   let the user write it. This is the most important rule in the skill — it is what
   keeps an autonomous run from concluding things about reality on its own. A
   subagent correcting a phase's status column to **started** is not a verdict and is
   allowed (`/spec-next` hard rule 3); marking one finished, passed, failed or
   blocked is, and is not.
2. **Never retry a verdict gate.** Not with different parameters, not with more data,
   not "to confirm". One run, one result.
3. **Never edit `verification.md`** except through a subagent ticking a box.
4. **Never author a triad** to keep the run going.
5. **Never amend the constitution**, and never proceed on a proposal that isn't in force.
6. **Never widen scope** past a phase's Explicit Non-Goals.

## Pacing variants

- Paced: `/loop /spec-next` — one requirement per interval, user-visible between each.
- Overnight: schedule `/spec-run` as a scheduled task. Same halt rules; the halt note
  is what the user reads in the morning.

## Error handling

| Situation | Action |
|---|---|
| Working tree dirty at start | Stop; ask the user to commit or stash first |
| A subagent returns null / dies | Retry that requirement once, then halt |
| A commit fails (hooks, CI) | Halt — do not bypass hooks to keep the run moving |
| Phase in progress but no unchecked boxes | Halt; the phase is awaiting its verdict |
| User asks to "just run everything" | Run to the halt conditions anyway. They are not negotiable by request — explain why and run what's legitimately runnable |
| A phase in scope carries a live `RUN-HALTED.md` | Do not start. The prior halt's decision is still outstanding |
| A `RUN-HALTED.md` is stale (its requirement is now done) | Delete it in the first commit; report it as cleared |
| No phase is marked started, but a triad has unchecked boxes | Treat it as started and correct the column; say so in the announcement |

## Common mistakes

1. **Treating a verdict-gate FAIL as a bug to fix.** It is the most valuable output the
   system produces. Halting on it correctly is the reason this skill can be trusted.
2. **Running inline to save subagent overhead.** The overhead is the feature.
3. **Writing the phase verdict because it "obviously" passed.** Obvious verdicts are
   still verdicts.
4. **Starting a run on phases that were specced in one optimistic sitting.** Pre-speccing
   several phases is legitimate, but the further ahead a triad was written, the more
   likely the run halts on a spec gap. That's the system working — not a reason to
   let the runner patch the spec.
