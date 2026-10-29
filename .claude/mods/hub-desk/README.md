# hub-desk

A pane beside the transcript with what the hub holds for this session's repo, so a session reads
what is waiting on it without opening the roadmap. The sketch is the kit's example hub — a product
called Pocket Garden with three code repos, lanes `WEB`, `API` and `JOB` — seen from a session in
`garden-api`:

```
 🗂 Hub desk  API   read 14:02 UTC   [Refresh r] [Close]

 ╭──────────────────────────────────────────────────────────────────╮
 │ 📬 Inbox for API                               1 open · 1 partial │
 │ 🔲 OPEN      3 d old   roadmap.md:412                             │
 │ 1: API — inbox: the worker reads reminders.sent_at; the API nev…  │
 │ 🟡 PARTIAL   13 d old  roadmap.md:357                             │
 │ 2: API — inbox: clear the three standing specs-check reds         │
 │   ↳ picked up: (A) only, by the session that filed the return     │
 ╰──────────────────────────────────────────────────────────────────╯
 ╭──────────────────────────────────────────────────────────────────╮
 │ 🧑‍⚖️ Owner's queue              3 rulings · 2 owner-only actions │
 │ Rulings                                                           │
 │ 03-04 Product decisions D-1 reminder cadence · D-3 the weekly di… │
 │ 03-14 After X-11: what enters 🔥 NOW. … Due now — X-11 closed …   │
 │ …                                                                 │
 │ Owner-only actions                                                │
 │ 03-04 X-2: rotate the mail provider's key (KI-2), then confirm …  │
 │ …                                                                 │
 ╰──────────────────────────────────────────────────────────────────╯
 r refresh · 1-9 open a note · ↑↓ scroll · Esc back to the prompt · 🟠 date = older than 30 days or due now
```

Two framed cards under a one-line header. An inbox note is a coloured status tag (🔲 OPEN in
the warning colour, 🟡 PARTIAL in the suggestion colour, ✅ DONE in green), its age, where it
sits, then its title on its own line and the partial pick-up under it; the inbox card's frame
turns to the warning colour while anything waits. A queue row is its date in the margin and the
question beside it; a date older than 30 days, or a question that says *Due now*, is drawn in
the warning colour. Inline above the prompt each queue list is cut to 5 rows with a `+n more`
line; docked beside the transcript (fullscreen, 110 columns and up) the lists are whole.

**The status line counts.** Every read also pins `📬 n waiting` under the prompt — the open and
partial notes addressed to this repo — so the count is on screen even with the pane closed. It
reads `📬 hub not found` or `📬 inbox unread` when the desk could not read.

**A note's title is a button.** Press its number (or click it) and the note's own text — from its
`### ▶` heading to the next heading, read from the roadmap at that line — opens in a second pane,
*Inbox note*, with the file and line at the top. `p` puts *"Pick up the inbox note at
.claude/context/roadmap.md:357 — …"* into the prompt; Esc closes the pane. A note that has moved
to its own file under `.claude/inbox/` opens whole.

- **Inbox** is `python tools/inbox.py <LANE>` run from the hub checkout, one note per status line
  it printed (the raw lines are shown only if none parse).
- **Owner's queue** is the roadmap's opening section, its two tables read row by row.
- **Which repo** comes from `hub.json`: the main working tree's folder name is matched against
  `repos[].name`, case-insensitively, and that repo's `prefix` is the lane (`garden-api` → `API` in
  the example). The hub itself, and any folder hub.json does not list, read as `HUB`; a worktree
  reads as its repository.
- **Where the hub is**: the first of the session's root, the main working tree's root and the
  **Hub checkout** option that holds both `hub.json` and `tools/inbox.py`. Without one the pane
  says so and stays open; a `hub.json` that does not parse is reported the same way.

Install, from the prompt of any session — the hub's [`mods/README.md`](../README.md) has the two
marketplace lines first (the owner adds the local checkout, everyone else the GitHub repo):

```
/plugin install hub-desk@founder-dev-hub
```

Re-read at session start, after every main-loop turn (not a subagent's), on `/hub-desk`, and on
the Refresh button. It writes nothing but the prompt box, on `p`, and its own status line. Its
hooks and calls, as `claude plugin validate` lists them: `session.start`, `command.run{hub-desk}`,
`turn.complete`, `ui.render{Pane}` (twice: the desk and the note); `$.process.run`, `$.fs.read`,
`$.fs.exists`, `$.session.root`, `$.session.repo`, `$.clock.now`, `$.ui.open`, `$.ui.close`,
`$.ui.status`, `$.prompt.fill`, `$.command.register`, `$.state`.
