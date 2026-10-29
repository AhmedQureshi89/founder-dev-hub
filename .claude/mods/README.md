# Hub mods — what runs inside a Claude Code session

A **mod** is a plugin whose code runs inside Claude Code itself: it is called on an event (a tool
call, a prompt, a part of the screen being drawn) and can watch it, change it, or draw. Unlike a
skill or a settings hook, a mod can draw a pane, a band above the prompt, a status-line entry or a
toast. Docs: [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview) ·
[Mods reference](https://code.claude.com/docs/en/plugins/mods/reference). They run in the terminal
and in the desktop app's Code tab; in `claude -p`, the VS Code chat panel and WSL sessions the
hooks still run but nothing is drawn.

**A mod runs with the permissions of the person running the session** — it can read and write
files, start processes and make network requests. Every mod here is reviewed as code: by pull
request, like anything else in this tree, and `claude plugin validate <folder>` lists what it
hooks and calls before it is loaded anywhere.

**Nothing in a mod names your product, your repos or your people.** All three read
[`hub.json`](../../hub.json) at the hub root — the repos and their id prefixes, the owner, the
contributors — so the same code serves any hub. The sketches in each mod's README use the kit's
example hub: a product called Pocket Garden, three code repos with the lanes `WEB`, `API` and `JOB`,
an owner and one contributor.

| Mod | What it does | Reads | Writes |
|---|---|---|---|
| [`hub-desk/`](hub-desk/) | A pane with what the hub holds for the session's repo: the open `▶ … inbox` notes (`tools/inbox.py`) as coloured status tags, and the roadmap's *Owner's queue* with overdue and *Due now* rows in the warning colour. A note's number (1–9) opens its text in a second pane; `p` there puts "pick up this note" into the prompt. Every read also pins `📬 n waiting` as the status line under the prompt. Read at session start, after every main-loop turn, on `/hub-desk` and on its Refresh button. | `hub.json`, `tools/inbox.py` (run), `.claude/context/roadmap.md` (and the note's file when it has moved to `.claude/inbox/`) | nothing on disk — the prompt box on `p`, and its own status line |
| [`hub-gate/`](hub-gate/) | Holds `git commit` / `git push` until `tools/specs_check.py` exits 0, refusing the call with the ✗ lines otherwise; refuses Edit / Write / NotebookEdit to the protected paths (`CLAUDE.md`, `.claude/{context,briefs,returns,skills,mods}/`, `tools/`, migrations, CI and deploy config) when `git config user.email` is a contributor's, as `hub.json` lists them. | `hub.json`, `tools/specs_check.py` (run), `git config user.email` | nothing |
| [`phase-progress/`](phase-progress/) | A pane with how far the current phase is from done: the boxes of its `verification.md` ticked on origin's default branch as a bar, what is left (and 🚦 gates ticked), the sections still open, and the last merges that changed it with the ticks each brought; the bar pinned as the status line. Origin is asked every minute (`git ls-remote`), after every main-loop turn, and after a merge, pull or fetch the session ran; when it moved, a toast says so — *🔀 #41 merged — JOB-3: 69 → 73 of 123 (+4) · 50 to go* — and a new session tells the merges made since the last one. The phase is the one pinned with `/phase-progress <n>`, else the one the branch names, else the one changed last with boxes open. Opens at session start in a code repo; quiet in the hub until `/phase-progress`. | `hub.json`, git (`fetch`, `ls-remote`, `ls-tree`, `log`, `show`, …), the working tree's `verification.md` | nothing on disk — its own store (a pin per repository, where the last read left off), toast and status line |

## How a mod reaches a session

This repository is the marketplace: [`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json)
at its root lists the mods, each by a relative path into `.claude/mods/`. The mods are **turned on
at project scope** — [`.claude/settings.json`](../settings.json), committed, lists each under
`enabledPlugins` — so every session opened in this repository runs them. Two facts make that work
without an install step per person:

- a plugin listed by a relative path loads **from the marketplace folder itself**, never from a
  copy, so no install record is needed and an edit here reaches a session at its next start or
  `/reload-plugins`;
- a project-scope plugin loads only after the person has trusted the folder (the workspace trust
  dialog), the same check as the project's own allow rules.

What each person does **once per machine** is tell Claude Code where the marketplace is. From the
prompt of any session:

```
/plugin marketplace add <path to your hub checkout>            # the owner: the local checkout, read live
/plugin marketplace add <your-github-user>/<your-hub-repo>     # everyone else: a clone from GitHub
```

Until that is done, `/plugin` → **Errors** says the plugin *is enabled in project settings but isn't
installed here*; after it, the mods load in every hub session with nothing further to run. A clone
from GitHub is refreshed with `/plugin marketplace update founder-dev-hub`.

**Outside the hub.** A mod that should also run in a code-repo session — hub-desk reads that repo's
inbox, hub-gate gates that repo's commits — is installed there at user or local scope:

```
/plugin install hub-desk@founder-dev-hub
/plugin install hub-gate@founder-dev-hub
/plugin install phase-progress@founder-dev-hub
```

Each then asks once for its **Hub checkout** option: the path of your hub checkout, the folder that
holds `hub.json` (`/plugin configure <mod>@founder-dev-hub` reopens the dialog). Inside the hub the
option may stay empty: the session's own root is the hub.

**phase-progress is a code-repo mod first.** It counts the session's own repository, and it does its
work where development happens: it opens and polls in a session of any repo `hub.json` lists, and
stays quiet in the hub until `/phase-progress`. It is on at project scope here like the others,
which gives hub sessions the command; to reach the code repos it is turned on at **user scope** —
`/plugin install phase-progress@founder-dev-hub` at the user scope from a terminal, or
`"phase-progress@founder-dev-hub": true` under `enabledPlugins` in `~/.claude/settings.json` —
and told where the hub is through its Hub checkout option, which is how it knows which lane each
repo is.

## Working on one

```
claude plugin validate .claude/mods/<mod>     # what it hooks and calls; what the engine would refuse
claude plugin test     .claude/mods/<mod>     # its *.test.ts(x), run against the engine without a session
```

Each mod is three files and a contract: `.claude-plugin/plugin.json` (the manifest),
`hooks/hooks.json` (names the module), `hooks/register.tsx` (the hooks), and `types/index.d.ts`
(what it keeps in `$.state`). A new mod gets a row in the table above and an entry in the
marketplace file; what it needs to know about the hub it reads from `hub.json`, never from a
constant. The `plugin-authoring` skill writes one from a description and hot-reloads it in the
session that wrote it; the finished folder is copied here.
