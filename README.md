# Founder Dev Hub

Run product development with [Claude Code](https://claude.com/claude-code) from one **hub** repository:
a problem goes in as a brief, verified work comes out of your code repos, and every decision stays yours.

You write down what is wrong and how you will know it is fixed. Claude files it, works out which repos it
touches, writes the plan, builds one requirement at a time, runs the check, and keeps the record. You rule
on what enters the week, whether a gate passed, and what ships. Nothing is marked done because it was
written — only because it was measured.

```
   you: a brief ──► intake ──► which repos? ──► the triad ──► build one REQ ──► the gate ──► you rule
   (a problem,       (an id,     (fan-out +      (requirements,  per session       (measured     (done, or not;
    evidence,         filed       cross-review)   specs,          (/spec-next)       once, never   recorded)
    a bar)            verbatim)                   verification)                      retried)
```

It started as one solo founder's working hub for a real product with three code repos, used every day for
two months and about seven hundred commits, with everything specific to that product taken out. The
example inside is a made-up plant-reminder platform, **Pocket Garden**, so the roadmap, a brief, a plan and
the checks have something to show on day one.

## What you get

| Part | What it is |
|---|---|
| **One config file** | `hub.json` names your product, you, your code repos (each with a short id prefix: `WEB-1`, `API-7`) and anyone else who writes code. Every tool, skill and mod reads it. |
| **The documents** | A **constitution** (what the product is; it beats the code), a **roadmap** (the one planning layer: your queue first, then NOW / NEXT / LATER), **open decisions**, **briefs** and **returns**, each with an index. |
| **The workflow, as skills** | `/hub-brief` writes a brief by interview · `/hub-intake` files it with an id · `/hub-fan-out` asks each repo "which requirements are yours?" with one agent per repo · `/hub-cross-review` challenges every "not mine" before it is believed · `/hub-inbox` carries a finding from one repo to another. |
| **A kit for each code repo** | `python tools/service_init.py API` gives a repo its `specs/` folder, a `CLAUDE.md` that points at the hub, a CI job that runs the checker, and the `spec-phase` / `spec-next` / `spec-run` / `spec-status` skills that write the plan and build it one requirement per session. |
| **A checker** | `tools/specs_check.py` asserts the rules — every phase has a row, every requirement names its owner, a phase called done has no open boxes, every link resolves, only the one status vocabulary is used. It reports and never repairs. `python tools/check.py` runs everything CI runs. |
| **Three mods** | Code that runs inside Claude Code: **hub-desk** (a pane with what waits on this repo and on you), **hub-gate** (holds `git commit` until the checker is green; refuses a contributor's write to a protected path), **phase-progress** (a bar of the current phase's ticked boxes, re-counted on every merge). |
| **Guided setup and a tour** | `/hub-setup` asks about your product and writes everything; `/hub-tour` walks through the example in five minutes. [The walkthrough](docs/walkthrough.md) shows one problem from brief to ruling. |
| **Guard rails** | A tick means verified, not written. A gate is taken once and never retried for a better number. Ids are never reused. Live numbers carry their date. The session that did the work never grades it. |

## What you need

- **Claude Code** and a claude.ai account.
- **Python 3.9+** — the tools use only the standard library. Nothing to install.
- **Git**, and a GitHub account for your repos.

## Get started

1. **Get your own copy.** On GitHub, press **Use this template** → *Create a new repository*. Make it
   **private**, because your roadmap is your business. Clone it beside your code repos.
2. **Open Claude Code in the folder and type `/hub-setup`.** That is the whole setup.

```
 /hub-setup  (about ten minutes)
   ├─ welcome, and a 5-minute /hub-tour of the example if you want it
   ├─ a few questions at a time: your product, you, this repo, each code repo and its prefix,
   │  anyone else who writes code ("just me" is the common answer)
   ├─ you check the hub.json it will write
   ├─ Claude writes it, renders the documents with your names in them, removes the example,
   │  and runs the checker — green
   ├─ it fills the constitution with you: what the product is, who it is for, what it never does
   ├─ it offers to connect each code repo (specs/, CI, the spec-* skills) and to turn the mods on
   └─ one commit, on your word
```

New to the method? Type `/hub-tour` first, or read **[the walkthrough](docs/walkthrough.md)** and
**[the concepts](docs/concepts.md)**. Why each rule exists: **[docs/why.md](docs/why.md)**.

<details>
<summary>Set it up by hand instead</summary>

1. `python tools/hub_init.py` asks the same questions in the terminal and writes `hub.json`, the documents
   and removes the example. (`--answers file.json` takes them from a file; `--from-hub` only re-renders.)
2. Open `.claude/context/constitution.md` and replace every ✍️ block with your own words.
3. For each code repo: `python tools/service_init.py <PREFIX>`. If this hub is private, add a repository
   secret `HUB_TOKEN` in each code repo so its CI can read the hub.
4. `python tools/check.py` — green — then commit.
5. In Claude Code: `/plugin marketplace add <absolute path of this folder>`, then `/reload-plugins`, and
   the three mods load in every session opened here.

</details>

## Using it day to day

| You say | Claude runs | What happens |
|---|---|---|
| "show me how this works" | `/hub-tour` | Six short stops: the config, the constitution, a brief, the roadmap with its notes, the plan, a week in the hub. |
| "I have a problem to solve" / "write a brief for …" | `/hub-brief` | An interview — the problem, the evidence with its sources, the success metric and its last event, non-goals, the verdict gates — then a draft in the shape intake expects. |
| "file this brief" | `/hub-intake` | The next free id, the text filed **verbatim** below a header block, two index rows, one commit. Intake never rewrites a brief. |
| "which repos does this touch?" | `/hub-fan-out` then `/hub-cross-review` | One agent per code repo reads only its own tree and answers; every "no" is checked against the metric's last event and the other repos' answers before it is believed. |
| "what is waiting on the API?" | `python tools/inbox.py API` | The open notes other repos have left for that one, oldest first. |
| in a code repo: "plan phase 3" | `/spec-phase 3` | `requirements.md`, `specs.md`, `verification.md` from the brief; the gates copied word for word. |
| in a code repo: "next requirement" | `/spec-next` | One REQ: the code, its check run, its box ticked, one commit. Then it stops. |
| "is the hub healthy?" | `python tools/check.py` | Every check CI runs. |

You decide what enters the week, whether a gate passed, whether a return is answered, and what ships.
Claude keeps the record, runs the checks, and never grades its own work.

## How the pieces fit

```
   your-hub/                                   your code repos (one per prefix)
   ├─ hub.json ───────────── names ──────────► garden-web/   garden-api/   garden-worker/
   ├─ CLAUDE.md                                ├─ CLAUDE.md  (points at the hub)
   ├─ .claude/context/                         ├─ specs/
   │   ├─ constitution.md   what it IS         │   ├─ mission.md       a pointer to the constitution
   │   ├─ roadmap.md        the one plan       │   ├─ roadmap.md       this repo's phases (no status)
   │   └─ open-decisions.md                    │   ├─ CONVENTIONS.md   the rules the checker asserts
   ├─ .claude/briefs/       problems in        │   └─ phase-N/         requirements · specs · verification
   ├─ .claude/returns/      questions back     └─ .github/workflows/specs-check.yml ──► runs the hub's checker
   ├─ .claude/skills/       the workflow
   ├─ .claude/mods/         desk · gate · progress
   └─ tools/                checker · ids · inbox · setup
```

Everything is plain Markdown and JSON in git. The hub is the record; the code repos are the work; the
checker is how the two are kept honest, from both sides' CI.

## The rules in one screen

- **The constitution beats the code.** If a service behaves differently from what is written there, the
  service is wrong.
- **One planning layer.** Status lives in the hub's roadmap and nowhere else. One committed outcome per repo
  per week; **parked means parked.**
- **One writer.** Claude Code writes the hub, as the person running it: the owner's git identity writes
  anything, a contributor's writes only their item, by pull request.
- **A brief names a problem, not a repo.** Which repos it becomes is decided by reading each one, and a
  "not mine" is challenged, never believed — whoever owns the **last event** of the success metric is on
  the critical path.
- **A tick means verified, not written.** A verdict gate is taken once, on its date, and never retried for
  a better number. The session that did the work does not grade it.
- **Live numbers carry their date and their query.** Nobody copies one forward as today's.
- **Ids are never reused.** A mention anywhere in the hub takes an id.
- **The checker reports; it never repairs.**

## License

MIT. See `LICENSE`.
