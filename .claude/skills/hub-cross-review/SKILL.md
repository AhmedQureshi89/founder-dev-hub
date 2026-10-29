---
name: hub-cross-review
description: Challenge the intake fan-out's answers before they are believed — for every repo that says "not my repo", run the three checks (named by another repo? owns the success metric's last event? read its tree for the brief's contracts) and record a verdict per repo with the challenge text written down. A "no" with no challenge text is a failing output. Trigger on "/hub-cross-review", "cross-review the fan-out", "challenge the fan-out", "is the worker really not involved", "is <repo> really out", or after any fan-out round that returns a NO.
---

# Hub cross-review — step ④ of the hub workflow

The fan-out (step ③) asks each code repo *which REQs are mine?* and each answers reading only its
own tree. A repo that answers **no** has told you what it could see, not what is true — *"the text
is fixed copy rendered by the web app, so there is no worker dependency"* is true of the copy and
false of the item whose metric ends in a delivery, and one agent reading one repo cannot tell those
apart. This skill is the step that refuses to take a no on its own word.

**Bound by:** the hub's two checks for *which repos a brief becomes* — *assign from the success
metric* and *tag every requirement, then count*. The mechanical half of the second check is
`specs_check.py` R13; this skill is the half R13 cannot do. Where this file and the hub's `CLAUDE.md`
disagree, `CLAUDE.md` wins.

## 1. Input — one block per repo in `hub.json`, as the fan-out returns them

```
repo:      <PREFIX — one of hub.json repos[].prefix>
answer:    YES | NO
reqs:      REQ ids claimed (YES), or none (NO)
evidence:  file:line reads in its own tree — may be empty; that is data, not a verdict
names:     other repos this answer depends on ("API must expose …", "the worker delivers …")
```

Also needed, from the brief: the **success metric** and the **last event** in its chain, and the
list of every table, enum, endpoint, event name and contract the brief mentions. Read the brief
for these; do not take them from the fan-out. And from `hub.json`: every repo's `path`, so the
trees can be read.

## 2. For every `NO`, run three checks and write each one down

| | Check | Question | The NO is overturned when |
|---|---|---|---|
| C1 | named-by | Does any `YES` block's `names:` line, or any REQ's text, point at this repo? | yes — the claiming repo has already put it on the critical path |
| C2 | last-event | In whose process does the success metric's **last** event happen? | this repo's — *whoever owns the last event in the metric chain is on the critical path by definition* |
| C3 | tree-read | Read this repo's tree (its working copy at `hub.json` `repos[].path`; start where its `CLAUDE.md` says the code lives) for every contract the brief names. Cite file:line, or cite the search that found nothing. | anything is found |

Each cell is a sentence *you* wrote from what *you* read — not the fan-out's evidence line
re-quoted. Read the other repos' trees directly; every working copy `hub.json` names is on this
machine and reading is free (the cross-repo protocol: *read everywhere, write only your own*).

`YES` blocks are not challenged here — their REQ tags go to R13 and to round two of the fan-out,
which is where an over-claim is argued.

## 3. Verdicts

| Verdict | Meaning | What follows |
|---|---|---|
| `YES` | the fan-out's claim, REQs listed | tag the REQs; a half-row in the roadmap |
| `NO — checked` | C1, C2, C3 all written, none overturned | the repo is out; the three cells are the audit trail |
| `NEEDS REVIEW` | any check overturned | the fan-out owes this repo a round two; the brief's repo list is provisional until then |

## 4. Output — one table, and the failing case

```
| repo | fan-out said | C1 named-by | C2 last-event | C3 tree-read | verdict |
```

**A `NO — checked` row with any of C1–C3 blank is a failing output.** Say so in the report, do not
present the table to the owner as verdicts, and go back to §2. The rule exists because a blank cell
is exactly what a missed half looks like from the outside: a no, unexamined, that read as settled.

File the table in `.claude/context/roadmap.md` beneath the item's fan-out note, under a heading in
this fixed shape — `<n>` being the number of NO blocks:

```
### ▶ <ID> — cross-review: the <n> NOs challenged, per `hub-cross-review`
```

Then report to the owner which repos are in, which are out and why, and which are `NEEDS REVIEW`
and what round two must answer.

## 5. Worked example — Pocket Garden, brief X-1 *"reminders people act on"*

Brief: a plant's owner is reminded when it is due for water, and acts on the reminder. Success
metric: `plant_added → first_reminder_delivered`. Contracts named: `plants.watering_interval_days`,
`reminders.due_at`, the `plant_added` and `first_reminder_delivered` events, the reminder's link
back to the plant, *"the worker sends what the API recorded"* (REQ-X1.4).

Fan-out returned:

```
repo: WEB   answer: YES   reqs: X1.1, X1.2, X1.6   evidence: PlantForm.tsx:41 …        names: API (POST /plants, next_due_at)
repo: API   answer: YES   reqs: X1.3, X1.4         evidence: 0007_plants.sql:12 …      names: JOB ("the worker delivers")
repo: JOB   answer: NO    reqs: —   evidence: (empty)
            reason given: "the reminder text is fixed copy rendered by the web app, so there is no worker dependency"
```

Cross-review:

| repo | fan-out said | C1 named-by | C2 last-event | C3 tree-read | verdict |
|---|---|---|---|---|---|
| WEB | YES | — | — | — | `YES` (X1.1, X1.2, X1.6) |
| API | YES | — | — | — | `YES` (X1.3, X1.4) |
| JOB | NO — *"text is rendered by the web app"* | **Overturned.** API's block names the worker (*"the worker delivers"*), and REQ-X1.4 reads *"the worker sends what the API recorded"* — a REQ with the worker as its subject. | **Overturned.** `first_reminder_delivered` is the last event; the only process that sends anything is `garden-worker`'s `jobs/send_reminders.py`. The metric ends in the worker's process. | Read `garden-worker` at `9ad44c0`: `jobs/send_reminders.py:1-60` polls a `due_jobs` queue and sends nothing from `reminders` yet; `git grep due_at` → no hit. Nothing named in the brief lived there **yet** — which is the point: the REQ creates the dependency. | **`NEEDS REVIEW`** — round two must ask JOB which REQs are its; the answer is X1.4's worker half and the delivery itself |

The fan-out's sentence was true and the verdict is still overturned: C1 and C2 both land, and C3
finding nothing is not a no — it shows the tree the REQ would have to change. The real item this
example is drawn from skipped this table, was filed as two repos, and both halves shipped before
the third had a row.

## Rules this skill must not break

- **A no is checked, never believed.** Three cells, each written by the reviewer.
- **Confirm by reading, not by reasoning.** C3 cites file:line or the search that came up empty.
- **The disagreement is the deliverable.** A table where every no is `NO — checked` on the first
  pass is suspicious, not reassuring; say what was read that made it so.
- **Cross-review does not tag.** It produces verdicts; tagging and the half-rows are step ⑤, and
  `NEEDS REVIEW` goes back to step ③.
- **Nothing is written in a code repo's tree.** Reading for C3 is reading.
