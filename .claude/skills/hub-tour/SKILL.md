---
name: hub-tour
description: A five-minute walk through the hub on whatever it holds - the example product (Pocket Garden) on a fresh copy, or the founder's own documents once set up. Use when the founder types /hub-tour or says "show me how this works", "give me the tour", "walk me through it", "what is all this", or asks what a brief, a triad, a verdict gate or an inbox note is. Six short stops, each a file opened and explained, with one command run so they see the tools work. Writes nothing.
---

Six stops. At each: open the file named, show a short excerpt (ten lines at most), explain it in three to
five plain sentences, and ask "next?". The whole tour is read-only — no file is written, nothing is
committed. If `hub.json` says `"example": false`, the stops are the same and the files are the founder's;
where a stop names Pocket Garden, use what their documents say instead.

Keep the vocabulary plain. Define a term the first time it is used, in the sentence that uses it.

## Stop 1 — one file names everything: `hub.json`

Open it. Point at the four things it names: the product, the owner, the repos (each with a short **prefix**
that starts its ids — `WEB-1`, `API-7`), and who else may write code. Say: *every tool, skill and mod reads
this file, so there is one place to change a name.* Then open `CLAUDE.md` and read its "Who is who" section
aloud: the owner rules, Claude Code types, and it types **as the person running it** — a contributor's
session refuses the paths that are not theirs.

## Stop 2 — what the product is: the constitution

Open `.claude/context/constitution.md`. Show §4 (binding principles) and §5 (what it is NOT). Say: *this
document beats the code — if the product behaves differently, the product is wrong.* Then show §7, the
scorecard, and the row that says **not measurable yet**: in the example, nobody can tell whether a reminder
was delivered, because a send leaves no record. That gap is why the first brief exists.

## Stop 3 — a problem, written down: the brief

Open `.claude/briefs/x-1.md`. Show the header block above the `---` rule and the text below it. Say: *above
the rule is the hub's — the id, who wrote it, when, what the fan-out found; below the rule is the author's
text, filed verbatim and never edited.* Scroll to the **verdict gates** (🚦-1 …): each is a measurement
with a bar and a date, taken **once** — a recorded fail is a result, not a bug to fix and re-run. Then open
`.claude/briefs/README.md`: one line per brief, never its status.

## Stop 4 — the one planning layer: the roadmap

Open `.claude/context/roadmap.md`. Four things, in order:

1. **The owner's queue** at the top: every decision waiting on the owner, oldest first. The `hub-desk` pane
   shows this in every session. In the example, D-1 — which channel sends first.
2. **The 🔥 NOW table**: X-1's row and its three half-rows (WEB-1, API-1, JOB-1). Say: *a cross-repo item
   gets one row for the item and one per repo, so each repo's half can be tracked and checked.*
3. **The fan-out and cross-review notes** under the table. Tell the story in four sentences: three agents
   read three repos separately; the worker said "not mine"; the cross-review asked *in whose process does
   the metric's last event happen?* — the worker's; the "no" was overturned. *A no is checked, never
   believed.*
4. **The inbox note** `▶ JOB-1 — inbox`: a message from one repo's session to another, filed under the
   reader's row. Run `python tools/inbox.py JOB` and show the one open note it lists. Say: *a session asks
   for its repo's notes in one call instead of reading the whole roadmap.*

## Stop 5 — from brief to proof: the triad

Open `.claude/context/phase-x1-reminders-delivered/requirements.md`. Show two REQ lines and their owner
tags (`· WEB`, `· API+JOB`). Say: *every requirement names the repo that owns it; a checker fails a
requirement with no owner, and a repo with no row.* Then open `verification.md` of the same folder: the
gates copied **verbatim** from the brief, with checks underneath and empty boxes. *A box is ticked when the
check was run and recorded, never when the code was written.*

Run `python tools/check.py` and show the green result. Name what it checked: the status markers, every link
in the hub, every REQ's owner, every inbox note's address, the next free id of each prefix.

## Stop 6 — what a week looks like

No file. One diagram and five sentences:

```
   you write a brief ──► /hub-intake files it ──► /hub-fan-out + /hub-cross-review say which repos
          │
          ▼
   in each code repo: /spec-phase writes the triad ──► /spec-next builds ONE requirement per session,
   runs its check, ticks the box, commits, stops ──► the gate is measured once ──► you rule
```

*You decide what enters NOW, whether a gate passed, and what ships. Claude keeps the record, runs the
checks and never grades its own work. One committed outcome per repo per week; parked means parked.*

End with one line: on the example, `/hub-setup` makes it theirs in about ten minutes; on their own hub,
`/hub-brief` writes the next brief.
