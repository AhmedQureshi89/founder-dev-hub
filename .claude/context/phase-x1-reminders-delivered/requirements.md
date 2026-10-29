# X-1 — Reminders people act on — Requirements

> **Written from** brief [`x-1.md`](../../briefs/x-1.md) (Sam, 2026-10-01) on 2026-10-02, after the fan-out and
> cross-review recorded in the roadmap under X-1's row. Every REQ carries its owning repo on its own line;
> `tools/specs_check.py` R13 checks that each owner has a roadmap row (WEB-1, API-1, JOB-1), and each repo's
> CI checks (R13c) that its `specs/` names the REQs tagged to it.
>
> **Status:** 📋 `Pre-specced`. The JOB half waits on **D-1** (which channel sends first).

## 1. Established facts — re-read 2026-10-02

| Fact | Where it was read |
|---|---|
| A reminder leaves no row: the worker reads `plants.next_water_at` every 10 minutes and sends an email with its own text | `garden-worker/jobs/remind.py:41–58` |
| `plants` has `next_water_at` with no time zone | `garden-api/src/db/schema.ts:70–74` (**KI-1**) |
| The add-plant form already asks a watering interval and discards it | `garden-web/src/pages/AddPlant.tsx:60` |
| `plant_added` fires; no `reminder_acted` event exists | `garden-web/src/lib/events.ts:14` |
| 418 plants added in 30 days; 131 of 212 people have logged no watering in 14 days | brief §Evidence, re-run 2026-10-02: 421 and 129 |

## 2. Requirements

**REQ-X1.1 · WEB — Adding a plant asks how often it drinks, and when**
The add-plant form keeps its interval question (today's `AddPlant.tsx:60`) and adds a time of day,
default 09:00 in the browser's time zone. Both are sent on `POST /plants`. The constitution's §6 wording
*How often does it drink?* is the label. *Why:* the question is already asked and thrown away; the fix is
to stop throwing it away.

**REQ-X1.2 · API — A plant carries its schedule, and its first reminder exists as a row**
`plants` gains `remind_every_days`, `remind_at_local` and `timezone` (closing **KI-1**). A new table
`reminders(id, plant_id, due_at, channel, body, sent_at, acted_at)`. `POST /plants` writes the plant and
its first `reminders` row with `due_at` within 24 hours and `sent_at null`. Deleting a plant deletes its
unsent reminders (constitution §4.3). *Why:* a reminder is a row before it is a message (§4.1); without
the row, 🚦-1 cannot be measured.

**REQ-X1.3 · JOB — The worker sends every due reminder within 15 minutes and records the send**
The send loop reads `reminders where sent_at is null and due_at <= now()`, sends the row's `body` over the
row's `channel`, and writes `sent_at`. It no longer reads `plants.next_water_at`. *Why:* delivery is the
last event of the success metric; it must be recorded where the metric is measured.

**REQ-X1.4 · API+JOB — The row is the contract**
The API writes `channel` and `body`; the worker sends exactly those and computes nothing of its own. The
`channel` value the API writes first is **D-1**. *Why:* two repos agreeing on a row is checkable; two repos
agreeing on prose is not.

**REQ-X1.5 · WEB — The reminder links back, and the press is recorded**
Every reminder body carries a link to the plant; opening it records `reminder_acted` with the reminder's id
(`PATCH /reminders/:id/acted`, written by API under REQ-X1.2's table). *Why:* 🚦-2 measures acted-on
reminders; without the event there is nothing to count.

## 3. Explicit non-goals

- Browser push (D-1 decides the first channel; push is its own brief).
- Snoozing, bulk watering, more than one plant per reminder.
- Changing the default schedule or the interval question's wording.

## 4. Open questions for the owner

- **D-1** — which `channel` the API writes first. Blocks REQ-X1.3's build; does not block REQ-X1.1,
  REQ-X1.2 or REQ-X1.5.
