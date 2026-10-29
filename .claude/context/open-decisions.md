# Pocket Garden — Open decisions

> The decisions only the owner can make, each with what waits on it and the options as a session sees
> them. A session **prepares** a decision — the evidence, the options, their costs, a recommendation — and
> **never takes it**. When the owner rules, the ruling is recorded here in place, the item's row moves, and
> the line leaves the owner's queue in [`roadmap.md`](roadmap.md) in the same commit.
>
> Ids are `D-n`, issued by `python tools/next_id.py D`.

---

## Open

### D-1 — Which reminder channel ships first?

**Raised** 2026-10-02 by the API session writing its half of X-1. **Blocks** JOB-1 (REQ-X1.3): the
`reminders.channel` column exists; the worker needs to know which value to send over.

| Option | What it takes | What it costs | Evidence |
|---|---|---|---|
| **A. Email first** | one sender, already in §8's processor table | people who do not open email miss the reminder | 212 registered people, all with a verified email (constitution §7, 2026-10-01) |
| **B. Browser push first** | a service worker in `garden-web`, a push subscription row, a new processor in §8 | a second repo (WEB) on JOB-1's critical path; a §8 amendment before any code | no push subscriptions exist today — 0 of 212 |
| **C. Both** | A and B | two channels to keep consistent; the brief's gate 🚦-2 measures one | — |

**Recommendation:** A. It is measurable with what exists, and 🚦-1 can be taken within the week. B is a
brief of its own once X-1 has a number.

**Ruling:** *(open)*

## Ruled

*A ruled decision stays here with its ruling and date; it does not move to history until the item it
blocked is closed.*

| ID | Question | Ruling | Date |
|---|---|---|---|
| | *(none yet)* | | |

## Resolved contradictions

*Where two documents, or a document and the code, disagreed — and which answer won. Keeping the list
is what stops the same argument being had twice.*

| # | Where | The disagreement | Which won, and why |
|---|---|---|---|
| 1 | constitution §4.4 vs `garden-api/src/db/schema.ts:74` | times are "the user's" vs. stored without a time zone | the constitution; the schema is **KI-1**, fixed by REQ-X1.2 |
