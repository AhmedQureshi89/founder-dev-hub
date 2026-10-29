# X-1 — Reminders people act on — Specs

> How X-1 is built, repo by repo, in dependency order. Each repo's half has its own triad in that repo's
> `specs/phase-1/`; this file is the cross-repo plan they are written from.

## 1. Order of work

```
   API-1  REQ-X1.2  the columns, the reminders table, the first row on POST /plants
     │
     ├──► WEB-1  REQ-X1.1  the form sends the schedule        (needs the API to accept it)
     │    WEB-1  REQ-X1.5  the link back, PATCH …/acted       (needs the table)
     │
     └──► JOB-1  REQ-X1.3  the send loop reads reminders       (needs the table; waits on D-1 for channel)
              REQ-X1.4  API+JOB — the row is the contract: API writes channel+body, JOB sends exactly that
```

The API half lands first and alone; it changes nothing a user sees. The web and worker halves can then
land in either order.

## 2. Contracts

### 2.1 `reminders` (API owns the writes, JOB owns `sent_at`)

| Column | Type | Written by |
|---|---|---|
| `id` | uuid | API |
| `plant_id` | uuid, references `plants.id`, on delete cascade | API |
| `due_at` | timestamptz | API |
| `channel` | text, one of the values D-1 allows | API |
| `body` | text, rendered from constitution §6 *Time to water {plant}* | API |
| `sent_at` | timestamptz, null until sent | JOB |
| `acted_at` | timestamptz, null until the link is opened | API (`PATCH /reminders/:id/acted`) |

### 2.2 `POST /plants` (API)

Accepts `remind_every_days` (int, 1–30) and `remind_at_local` (`HH:MM`) and `timezone` (IANA name). Writes
the plant and one `reminders` row due at the next `remind_at_local` in `timezone`, never more than 24 h out.

### 2.3 The worker's loop (JOB)

Every 5 minutes: `select … from reminders where sent_at is null and due_at <= now() order by due_at limit 100`;
for each, send `body` over `channel`; set `sent_at = now()` in the same transaction as the send's success.
A failed send leaves `sent_at` null and is retried next tick, at most 3 times (then `channel = 'failed'`).

## 3. File plan

| Repo | File | Change |
|---|---|---|
| `garden-api` | `src/db/schema.ts` | columns on `plants`; new `reminders` |
| `garden-api` | `migrations/0007_reminders.sql` | the migration (owner applies it) |
| `garden-api` | `src/routes/plants.ts` | accept the schedule; write the first row |
| `garden-api` | `src/routes/reminders.ts` | new: `PATCH /reminders/:id/acted` |
| `garden-web` | `src/pages/AddPlant.tsx` | keep the interval, add the time, send both |
| `garden-web` | `src/pages/Plant.tsx` | on `?reminder=<id>`, call `PATCH …/acted` |
| `garden-worker` | `jobs/remind.py` | read `reminders`, send the row, write `sent_at` |

## 4. Risks

| Risk | What we do |
|---|---|
| The migration runs against production with reminders already in flight | API-1 lands with the loop still reading `plants`; JOB-1 switches the read only after the table has rows for every plant (a one-off backfill the owner runs) |
| A time zone the browser reports is not an IANA name | The API rejects it and the form falls back to UTC with a visible note |
| D-1 stays open | REQ-X1.3 is built against `channel = 'email'` behind a flag and not enabled until the ruling |
