# phase-progress

A pane and a status line that say how far the current phase is from done, re-counted each time
something merges. A phase is done when every box in its `verification.md` is ticked; this mod
counts them as they stand on origin's default branch — what is merged — and in the working tree.
The sketch is the kit's example hub, a product called Pocket Garden, seen from a session in its
worker repo (lane `JOB`); every number in it is made up.

```
 📐 Phase progress  JOB-3   origin/main 5a1e126 · read 10:02 UTC   [Refresh r] [Close]

 ╭──────────────────────────────────────────────────────────────────╮
 │ A Reminder Engine: Watering Times Computed in Code…              │
 │ specs/phase-3/verification.md — named by the branch job-3/req-3.6│
 │                                                                  │
 │ ███████████████████████████░░░░░░░░░░░░░░░░░░░░░ 59 %            │
 │ 73 of 123 boxes ticked · 50 to go · 🚦 2 of 9 verdict gates      │
 │ 🌿 job-3/req-3.6: +3 ticked here, not merged yet                 │
 ╰──────────────────────────────────────────────────────────────────╯
 ╭──────────────────────────────────────────────────────────────────╮
 │ 🔲 Still open                                  7 of 20 sections  │
 │ 🟡 REQ-3.4 — values only, in CI                     █████░ 6/7   │
 │ 🟡 REQ-3.9 — default@1                              ████░░ 5/8   │
 │ 🔲 REQ-3.6 — the swap                               ░░░░░░ 0/14  │
 │ …                                                                │
 │ ✅ 13 sections complete                                          │
 ╰──────────────────────────────────────────────────────────────────╯
 ╭──────────────────────────────────────────────────────────────────╮
 │ 🔀 Merges into main            the last 8 that changed this phase │
 │ 03-11 #41 REQ-3.13 sealed …                          +4 → 73/123  │
 │ 03-11 #40 REQ-3.11's production record               +1 → 69/123  │
 │ …                                                                │
 ╰──────────────────────────────────────────────────────────────────╯
 r refresh · /phase-progress 3 pins a phase, auto unpins · origin is checked every minute
```

**Each time something merges.** Every minute, after every main-loop turn, and after a `git merge`,
`git pull`, `git fetch` or `gh pr merge` the session ran, `git ls-remote` asks whether origin's
default branch moved. When it did, the mod fetches, re-counts, and raises a toast:

```
🔀 #41 merged — JOB-3: 69 → 73 of 123 (+4) · 50 to go
```

The first read of a session compares with where the last session in the same repository left off
(kept in the mod's own store), so a merge made between sessions is told too, prefixed *Since the
last session:*. The status line under the prompt carries the bar at all times —
`📐 JOB-3 ██████░░░░ 73/123 · 50 to go`, or `📐 JOB-3 ✅ all 123 ticked`.

**What it counts.** Every `- [x]`, `- [ ]` and `- [~]` line in the phase's `verification.md`,
quoted amendments (`> - [ ]`) included; boxes inside code fences and HTML comments are examples,
not checks. A partial mark (`[~]`) counts as still to go. A box struck through (`- [ ] ~~…~~`) is a
record kept on purpose — `spec-status`'s *permanently unticked* — and is left out of the total. A
box whose line says `VERDICT GATE`, or opens with 🚦, is also counted as a 🚦 gate. **Every box
ticked is not the phase closed**: the pane says so, and the close stays the owner's word.

**Which phase**, in this order, and the pane says which rule chose it:

1. **Pinned** — `/phase-progress 3` (or `21.2`, `JOB-8`, `phase-8-access`) pins a phase for this
   repository, across sessions; `/phase-progress auto` unpins. A pin that names no phase falls
   back to the rules below and says so.
2. **Named by the branch** — `job-3/…` → phase 3, `api-4.7/…` → phase 4.7, `claude/req-3-13-…` →
   phase 3. The lane prefixes a branch may carry are the ones `hub.json` lists (`WEB`, `API`, `JOB`
   and the cross-repo `X` in the example), matched case-insensitively. A number with several
   folders (`web-21` → `phase-21.0` … `phase-21.4`) takes the one changed last that still has boxes
   open.
3. **Changed last** — the phase whose `verification.md` changed last on the default branch and
   still has boxes open; when every phase is ticked, the one changed last.

Phases are the `specs/phase-*/verification.md` files (and, in the hub, `.claude/context/phase-*/`)
on origin's tip, plus any this branch adds. A checkout that is only behind origin is told so —
*is 4 ticks behind origin/main — pull to catch up* — and a phase origin has since moved to
`specs/archive/` is not offered as new.

**Where it runs, and how it knows.** Which lane a session is comes from `hub.json`: the main
working tree's folder name is matched against `repos[].name`, and that repo's `prefix` names the
phase on screen (`garden-worker` → `JOB-3`). In a code-repo session it opens its pane at session
start and polls. **In the hub it stays quiet** — no pane, no status line, no polling — until
`/phase-progress` is run: development happens in the code repos. The hub is the first of the
session's root, the main working tree's root and the mod's **Hub checkout** option that holds
`hub.json`; a code-repo session needs the option set (`/plugin configure
phase-progress@founder-dev-hub`), since its own root has no hub.json. Without one every repo reads
as `HUB` — quiet, the phase named by its folder alone — and the pane, once opened, says to set the
option.

Install, from the prompt of a terminal session (the hub's [`mods/README.md`](../README.md) has the
marketplace lines first); the user scope reaches every repository:

```
/plugin install phase-progress@founder-dev-hub
```

It reads `hub.json`, git (`rev-parse`, `symbolic-ref`, `fetch`, `ls-remote`, `ls-tree`, `log`,
`show`, `merge-base`, `diff --name-only`, `ls-files --others`) and the working tree's
`verification.md`; it writes nothing in the repository. Its hooks and calls, as `claude plugin
validate` lists them: `session.start`, `command.run{phase-progress}`, `turn.complete`,
`tool.call{Bash}` and `tool.call{PowerShell}` (each passes the call through, then re-reads after a
merge, pull or fetch), `ui.render{Pane}`; `$.process.run`, `$.fs.read`, `$.fs.exists`,
`$.session.root`, `$.session.repo`, `$.clock.now`, `$.clock.every`, `$.store` (the pin, and where
the last read left off), `$.ui.open`, `$.ui.close`, `$.ui.status`, `$.ui.toast`,
`$.command.register`, `$.state`.
