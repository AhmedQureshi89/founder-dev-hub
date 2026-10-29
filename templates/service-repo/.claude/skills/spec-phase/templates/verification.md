# Phase N Verification & Test Plan — <Phase Name>

> **Phase:** Phase N
> **Parent Requirements:** [requirements.md](requirements.md)
> **Parent Specification:** [specs.md](specs.md)

---

## Notation

| Marker | Meaning | On failure |
|---|---|---|
| `- [ ]` | ordinary check — tests *our code* | fix and retry freely |
| `- [ ] 🚦 **(VERDICT GATE — no retry)**` | measures *reality* | **halt.** Record the result. Never retry into green |

A verdict gate's failure is a finding, not a bug. `/spec-next` and `/spec-run` are
required to stop at one. If a check's kind is unclear, it is a verdict gate.

---

## 1. Gate 1 — <name> (blocks <what>)

<State the ordering rule: what must pass before what, and what happens mechanically
on failure — e.g. "a FAIL verdict stops the phase (exit code 1)".>

- [ ] **REQ-N.1 (<short name>):** <the observable condition, stated so that someone
  who did not write the code can check it. Include the tolerance or threshold.>
- [ ] **REQ-N.2 (No leakage):** <...>
- [ ] 🚦 **REQ-N.3 (<short name>) (VERDICT GATE — no retry):** <the pre-registered
  criterion with its exact numbers and CI rule.> **A FAIL here halts the phase.**

## 2. Gate 2 — <name> (only if Gate 1: <outcome>)

- [ ] **REQ-N.4 (<short name>):** <...>

## 3. Gate 3 — <name>

- [ ] **REQ-N.5 (<short name>):** <...>

---

## 4. Automated Commands

```bash
<the exact command per gate — what a runner executes, not a description of it>
```

## 5. Acceptance Criteria

<The phase is complete when: ... State it as a conjunction of the gates above, with
no criterion that appears here for the first time.>

## 6. What Would Make This Phase Untrustworthy

<The failure modes no checkbox catches. Be specific and unflattering: the silent
argument swap, the metric that improves for a mechanical reason, the baseline that
was too weak, the result that wouldn't regenerate from committed config. If this
section is short, the plan has not been examined hard enough.>

---

*Written: <date> — before implementation began.*
*This file is read-only during implementation. Only checkbox ticks and measured
values may be added; gates may not be changed except by a dated planning session.*
