---
name: hub-setup
description: The hub's first run. Use when the founder types /hub-setup or says "set me up", "make this mine", "how do I start", "onboard me", or opens a hub whose hub.json still says "example": true - a short welcome, an optional tour, a few questions about their product, their repos and their team, then hub.json written, the documents rendered, the example removed, the checker green, and the constitution's blanks filled in by interview.
---

Take a founder from a fresh copy of the kit to a hub that is theirs, green, and ready for its first brief,
in about ten minutes. They answer questions in plain words; Claude writes every file. Nothing is pushed,
posted or sent.

**How to ask.** Two to four questions per message, never a form. Give a one-line example answer for each,
taken from the Pocket Garden example, so the founder sees the size of answer wanted. "I don't know yet" is
a good answer where the table below says so. Use `AskUserQuestion` where the answer is a choice (tour or
set up now; which repos); plain chat otherwise. Never ask for a password, a token or a key — the hub holds
none, and says so.

## 0. Where the hub is

Read `hub.json`.

- **Not set up yet:** `"example": true`. Go on.
- **Set up already:** `"example": false`. Say so in one line, offer `/hub-tour` of *their* hub and the
  phrases of step 8, and stop. `/hub-setup` never overwrites a founder's own documents. To redo the setup
  they say "start over", and only then go on — and warn first that `tools/hub_init.py` re-renders
  `CLAUDE.md`, the constitution, the roadmap, the open decisions, the two indexes and the onboarding pages
  from the templates, so anything they wrote into those files since is replaced (git has the old version).

## 1. Welcome (one short message)

Say what the hub is in three lines, show the loop, say what they will have at the end, and ask one question.

```
   a brief ──► intake ──► which repos? ──► the triad ──► build one REQ ──► the gate ──► you rule
   (a problem,   (an id,     (fan-out +      (requirements,   per session      (measured    (done, or not;
    evidence,     filed       cross-review)   specs,           (/spec-next)      once, never   recorded)
    a bar)        verbatim)                   verification)                      retried)
```

At the end they will have: a `hub.json` naming their product, repos and people; a constitution with their
own words in it; a roadmap with an empty owner's queue; the checker green; and each code repo ready to be
connected. Ask: **see how it works on the example first** (`/hub-tour`, about five minutes) or **set up my
hub now**? If they pick the tour, run `/hub-tour` and come back to step 2 when it ends.

## 2. The questions

Ask in this order, one group per message. Write down each answer.

| Group | Ask | Becomes |
|---|---|---|
| **A. The product** | Its name, as customers see it. What it is, in one line — *"a web platform that reminds people to water their plants"*. | `product.name`, `product.one_line` |
| **B. You** | Your name. Your GitHub user name. The email your git commits carry — run `git config user.email` for them and offer what it prints. | `owner` |
| **C. This hub** | What this repo is called (offer `<product>-hub`). Its GitHub path, if it has one (user/repo) — "not yet" is fine. | `hub` |
| **D. The code repos** | One per line of work: the web app, the API, a worker, a mobile app. For each: the folder name, what it is in a few words, its GitHub path, where it is cloned relative to this hub (offer `../<name>`). Propose a 2–4 capital prefix from the name (`garden-web` → `WEB`; a second `W…` repo → `WEB2` or something clearer) and let them change it. One repo is fine. | `repos[]` |
| **E. Anyone else who writes code?** | A contractor, a friend, an intern — name, the email their commits carry, GitHub user name. "Just me" is the common answer. | `contributors[]` |

If a repo they name does not exist on disk at the path they give, say so and keep the answer: `hub.json`
may name a repo before it is cloned. Do not create folders.

## 3. Confirm before writing

Show the whole `hub.json` that will be written, as a table — product, owner, hub, one row per repo with
its prefix, the contributors — and say what happens next:

- `hub.json` is written with `"example": false`;
- `CLAUDE.md`, `.claude/context/constitution.md`, `roadmap.md`, `open-decisions.md`, `history/README.md`,
  `.claude/briefs/README.md`, `.claude/returns/README.md`, `onboarding/team-roles.md` and
  `onboarding/getting-started.md` are rendered from `tools/templates/` with their names in them;
- the example brief `x-1.md` and the example triad `phase-x1-reminders-delivered/` are deleted;
- the checker runs.

Ask for a go. On anything but a clear yes, ask what to change.

## 4. Write it

Write the answers as JSON to a scratch file (the shape is `hub.json` without `kit`, `example` and
`checks`), then run:

```
python tools/hub_init.py --answers <that file>
```

Read its output. It ends with ✅ *your hub is set up and green* or 🔴 and the checker's ✗ lines. On 🔴, read
the lines, fix what they name (a path, a prefix), and run again. Delete the scratch file either way.

## 5. Fill the constitution — the part that matters most

The rendered `constitution.md` has ✍️ marks where only the founder's words will do. Walk them in order, one
or two per message, and write each answer into the file as prose (replace the ✍️ block; keep the heading):

| Section | Ask | Shape of a good answer |
|---|---|---|
| §1 What it is | "Say it the way you would to a customer, in two or three sentences." | what a person does with it, and what they get back |
| §2 Who it is for | "Who exactly — and who not?" | one paragraph; the sharper the *not*, the better |
| §3 The services | "For each repo: what does it own that no other repo touches? Which one writes the database?" | one sentence per repo |
| §4 Binding principles | "What does the product never do, even when a customer asks? What would you fire a feature for?" Offer three to six, numbered. | short, testable, worth arguing about |
| §5 What it is NOT | "What will people ask for that the answer is no?" | a list of *Not …* lines |
| §6 Promises | "Is there any text — a tagline, a pricing line, an empty state — you would be upset to see changed by accident?" Optional. | a table of where and the text |
| §7 Scorecard | "What three numbers would tell you it is working?" Record the metric and where it would be read; leave the reading empty unless they have one *with a date*. | rows with an empty Reading, or a reading with its date and query |
| §8 Data and privacy | "What personal data does it hold, and which services see it?" | the categories, the processors |

Each section is written as soon as it is answered, so a founder who stops halfway keeps what they said.
Leave a ✍️ block in place when they say "later" — the checker does not mind, and the mark says what is owed.

## 6. Connect the code repos

For each repo in `hub.json` whose path exists on disk, offer to run

```
python tools/service_init.py <PREFIX>
```

It writes the repo's `CLAUDE.md`, `specs/` (CONVENTIONS, the mission pointer, the roadmap, a tech-specs
skeleton), a CI job that runs the checker against this hub, and the `spec-*` skills; existing files are kept.
Say, once, what the CI needs: if this hub is **private**, a repository secret `HUB_TOKEN` (a fine-grained
token that can read the hub) in each code repo's settings — the owner's to add; if the hub is public,
nothing. Do not run it for a repo that is not cloned; say which were skipped.

## 7. Turn the mods on

Say, in two lines, that the three mods (the desk pane, the commit gate, the phase bar) load from this
checkout once Claude Code knows where it is, and give the one command, with this folder's absolute path:

```
/plugin marketplace add <absolute path of this hub>
```

Then `/reload-plugins`, or a new session. Not required to use the hub; the checker still runs from
`python tools/check.py`.

## 8. Commit

Run `python tools/check.py`. When it is green, show `git status --short` and ask whether to commit. On yes,
one commit on the current branch: *"Set up the hub for <product>: hub.json, the rendered documents, the
constitution's first words"*. Do not push unless they ask; say that a push is one command away.

Then tell them the phrases that drive the hub from here:

| They say | Claude runs | What happens |
|---|---|---|
| "I have a problem to solve" / "write a brief for …" | `/hub-brief` | an interview, then a brief in the shape intake expects |
| "file this brief" | `/hub-intake` | an id, the text verbatim, two index rows, one commit |
| "which repos does this touch?" | `/hub-fan-out` then `/hub-cross-review` | one agent per repo reads its own tree; every "no" is challenged |
| "what is waiting on the API?" | `python tools/inbox.py API` | the open inbox notes for that repo |
| "is the hub healthy?" | `python tools/check.py` | every check CI runs |
| in a code repo: "plan this phase", "next requirement" | `/spec-phase`, `/spec-next` | the triad; one REQ built, checked, ticked, committed |

Close with one line: the first real step is a brief — `/hub-brief` whenever they are ready.
