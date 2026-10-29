# Pocket Garden — getting started as a new developer

Welcome. This page gets you from an empty laptop to Pocket Garden running locally, in the order that
works. It is written so that **you never have to do anything administrative** — every step that needs a
permission, an account or a decision is already done by Sam before you start, and if one is not,
the fix is to tell them, not to work around it.

**Rule zero: if a step fails and this page does not say what to do, stop and message Sam.**
Do not create accounts, request roles or copy credentials from anywhere else to keep moving. A stalled
setup costs an hour; a workaround costs much more.

---

## 0. What Pocket Garden is, in one paragraph

Pocket Garden is a web platform that reminds people to water their plants and shows them what it noticed. The long version — who it is for, what it never does, the
principles every line of code answers to — is the [constitution](../.claude/context/constitution.md).
Read §4 and §5 before you write anything; they apply to test copy, fixtures and commit messages too.

## 1. The repositories

```
   garden-web  ──►     garden-api  ──►     garden-worker
   the web app people use ·    the API and the database ·    the background jobs that send the reminders

   pocket-garden-hub  ── this repo: the roadmap, the briefs, and the rules
```

| Repo | GitHub | What it is |
|---|---|---|
| `pocket-garden-hub` | `sam-example/pocket-garden-hub` | The hub. Read `CLAUDE.md` here first. |
| `garden-web` | `sam-example/garden-web` | the web app people use |
| `garden-api` | `sam-example/garden-api` | the API and the database |
| `garden-worker` | `sam-example/garden-worker` | the background jobs that send the reminders |

## 2. What Sam has already done for you

You should have received, from Sam directly:

| | What | Why you need it |
|---|---|---|
| ✅ | Collaborator access to the repositories above | To clone and open pull requests |
| ✅ | The configuration each service needs (its `.env` file, or the way to fetch it) | Each service reads its settings from a file that is **never committed** |
| ✅ | The name of the roadmap item you are starting on | Work is assigned, one item at a time — [`team-roles.md`](team-roles.md) §2.7 |

If any of the three is missing, ask. There is no self-service path.

## 3. Install the tools (once)

> ✍️ *Sam: list the runtimes and tools the services need, with the version and a one-line check
> for each — Git, the language runtimes, a container runtime if a database runs locally, the Claude Code
> CLI. The table below is the shape.*

| Tool | Get it from | Check it works |
|---|---|---|
| Git | https://git-scm.com | `git --version` |
| Claude Code | https://claude.com/claude-code | `claude --version` |
| Python 3.9+ (the hub's tools) | https://python.org | `python --version` |

## 4. Clone the repositories, side by side

Pick a folder. The code repos **should be siblings of the hub**, because `hub.json` names each one by a
path relative to the hub (`../garden-web` and so on).

```
git clone https://github.com/sam-example/pocket-garden-hub.git
git clone https://github.com/sam-example/garden-web.git
git clone https://github.com/sam-example/garden-api.git
git clone https://github.com/sam-example/garden-worker.git
```

## 5. Fetch your configuration

> ✍️ *Sam: say how a developer gets each service's `.env` — a shared vault, a password manager,
> a file handed over in person. Say what it must never do: be committed, pasted in chat, screenshotted.*

**The `.env` files are the one thing on your machine that must stay on your machine.** `git status`
before every commit — if `.env` ever shows up there, stop and tell Sam.

## 6. Run the services

> ✍️ *Sam: one block per service — the folder, the install command, the run command, the port,
> and the one line that says it is up. The table below is the shape.*

| Service | Start | It is up when |
|---|---|---|
| `garden-web` | `cd ../garden-web` then … | … |
| `garden-api` | `cd ../garden-api` then … | … |
| `garden-worker` | `cd ../garden-worker` then … | … |

## 7. Before your first change — how work happens here

- **Read [`CLAUDE.md`](../CLAUDE.md) in this repo.** It explains the ids (`WEB, API, JOB`, `X-`), the
  roadmap, and the rule that *the constitution beats the code*.
- **Work on a branch, open a pull request.** Nothing goes to the default branch directly. Sam
  reviews and merges. The full rule — which paths you may write, the branch name, the commit identity,
  what the owner checks before merging — is [`team-roles.md`](team-roles.md).
- **Each code repo has a `specs/` folder** with the requirements it is built from. Read the one for the
  area you are touching before you touch it. `specs/CONVENTIONS.md` is the rules for that folder.
- **One REQ per session.** In the code repo, `/spec-next` picks the next unchecked requirement of the
  current phase, builds it, runs its check, ticks the box, commits, stops.
- **Tests green before you ask for review.** A PR with red checks is not ready.
- **When something is unclear, ask early**, with the file and line you are looking at.
- **Found something another repo must do?** Do not fix it there. File a `▶ <ID> — inbox` note in the hub's
  roadmap under that repo's item — [`hub-inbox`](../.claude/skills/hub-inbox/SKILL.md) is the procedure.

## 8. When you leave

Nothing for you to do. Sam removes your repository access; delete your local `.env` files as a
courtesy.
