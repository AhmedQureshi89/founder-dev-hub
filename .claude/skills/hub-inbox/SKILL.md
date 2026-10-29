---
name: hub-inbox
description: File and pick up cross-repo inbox notes — the protocol by which a session in one repo (any code repo in hub.json, or the hub itself) tells another repo it must act. Write a ▶ <ID> — inbox note in the hub's roadmap under the row of the item that must act, ring a live session as a doorbell, and on the receiving side pick the note up and close it with ✅ PICKED UP. Use this skill whenever work in one repo turns up something another repo has to change or know — a renamed enum, a contract or schema that does not match what the other side sends, a table another repo reads, a verdict gate that cannot be satisfied as written, a metric rename, a CI check the other repo must adopt — even if nobody says "inbox". Also use it when a session opens on, or is rung about, a ▶ … inbox note addressed to its repo, or is asked "what is waiting on this repo", "pick up the inbox", "file a note for the web app / the API / the worker", "tell the API session", "ring the WEB session", or "/hub-inbox".
---

# Hub inbox — how a discovery travels between repos

Several code repos, one hub, and more than one session running at a time. A session working in
one repo keeps finding things another repo has to act on: a renamed enum, a contract that does not
match, a gate that cannot be satisfied as written. This skill is how that travels **without waiting
for the owner to carry it, and without one session writing two trees.** The record is a note in
the hub's roadmap; a message to a live session is only the doorbell.

**Bound by:** the hub's cross-repo protocol — five rules, which this file turns into a procedure:

- **Read everywhere, write only your own** — your code repo and the hub.
- **Confirm by reading** — cite file and line.
- **Note first, then ring** — the note is the record; **never ring a session running a verdict gate.**
- **A fix your repo does not own is a return, not a note.**
- **The hub is the collision point** — pull first, check the branch, push at once.

Where this file and the hub's `CLAUDE.md` disagree, `CLAUDE.md` wins. Why each rule exists, with
the incidents that produced it: [`references/why.md`](references/why.md) — read it once; you do not
need it to act.

**Which half are you?**

```
  you found something another repo must act on ─────────► A. file a note
  you are the repo that must act (a ↩ on your row,
  a ring, or "what is waiting on this repo?")   ─────────► B. pick up a note
```

The working copies — read any of them, write only your own and the hub:

| Repo | Where |
|---|---|
| the hub | the folder holding `hub.json` |
| each code repo | `hub.json` → `repos[].path`, relative to the hub root; its prefix and name are on the same entry |

In the kit's example: `WEB` `garden-web`, `API` `garden-api`, `JOB` `garden-worker`. Never type a
path or a prefix from memory; read it.

## A. File a note

### A.1 Confirm it by reading the other repo's tree — cite file and line

Open the receiving repo's working copy and read the thing you are about to claim: the schema, the
enum, the route, the copy string. Write down `path:line` for each fact. If you cannot find it,
say what you searched and that it came up empty — that is also a fact.

*Why:* a note that says *"the web app probably sends X"* is worth nothing to the session that
receives it; it has to go and find out, which is the work the note was meant to save. The first
note ever written cited file and line, and the constant names, measured in the receiving repo by
the session that wrote the note. That is the standard.

### A.2 Note, or return?

```
  can the receiving repo fix it in its own tree?
        │
        ├── yes ──► a note (continue at A.3)
        │
        └── no — the fix needs an edit *your* repo does not own:
                 a verdict gate above all, which copies verbatim and is the
                 brief author's text; a brief's premise; an ownership question
                 ──► a return: .claude/returns/<item>.md — it blocks, it does not travel.
                     Write that instead, give it its row in .claude/returns/README.md
                     with the mark 🔲 open, and stop here.
```

*Why:* a note asks a repo to do something it can do. A gate is nobody's to edit but the brief
author's, so a note asking for it would sit forever. A return records the evidence, lists the
options with their costs, states a recommendation, and says plainly what it has *not* done;
nothing moves until the owner's ruling comes back.

### A.3 Find the reader's row, and mark it

In `.claude/context/roadmap.md`, find the row of the item that must **act** — the receiving repo's
item, never your own. Append to the end of that row's last cell, byte for byte:

```
 ↩ *▶ <ID> — inbox* below.
```

If the receiving repo has no item for this yet, the note goes under the closest item it owns and
says so in its first line; opening a row is the hub session's call, not yours.

*Why:* a dependency once sat for a day filed under the writer's row and in a diagram — the wrong
place for someone opening the receiving repo's item to find it. A note is filed where its reader
will look.

### A.4 Write the note, in the shape every note already has

After the table that row is in, newest first (before the first existing `### ▶` note of that
table), write:

```
### ▶ <ID> — inbox: <what the receiving repo must do, one line>

*Written <YYYY-MM-DD> by the <repo> session <doing what>. Filed here because
`<receiving repo>` must act and this session writes only its own repo and the hub.
<Rung <session> at <time> · Not rung — none live · Not rung — live but running <gate>.>*

**The fact.** <what you found, with every path:line from A.1 — read, not reasoned>

**What this repo does.** <the change, in the receiving repo's own terms: its item, REQ, PR flow>

**What this repo does not do.** <the boundary — what stays with you, what waits on a ruling>

**Still the owner's.** <the rulings this needs — or "nothing">

Then append `✅ PICKED UP` here with <the commit, what changed, what is still unrun>.
```

Keep it to what the receiver needs to act. The last line is not decoration: it tells the receiver
where the loop closes.

**The heading must name the receiving repo**, because that is how `tools/inbox.py` routes it (B.1).
Four ways, and the prefixes and names come from `hub.json`:

| The heading names the receiver by | Example |
|---|---|
| the id's prefix | `### ▶ API-3 — inbox: …` |
| the repo's name | `### ▶ garden-worker — inbox: …` |
| several repos at once | `### ▶ WEB · API · JOB — inbox: …` |
| a parenthesis after "inbox" — **needed for an `X-` item**, or when the note sits under another repo's row | `### ▶ X-1 — inbox (api): …` · `### ▶ X-1 — inbox (garden-worker): …` |

The hub's CI runs `python tools/inbox.py --check` and fails on a heading it cannot route. The filed
line opens `*Written <YYYY-MM-DD> by …*` — the script reads the date from it.

*Why the shape:* the receiver has read every earlier note in this shape; a new shape is a new
thing to learn under time pressure.

### A.5 Commit the hub — pull first, check the branch, push at once

The hub is a **separate working copy** from every code repo, and it is the one tree two sessions
write at the same time. From the hub root:

```
git pull --ff-only                          # or fetch + merge on a worktree branch
git branch --show-current                   # read it; it must be hub.json → hub.default_branch — never assume
git add .claude/context/roadmap.md
git commit -F <message>                     # names the item and what the note asks
git push                                    # in the same step
```

If the push is rejected, another session landed first: merge the default branch from origin,
re-run `python tools/specs_check.py . --hub .`, push again. Do not leave the commit unpushed. The
`hub-gate` mod, where it is installed, holds the commit until the checker is green.

*Why:* an unpushed hub commit is invisible to every other repo — each reads the hub as its own
working copy. And once the hub branch switched under a running session, a malformed merge failed
while the chained push still ran, and the default branch briefly held a blocking return with no
record of the ruling that resolved it. Pull, look at the branch, push at once.

### A.6 Then ring — as a doorbell, never as the record

Only now, with the note pushed:

1. List the live sessions, with whatever your Claude Code offers for that (`ListAgents` on a
   desktop; `list_sessions` from a remote session).
2. Is one plainly a session of the receiving repo? Its name says the repo or the item.
3. Is it running a verdict gate? Its name says so, or the item's `verification.md` shows a gate
   in progress, or it is busy on one. **If so, do not ring.** The next session reads the note.
4. Otherwise message it (`SendMessage` / `send_message`), the whole message being:

```
▶ <ID> — inbox filed in the hub at <commit>, under the <ID> row: <one line>.
A doorbell, not an instruction — the note is the record.
```

If no session is live, nothing is lost: the note is durable and the next session of that repo
opens on it.

*Why the order:* a session is ephemeral; the message could be the only copy of the finding if the
note were not already pushed. *Why the gate rule:* a contract moving under a gate makes the
recorded result ambiguous, and gates are never retried for a better number — a recorded FAIL is a
complete outcome. Ringing mid-gate can turn a real result into an argument.

## B. Pick up a note

### B.1 Find what is waiting on your repo

Pull the hub first (as A.5), then ask it — one call, from the hub root, with your repo's prefix
from `hub.json` (or `HUB` for the hub itself):

```
python tools/inbox.py <PREFIX|HUB>          # JOB, API, WEB … in the example
```

It lists the open and partly picked-up `▶ … inbox` notes addressed to your repo, oldest first,
each with its line in the roadmap, its filing date and age, and — for a partial one — your repo's
pick-up so far. Open each note it names and read it whole, including any `✅ PICKED UP` already
under it — a note can be picked up in stages. *The fallback, if the script cannot run: the rows of
the items your repo owns, where a ` ↩ ` at the end of a row points down to its note.*

If you were rung, the message named the commit and the heading; the note is still what you act
on, not the message.

*Why:* nothing in a code repo tells a session to look, and the `↩` on a row of a long file is the
only signal on the reader's side — in one hub, dozens of sessions touched the roadmap and none read
it whole. A note nobody reads is a finding lost.

### B.2 Act in your own tree only

Do what the note asks the way your repo does things — its triad, its PR flow, its gates. Never
touch the writer's tree, even to fix the thing the note cited: if that needs changing, it is your
note back to them (A).

*Why:* one session writing two repos is how a hub got a blocking return on its default branch with
no ruling beside it, and how a code repo's triad came to be written from the wrong side as a pull
request.

### B.3 Close the loop in the note itself

Append directly under the note — not in a reply to the owner, not in your own repo's files only:

```
**✅ PICKED UP — <YYYY-MM-DD>, by the <repo> session, on this note.** <what changed: commits,
PRs, files, in one or two sentences> **Not done:** <what, and why — or omit>. **Still unrun:**
<gates, merges, builds>. **The owner's:** <what still needs the owner's word — or "nothing">.
```

`tools/inbox.py` reads that line. Three things it reads from it:

- The opening is fixed: `**✅ PICKED UP — <date>, by the <repo> session, on this note.**` (a
  `#### ✅ PICKED UP` heading also counts).
- When a note addressed to several repos (`▶ WEB · API · JOB — inbox`) is picked up by one of them,
  name your repo **by its name** in that line — *by the `garden-api` session* — so the script can
  mark your part done and leave the others open.
- The words **only**, **open**, **partial** and **not picked up** in that line leave the note
  partial on purpose. Write one of them when your pick-up is partial — *"picked up the migration
  only; the route is open"* — and none of them when it is complete.

*Why:* if the state lives only in your head or your reply, the owner is carrying it between
sessions — which is the thing this mechanism exists to stop.

### B.4 Commit and push the hub

As A.5: pull, check the branch, commit with a message naming the item and what was picked up,
push at once.

## Rules this skill must not break

- **Never edit another repo's tree.** Read anywhere; write your own repo and the hub.
- **Never ring a session that is running a verdict gate.** The note waits; the gate does not.
- **Never let the message be the only copy.** Note first, pushed, then ring.
- **Never file under the writer's own row.** The reader's row, with the `↩`.
- **Never leave a note without `✅ PICKED UP` or a return.** A note that is not closed in place is
  state the owner is carrying.
- **Never change the heading or pick-up shapes.** `tools/inbox.py` and the hub's CI read them byte
  for byte.
