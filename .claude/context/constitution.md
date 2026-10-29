# Pocket Garden — Constitution

> **What Pocket Garden is.** This document beats the code: if a service behaves differently from what is
> written here, that is a defect in the service, not an update to reality. It changes only by a dated
> amendment in §9, on the owner's word. Every code repo's `specs/mission.md` is a pointer to this file,
> never a document of its own.

---

## 1. What Pocket Garden is

**Pocket Garden is a web platform that reminds people to water their plants and shows them what it
noticed.** You add a plant, say how often it drinks, and Pocket Garden tells you when — and, when you
come back, what happened since: which plants were watered, which were skipped, which look overdue.

It is a web platform. People open it in a browser; nothing is downloaded, nothing is installed.

## 2. Who it is for

People who keep a few plants at home and lose track. Not nurseries, not growers, not people with a
greenhouse — someone with six pots on a windowsill who has killed a fern before. English first; one
language until §7 says otherwise.

## 3. What it does — the services

| Repo | Prefix | Owns |
|---|---|---|
| `garden-web` | `WEB-` | the web app people use |
| `garden-api` | `API-` | the API and the database |
| `garden-worker` | `JOB-` | the background jobs that send the reminders |

The web app is where people add plants and read what happened. The API owns every row — a plant, a
reminder, a watering — and is the only thing that writes the database. The worker sends what the API
recorded: a reminder exists as a row *before* it exists as an email, so "did they get it" is always a query.

## 4. Binding principles

Numbered, so a brief, a REQ or a return can cite one.

1. **A reminder is a row before it is a message.** Nothing is sent that was not first recorded; nothing
   recorded is sent twice.
2. **Pocket Garden suggests, it never nags.** One reminder per plant per due time; silence until the next
   one. No streaks, no guilt, no "you missed 3 days".
3. **People own their plants.** Deleting a plant deletes its reminders and its history, at once, for real.
4. **Times are the user's.** Every time is stored with its time zone and shown in it.

## 5. What Pocket Garden is NOT

- Not a plant encyclopedia. It does not diagnose, identify or recommend plants.
- Not a shop. It sells nothing and links to no shop.
- Not an app. Never "download", never "install" — a web platform, opened in a browser.
- Not a social network. No followers, no feed, no sharing.

## 6. Promises — the copy that tests assert

Words a person reads from Pocket Garden that must stay exactly so. A test in the repo that renders them
asserts these strings; a change here is a change there.

| Where | The text |
|---|---|
| The add-plant form, the reminder question | *How often does it drink?* |
| The first reminder's subject | *Time to water {plant}* |
| The empty garden | *No plants yet. Add one and we'll remind you.* |

## 7. The scorecard — live numbers, each with its date and source

**Every number here was read on a date, from a source, by a query that can be run again.** Nobody copies
one forward as today's; re-run the query, then record the new reading.

| Metric | Reading | Read on | Source and query |
|---|---|---|---|
| Registered people | 212 | 2026-10-01 | `garden-api` database: `select count(*) from users where deleted_at is null` |
| Plants added, last 30 days | 418 | 2026-10-01 | `select count(*) from plants where created_at > now() - interval '30 days'` |
| First reminder delivered within 24 h of the first plant | **not measurable yet** | 2026-10-01 | there is no `reminders` table — X-1 creates it; this cell is the reason X-1 exists |

## 8. Data and privacy

**§8 first.** A new processor or a new category of personal data is written here *before* the code that
uses it ships.

**What is collected.** An email address (to sign in and to send reminders), plant names and watering
times, the time zone the browser reports.

**Who processes it.**

| Processor | For what | Data it sees | Basis |
|---|---|---|---|
| the database host | storing every row | all of it | the contract with the user |
| the email sender | delivering reminders | email address, the reminder's text | the contract with the user |

**What is never collected.** Location beyond the time zone. Photos, until a brief says so and this table
is updated first. Anything about anyone but the signed-in person.

## 9. Amendments

Dated, in place, newest last. A change to any section above is recorded here with what it was, what it
is now, and why; the owner's word that made it.

| Date | Section | Was → now | Why |
|---|---|---|---|
| 2026-10-01 | §7 | *(new row)* → "First reminder delivered within 24 h" marked **not measurable yet** | the X-1 brief's evidence showed there is no record of a send |
