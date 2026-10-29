---
name: spec-status
description: >
  Read-only drift report for a spec-driven project — per phase: verification boxes
  ticked vs outstanding, roadmap status, stale halt notes, verdict gates still open,
  and which outstanding boxes already have evidence on disk. Writes nothing, ticks
  nothing, runs nothing, commits nothing. Trigger on "/spec-status", "where is this
  project", "what's actually left", "is the roadmap accurate", or before a run.
---

# Spec Status Skill

A mirror, not a fixer.

A spec-driven project records "done" in four places — `verification.md` checkboxes,
`roadmap.md` checkboxes and its status column, dated files in `reports/`, and the git
history. `/spec-next` reads the first. You read the second. The evidence lives in the
third. Nothing keeps them in agreement, so they drift, and the drift stays invisible
until a session opens by telling you its plan disagrees with your repo.

This makes it visible in one cheap read-only pass, before you spend a session on it.

**It writes nothing.** No ticks, no status edits, no deleted halt notes, no commits,
no test runs. If it finds drift it reports it; fixing is `/spec-next`'s job — that
skill owns the status column and stale halt notes — or a reconciliation session you
ask for deliberately.

---

## Workflow

### Step 1: Resolve the status vocabulary

Projects do not share status markers. Read the project's own before interpreting
anything:

1. A legend comment in `roadmap.md` — e.g.
   `<!-- Status: 🔲 Not Started · 🛠️ In Progress · ✅ Completed · ⛔ Blocked -->`.
   Authoritative when present.
2. Otherwise, the distinct values already in the Status column.
3. If there is neither, say so — "no status vocabulary defined" is itself a finding,
   and the reason sessions in that project can never find a started phase.

Never match on a marker you expect to see.

### Step 2: Inventory every phase

For each `specs/phase-*/`:

- **triad completeness** — which of `requirements.md`, `specs.md`, `verification.md` exist
- **boxes** — ticked / outstanding / permanently-unticked (Step 3)
- **verdict gates** (🚦) — how many, and which are still open
- **roadmap status** for that phase
- **`RUN-HALTED.md`** present or not

Phases named in `roadmap.md` with **no** `specs/phase-N/` directory belong in the
inventory too. A phase the roadmap calls complete with nothing on disk is one of the
loudest signals this report can produce.

### Step 3: Separate outstanding from permanently-unticked

Not every unchecked box is work. A box that is struck through, or annotated as the
pre-declared consequence of a prior failure, is a **record that a rule was obeyed** —
ticking it would mean the rule was broken. Count these separately and never list them
as outstanding.

A status report that cries wolf over deliberate records is one nobody reads twice.

### Step 4: Cheap evidence check — hints only

For each genuinely outstanding box, look for signs the work already happened:

- the test file, module, or command the box names exists in the repo
- a dated report in `reports/` covers that phase or requirement
- `git log --grep=REQ-N.x` returns a commit

**These are hints, not verdicts.** Report them as "evidence on disk", never as "ready
to tick". Only re-running the check justifies a tick, and this skill does not run
checks: it does not execute test suites, does not touch data, and never goes near a
verdict gate. Running one here would turn a 30-second read into a session, and would
put a measurement outside the loop that is supposed to record it.

### Step 5: Name the drift

| Drift | What it looks like | Why it bites |
|---|---|---|
| **Boxes behind reality** | phase marked finished, boxes outstanding, evidence on disk | every `/spec-next` opens by reporting the mismatch |
| **Status behind reality** | triad exists and boxes are ticked, phase still "not started" | `/spec-next` stops at Step 1 and asks you which phase |
| **Triad missing** | roadmap says complete, no `specs/phase-N/` on disk | nothing for a session to read; the plan was never written down |
| **Stale halt note** | `RUN-HALTED.md` on a phase whose requirement is now done | misreports the project to every session after it |
| **Open verdict gate in a finished phase** | 🚦 unticked, phase marked complete | see below |
| **Vocabulary mismatch** | status values match no legend | sessions match literally and find nothing |

The fifth needs care. An open 🚦 in a completed phase is either the most serious
finding in the report — a phase closed without its verdict — or not a finding at all,
because it is a deliberate record from Step 3. Say which. Never leave it ambiguous.

### Step 6: Report, recommend one action, stop

```markdown
## <project> — spec status, <date>

| Phase | Status | Triad | Ticked | Outstanding | 🚦 open | Notes |
|---|---|---|---|---|---|---|
| 1 | ✅ Completed | full | 0 | 26 | 1 | evidence on disk for 24 |
| 5 | 🔲 Not Started | none | — | — | — | roadmap bullets only |

**Drift found**
- <one line each, most consequential first>

**Not drift** — deliberate records
- <the permanently-unticked boxes, and what each one records>

**Recommended next action:** <exactly one>
```

One recommendation, not a menu. Then stop.

---

## Hard rules

1. **Write nothing.** Not a tick, not a status, not a deleted note, not a commit.
   The moment this skill edits a file it stops being safe to run casually, which is
   its entire value.
2. **Run no checks.** Not even the cheap ones, not "just to confirm". Executing a
   check is `/spec-next`'s job; executing a verdict gate is nobody's.
3. **Never call a box tickable.** Evidence on disk is a hint about where to look.
4. **Never write or imply a phase verdict**, and never suggest one is obvious.
5. **Never guess the vocabulary.** "No status vocabulary defined" is a finding, not a
   gap to fill in.

## Error handling

| Situation | Action |
|---|---|
| No `specs/` directory | Say the project isn't spec-driven; suggest `/project-constitution`. Report nothing else |
| `roadmap.md` exists, no triads at all | Report it as roadmapped-but-unplanned; `/spec-phase` is the next act |
| Many phases | Summarize per phase. Never dump every checkbox |
| A phase's `verification.md` is missing but the others exist | Flag it loudly: the phase has no bar, so nothing can legitimately close it |
| User asks you to fix what you found | Name the right tool — `/spec-next` for status, ticks and stale notes; `/spec-phase` for a missing triad. Do not fix it here |

## Common mistakes

1. **Listing deliberate permanently-unticked boxes as outstanding work.** They are the
   record that a rule was obeyed. Misreporting them teaches the user to ignore the report.
2. **Running the test suite "to see what passes".** That converts a read-only glance
   into a session, and measures outside the loop meant to record it.
3. **Presenting "evidence on disk" as proof the box can be ticked.** It is a hint.
4. **Fixing what you found.** The report's credibility comes from its having no stake
   in the answer.
5. **Ending with a menu of five options.** One recommendation. The user asked where
   they are, not what they could theoretically do.
