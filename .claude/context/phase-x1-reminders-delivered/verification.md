# X-1 — Reminders people act on — Verification

> **The verdict gates are copied verbatim from the brief.** Checks are written underneath a gate; the gate's
> text is never edited. A box is ticked when its check was **run and recorded**, never when the code was
> written. A gate is taken once, on the date it names, and never retried for a better number — a recorded
> FAIL is a complete outcome. The session that did the work does not grade it: it assembles the evidence
> in a `VERDICT-DRAFT.md`, and the owner rules.

## ▶ Where X-1 is

| Half | Repo | State |
|---|---|---|
| API-1 | `garden-api` | 🔲 Not started |
| WEB-1 | `garden-web` | 🔲 Not started |
| JOB-1 | `garden-worker` | 🔲 Not started — waits on D-1 |

## 1. Per-requirement checks

### REQ-X1.1 · WEB

- [ ] The add-plant form shows the interval and a time, default 09:00, labelled *How often does it drink?* (a rendering test asserts the string)
- [ ] `POST /plants` is sent with `remind_every_days`, `remind_at_local`, `timezone` — read in the network panel

### REQ-X1.2 · API

- [ ] Migration `0007_reminders.sql` applied; `\d reminders` shows the seven columns of specs §2.1
- [ ] `POST /plants` with a schedule writes one `reminders` row with `due_at` ≤ 24 h out and `sent_at null`
- [ ] Deleting the plant deletes its unsent reminder (`select count(*) from reminders where plant_id = …` → 0)
- [ ] **KI-1** closed: `plants.timezone` exists and is written

### REQ-X1.3 · JOB

- [ ] The loop reads `reminders`, not `plants.next_water_at` (`grep next_water_at jobs/` → nothing)
- [ ] A row due now is sent within 15 minutes and `sent_at` is written — timed on a test row
- [ ] A failing send leaves `sent_at null` and retries; after 3 failures `channel = 'failed'`

### REQ-X1.4 · API+JOB

- [ ] The sent message's text equals the row's `body` byte for byte (a test row with a marker string)
- [ ] The worker contains no message template (`grep -i "time to water" jobs/` → nothing)

### REQ-X1.5 · WEB

- [ ] The reminder body's link opens the plant with `?reminder=<id>`
- [ ] Opening it calls `PATCH /reminders/<id>/acted` once; `acted_at` is written

## 2. Verdict gates — verbatim from the brief

- [ ] **🚦-1** — Of the people who add their **first** plant in the week after release, **≥ 60 %** receive a
  first reminder within 24 hours. Measured from the `reminders` table: rows with `sent_at` not null and
  `sent_at - plant.created_at ≤ 24 h`, over first plants created in that week.
  - *Check:* the query, written down before release, run once at the end of the week by the owner; the
    reading and the date recorded here.
- [ ] **🚦-2** — Of first reminders delivered in that week, **≥ 30 %** are acted on within 48 hours
  (`reminder_acted` recorded with the reminder's id).
  - *Check:* `select count(*) filter (where acted_at - sent_at <= interval '48 hours') * 100.0 / count(*) from reminders where sent_at is not null and …` over the same week.
- [ ] **🚦-3** — **Zero** reminders sent for a plant deleted before the reminder's due time, over the same
  week: `select count(*) from reminders r join plants p on p.id = r.plant_id where p.deleted_at < r.due_at and r.sent_at is not null`.
  - *Check:* the query as written; the result must be 0.

## 3. What would make this phase untrustworthy

- A box ticked on "the code is written" rather than "the check was run".
- 🚦-1 re-run after a fix to get a better number — the first reading stands; a fix is a new item.
- The worker computing its own message text again, however small — REQ-X1.4 is the whole point.
