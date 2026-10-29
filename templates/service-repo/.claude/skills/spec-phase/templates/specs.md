# Phase N Technical Specification — <Phase Name>

> **Phase:** Phase N
> **Parent Requirements:** [requirements.md](requirements.md)
> **Duration:** <N days>

---

## 1. Architecture Overview

<How this phase's pieces fit together. Dependency order is part of the design — say
what must exist before what, and why. This ordering is what makes an autonomous run
possible: a runner walks it top to bottom.>

```
  DAY 1 ─ <theme> (<STOP-on-FAIL, if applicable>)
  ┌────────────────────────────────────────────────────────────┐
  │ path/to/module.py [NEW]                                    │
  │   function_name()        ── <one-line role>                │
  └────────────────────────────────────────────────────────────┘
                              │
                              ▼
  DAY 2 ─ <theme>
  ...
```

---

## 2. Component Specifications

### 2.1 `path/to/module.py` [NEW]

**Implements:** REQ-N.1, REQ-N.2

<Signatures, inputs, outputs, invariants. Enough that an implementer never has to
explore the codebase to proceed — if they would have to, this section is incomplete.>

<Call out anything with a silent failure mode: argument orders that are type-compatible
and swappable, units, timestamp conventions, anything that has bitten this project before.>

### 2.2 `path/to/other.py` [MODIFIED]

**Implements:** REQ-N.3

<What changes and what must not.>

---

## 3. File Plan

| File | Status | Implements |
|---|---|---|
| `path/to/module.py` | NEW | REQ-N.1, REQ-N.2 |
| `path/to/other.py` | MODIFIED | REQ-N.3 |
| `tests/test_module.py` | NEW | verification §1 |
| `path/to/untouched.py` | UNTOUCHED — <why it might look like it should change> | — |

---

## 4. Known Risks in This Phase

<Where this design could be wrong, what would reveal it, and what the fallback is.
Risks named here should have a corresponding line in verification.md §6.>

---

*Last updated: <date>*
