---
name: spec-phase
description: >
  Author the three-document triad for one phase of a spec-driven project —
  specs/phase-N/{requirements,specs,verification}.md — from that phase's entry in
  specs/roadmap.md. This is the Explore + Plan half of the loop and writes no code.
  Trigger when the user says "plan phase N", "spec out phase N", "/spec-phase 5",
  "write the phase triad", or asks to prepare a phase for implementation.
---

# Spec Phase Skill

Authors the plan for one phase and puts it on disk, where it survives compaction,
`/clear`, and tomorrow. Implementation happens later, in separate sessions, via
`/spec-next`.

**This skill writes no source code.** If you find yourself editing a file outside
`specs/`, you have left the skill.

## Prerequisites

The project must already have a constitution (`specs/mission.md`, `tech-specs.md`,
`roadmap.md`). If it doesn't, stop and run `/project-constitution` first — a phase
plan with no mission to answer to is just a to-do list.

---

## Workflow

### Step 1: Read the binding documents

In this order, and all of them:

1. `specs/roadmap.md` — the target phase's entry, its stated duration, its exit
   criteria, and **the status column**. If the phase is gated on a prior phase that
   has not returned a verdict, stop and say so.
2. `specs/mission.md` — the principles and any numbered bar or gate the phase must
   satisfy, plus the amendment log.
3. `specs/proposals/` — if the phase implements a proposal, read it and check whether
   it is **in force**. A proposal that has not been adopted by a dated amendment is
   not a mandate. See "Amendment discipline" below.
4. Prior phases' `verification.md` and their roadmap verdicts — especially any FAIL.
   A failed gate constrains what this phase is allowed to assume.

### Step 2: Explore the codebase

This is the one stage of the whole loop where open-ended searching is correct. Find
the modules the phase will touch, the existing test conventions, the naming patterns,
and anything already half-built.

**The output of exploration is `requirements.md`, not context.** Anything discovered
here that the implementer will need must end up written in a file. Nothing survives
in the session.

### Step 3: Write `requirements.md` — WHAT and WHY

Use `templates/requirements.md` as the structural guide.

- Every requirement gets an id: `REQ-N.x`, numbered within the phase.
- State the *why* for each. An implementer who doesn't know why a requirement exists
  will satisfy its letter.
- Include **Explicit Non-Goals**. Scope creep in an autonomous run is bounded by
  what this section forbids.
- If the phase's premise depends on a prior result, restate that result with its
  numbers. Don't make the reader go find it.

### Step 4: Write `specs.md` — HOW

Use `templates/specs.md`.

- Component-by-component, keyed to real file paths.
- **Dependency order is part of the design.** Say what must exist before what, and
  why. This ordering is what makes an autonomous run possible.
- A File Plan table (new / modified / untouched) so the implementer knows the
  blast radius without guessing.

### Step 5: Write `verification.md` — HOW WE'LL KNOW

Use `templates/verification.md`. **This is the load-bearing document.**

It is written *now*, before any code exists, and that is the entire point: the bar
is set while you are still ignorant of the outcome. Once implementation starts it
becomes read-only (`/spec-next` may only tick boxes).

Rules:

- Every `REQ-N.x` in `requirements.md` has at least one checkbox here. A requirement
  with no verification line is a wish — either give it one or delete it.
- Gates are **ordered**, and the ordering is stated: which gate blocks which days.
- **Mark verdict gates.** See the next section — this is not optional.
- End with "What Would Make This Phase Untrustworthy": the failure modes that no
  checkbox would catch. This section is where honest specs differ from optimistic ones.

### Step 6: Verdict-gate notation (required)

Two kinds of check live in this file and they must be visually distinguishable,
because `/spec-next` and `/spec-run` treat them differently:

```markdown
- [ ] **REQ-2.1 (Binned baseline):** on synthetic data with a known U-shaped label
  rate, the binned baseline recovers per-bin rates within tolerance.

- [ ] 🚦 **REQ-2.3 (VERDICT GATE — no retry):** model margin over the binned baseline
  on seasonality-only labels shows no evidence of being positive — margin < +0.01,
  CI lower bound ≤ 0. **A FAIL here is a finding, not a bug. The phase halts.**
```

| Marker | Meaning | On failure |
|---|---|---|
| plain `- [ ]` | ordinary check — a test of *your code* | fix the code and retry |
| `🚦 (VERDICT GATE — no retry)` | a measurement of *reality* | **halt.** Record it. Never retry into green |

If you cannot tell which kind a check is, it is a verdict gate. The cost of wrongly
halting is an interrupted evening; the cost of wrongly retrying is a fabricated result.

### Step 6.5: Resolve the project's status vocabulary

Projects do not share one set of status markers, so **read the project's before
writing one**. `🛠️ In Progress` is one project's convention, not a standard.

1. A legend comment in `roadmap.md` — e.g.
   `<!-- Status: 🔲 Not Started · 🛠️ In Progress · ✅ Completed · ⛔ Blocked -->`.
   Authoritative when present.
2. Otherwise, the distinct values already in use in the roadmap's Status column.
3. Only if neither exists: use `🔲 Not Started · 🛠️ In Progress · ✅ Completed`, and add
   the legend comment so every later session inherits it instead of guessing again.

Pick the marker meaning *specced and being worked*. If the project distinguishes
"specced" from "in progress" (some use `📋 Specced`), take the specced one — this
skill wrote a plan, not code.

### Step 7: Confirm, mark the phase started, then stop

Show the user the three files' section outlines and the full list of `REQ` ids with
their gate assignment. Ask for approval of the **verification gates specifically** —
that is the part they can't easily revise later.

**Once approved, advance that phase's status in `specs/roadmap.md`**, in the
vocabulary resolved above. This skill owns that transition, and it is the only
roadmap edit it may make — a status, never a verdict.

This is not bookkeeping for its own sake. A finished triad sitting on disk while the
roadmap still reads "Not Started" is precisely what makes every later `/spec-next`
open by asking which phase to work, and what makes `/spec-run` decline to start.

Then stop. Do not begin implementing. Say: "Phase N is specced and marked <status>.
Run `/spec-next` to implement one requirement, or `/spec-run` to run the phase
autonomously."

---

## Amendment discipline

If the phase requires something the constitution doesn't currently permit — a new
formulation, a widened threshold, a relaxed bound — **you may not write it into the
requirements**. Stop and tell the user: this needs a dated amendment in
`mission.md` §10 (or that project's equivalent), made *before* the run it governs.

Writing a requirement that quietly presumes an unmade amendment is the single most
damaging thing this skill can do. The whole system exists to prevent deciding what
counts as success after seeing the result.

---

## Error handling

| Situation | Action |
|---|---|
| No `specs/` directory | Stop; run `/project-constitution` first |
| Phase N already has a triad | Ask: revise, or is this a re-scope? Never silently overwrite |
| Phase gated on an unfinished prior phase | Stop; report which gate is outstanding |
| Roadmap entry is one line with no detail | Interview the user for the phase's objectives before writing |
| The phase needs an unadopted proposal | Stop; require the §10 amendment first |
| Roadmap has no status legend | Read the vocabulary off the Status column's existing values; don't impose one |
| Roadmap has no Status column at all | Use the default vocabulary, add the legend comment, and say you did |
| The phase's status is already something other than "not started" | Leave it. Report what it says; don't overwrite a status you didn't set |

## Common mistakes

1. **Writing `verification.md` last and loosely.** It is the only document that
   constrains the future. Write it as if someone else will hold you to it.
2. **Requirements that restate the specs.** `requirements.md` says what must be true;
   `specs.md` says how. If a requirement names a function signature, it belongs in specs.
3. **Leaving verdict gates unmarked.** An autonomous runner will retry them until they
   pass, which manufactures exactly the result you were trying to test for.
4. **Planning more than one phase per session.** Phase N+1's plan should be written
   after Phase N's verdict, unless you are deliberately pre-speccing for an autonomous
   run — in which case say so explicitly and accept that later phases may need revision.
