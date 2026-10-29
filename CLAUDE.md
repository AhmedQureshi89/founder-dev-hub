# Pocket Garden — the development hub

> ⚠️ **This hub still holds the example product.** Everything in it — Pocket Garden, Sam, the three
> garden repos, brief X-1 — is made up so the kit has something to show on day one. On the founder's
> first message, whatever it says, tell them so in one line and offer two starts: `/hub-tour` (see how
> the hub works on the example, about five minutes) or `/hub-setup` (answer a few questions; Claude
> writes their own hub, about ten minutes). Do not file, fan out or build anything on the example
> unless they ask to try it.

**This repo is the source of truth for how Pocket Garden is developed.** What is committed here is what
is true — for the code repos, for CI, for a teammate, and for Sam. Pocket Garden is
a web platform that reminds people to water their plants and shows them what it noticed, built across the 3 code repo(s) listed below; this hub holds what is being
built, in what order, by which repo, and whether it is done. The code repos hold the code.

| Repo | Prefix | What it is |
|---|---|---|
| `garden-web` | `WEB-` | the web app people use |
| `garden-api` | `API-` | the API and the database |
| `garden-worker` | `JOB-` | the background jobs that send the reminders |
| `pocket-garden-hub` | `X-` (cross-repo), `D-` (decisions), `KI-` (known issues) | this hub |

`hub.json` at the root names the product, the owner, the repos and their local paths, the id prefixes and
the contributors. Every tool, skill and mod reads it. **Never type a repo path from memory — read it there.**

## Who is who

- **Sam is the owner.** Every ruling is theirs: what enters 🔥 NOW, whether a gate passed, whether a
  return is answered, what ships. A session prepares the material; the owner performs the act.
- **Claude Code is the only writer in this tree**, and it writes **as the person running it** — it reads
  `git config user.email` and applies that person's write set ([`onboarding/team-roles.md`](onboarding/team-roles.md)).
  Under the owner's address it may write anything here. Under a contributor's address it writes only
  their item's code, that item's triad text and an inbox note under their own row — and refuses the
  rest, even when asked.
- **Documents arrive as changes, through intake.** A brief drafted somewhere else is not a brief until
  it is filed here. Where a copy elsewhere disagrees with this repo, this repo wins.

## The documents

| File | What it is | Read it before |
|---|---|---|
| [`.claude/context/constitution.md`](.claude/context/constitution.md) | What Pocket Garden **is**: who it is for, what it does, the binding principles, what it is NOT, the promises asserted by tests, the live scorecard, data and privacy | Any answer about product direction or scope |
| [`.claude/context/roadmap.md`](.claude/context/roadmap.md) | **The one planning layer.** The owner's queue first, then 🔥 NOW (committed), NEXT and LATER, known issues, and the `▶` notes sessions leave each other | Any question about priorities; before planning or starting work |
| [`.claude/context/open-decisions.md`](.claude/context/open-decisions.md) | The decisions only the owner can make, each with its options and what waits on it | Anything that touches an open `D-` |
| [`.claude/briefs/`](.claude/briefs/README.md) | One brief per item: problem, evidence as re-runnable queries, success metric, non-goals, verdict gates. The index is one line per brief, never its status | Writing or building anything with an id |
| [`.claude/returns/`](.claude/returns/README.md) | Questions back to a brief's author that block until ruled | When a gate cannot be measured or a brief contradicts the code |
| `.claude/context/phase-<id>-<slug>/` | The triad of a cross-repo or hub-only item: `requirements.md`, `specs.md`, `verification.md` | Building that item |
| [`.claude/context/history/`](.claude/context/history/README.md) | Closed items' records, kept whole | Looking something up; never as a spec to build from |

## Standing rules

- **The constitution beats the code.** If a service behaves differently from what is written there, that is
  a defect in the service, not an update to reality.
- **The roadmap is the one planning layer.** 🔥 NOW is what is committed; everything else waits. One
  committed outcome per repo per week. **Parked means parked** — not worked on, not reported on, not
  re-raised until the committed outcome lands.
- **The owner's queue stays true.** The roadmap opens with every decision and owner-only action waiting on
  Sam. The commit that records a ruling removes its line; a session that puts a new question adds one.
- **A tick means verified, not written.** A verdict gate is pre-registered, run once, and never retried for a
  better number. A recorded FAIL is a complete outcome.
- **The session that did the work does not grade it.** It assembles the evidence; the owner rules.
- **Live numbers live in constitution §7**, each with the date it was read and its source. Any other document
  quotes a number with its date or points there. **Re-run the source before quoting it.**
- **Constitution §8 first.** A new processor or data category needs §8 updated *before* the code ships.
- **Ids are never reused.** `python tools/next_id.py <PREFIX> --show` is the only source; a mention anywhere
  in the hub takes an id, so write `X-<next>` until the id is issued.
- **The checker is the gate.** `python tools/check.py` must be green before a commit; the `hub-gate` mod
  holds `git commit` and `git push` until it is.

## Cross-repo protocol

A session that finds something another repo must act on files a `▶ <ID> — inbox` note in the roadmap under
**that item's** row; the receiving repo closes it with `✅ PICKED UP`. Five rules:

- **Read everywhere, write only your own** — your code repo and the hub.
- **Confirm by reading** — cite file and line.
- **Note first, then ring** — the note is the record; **never ring a session running a verdict gate.**
- **A fix your repo does not own is a return, not a note.**
- **The hub is the collision point** — pull first, check the branch, push at once.

Procedure: [`.claude/skills/hub-inbox/SKILL.md`](.claude/skills/hub-inbox/SKILL.md). What is waiting on a
repo, in one call: `python tools/inbox.py <PREFIX>`.

## Briefs — how work enters

A brief names a problem, not a repo. It enters through **intake** ([`hub-intake`](.claude/skills/hub-intake/SKILL.md)):
an id from `tools/next_id.py`, the text filed **verbatim** below a header block, two index rows, one commit.
Intake does not rewrite the substance — a brief that is wrong is filed as received and answered with a return.
No brief yet? [`hub-brief`](.claude/skills/hub-brief/SKILL.md) interviews the owner and writes one.

**Which repos a brief becomes** is decided by two checks, never by a glance:

- **Assign from the success metric, not from the feature.** Whoever owns the **last event** in the metric
  chain is on the critical path by definition, however many repos render and store the feature before it.
- **Tag every requirement with a repo, then count.** Any repo holding one or more REQ gets a row in the
  roadmap and a triad of its own.

Both run as a fan-out — one agent per repo in `hub.json`, each reading only its own tree
([`hub-fan-out`](.claude/skills/hub-fan-out/SKILL.md)) — and then every "not my repo" is challenged before it
is believed ([`hub-cross-review`](.claude/skills/hub-cross-review/SKILL.md)).

Every REQ in a cross-repo (`X-`) requirements document then carries its owner on its own line:

```
**REQ-X1.4 · WEB — <what must become true>**
```

`tools/specs_check.py` **R13** fails when a REQ names no repo, and when a repo it names has no roadmap row.
**R13c** runs from each code repo's CI and fails when that repo's `specs/` never mentions a REQ tagged to it.
They prove an owner was *recorded*, never that the owner is *right* — that is why the fan-out's challenge is not optional.

**Then the triad, then the build.** In the code repo: `/spec-phase` writes `requirements.md`, `specs.md`,
`verification.md` from the brief; **gates copy verbatim into `verification.md`** — write checks underneath a
gate, never edit the gate. `/spec-next` builds one REQ per session, runs its gate, ticks, commits, stops.
Re-run the brief's queries; never copy its numbers.

## Returns — the way back

`.claude/returns/<item>.md`, written by a session, carried to the brief's author by the owner. A return
**blocks, it does not decide**: it records the evidence, lists the options with their costs, states a
recommendation, and says plainly what has *not* been done. Every return has one mark in the returns index —
🔲 open · ✅ ruled · ⛔ closed — set once, when it is ruled.

## Repo layout

```
hub.json                               the product, the owner, the repos, the prefixes, the contributors
CLAUDE.md                              this file
.claude/context/                       constitution, roadmap, open decisions, cross-repo triads, history/
.claude/briefs/                        briefs, and README.md as their index
.claude/returns/                       returns, and README.md as their index
.claude/skills/                        hub-setup · hub-tour · hub-brief · hub-intake · hub-fan-out ·
                                       hub-cross-review · hub-inbox — the workflow, step by step
.claude/mods/                          hub-desk (the pane), hub-gate (the commit gate), phase-progress (the bar)
.claude-plugin/marketplace.json        lists the mods so a session loads them from this checkout
.claude/settings.json                  turns the mods on for every session opened here
tools/specs_check.py                   the governance checker — one copy, run from every repo's CI
tools/next_id.py · inbox.py · check.py the next free id · what waits on a repo · every check at once
tools/hub_init.py · service_init.py    set this hub up · give a code repo its specs/ and CI
tools/render.py · tools/templates/     the documents above are rendered from these on setup
templates/service-repo/                what each code repo gets: CLAUDE.md, specs/, CI, the spec-* skills
onboarding/                            a new developer's first day · who may write what
docs/                                  the walkthrough, the concepts, why the rules exist
```
