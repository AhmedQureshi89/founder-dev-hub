# Why — the lessons behind the rules

None of the rules in this kit were designed. Each was written down the day after something went wrong, by
a founder running three code repos with Claude Code as the only writer. The product's details are taken
out; the shape of each lesson is kept, because the shape is what repeats.

## One writer, one tree

Two tools wrote the same documents for a while: a drafting assistant that exported whole files, and Claude
Code that edited them in place. Every export silently undid the edits. The fix was a rule, not a merge
strategy: **one writer in the tree**, and everything else arrives *as a change*, through intake, diffed
against what is committed. A document that changed somewhere else has not changed.

## The constitution beats the code

Three repos had three mission statements, written months apart, disagreeing on the audience, the pricing and
the product's own name. Each was "correct" when written. The fix: one constitution in the hub, and each
repo's mission file reduced to a pointer. **If the code disagrees with the constitution, the code is
wrong** — otherwise the document is updated to match whatever shipped, and stops being a standard.

## Status lives in one place

The three repos' roadmaps and the hub's each carried a status column. They disagreed within a week. A
checker then read status from prose and from bullets inside cells, and reported a phase done because a ✅
appeared as a bullet under a ⏳ row. The fix, in two parts: **status lives in the hub's roadmap and nowhere
else**, and the checker reads it only from a table row whose first cell is the bold id, first marker by
position. A mention proves an id exists; only a row sets its state.

## A "no" is challenged, never believed

A cross-repo item was filed as two repos' work. One sentence — *"the script is rendered by the web app, so
there is no dependency on the worker"* — was true of the script and false of the item: one requirement said
the worker *receives the outcome*, and the success metric's last event, *delivered*, could only happen in
the worker's process. Both other halves shipped before the third had a row. Two checks came out of it:
**assign from the success metric's last event, not from the feature**; and **tag every requirement with a
repo, then count** — one requirement earns a row. And the fan-out's rule: one agent reading one repo cannot
tell *true of a script* from *true of the item*, so every "not mine" gets three written checks before it is
believed.

## A tick means verified, not written

Boxes were ticked when the code was written, and a phase read as done with its gates untaken. Later a gate
was re-run after a fix and the better number recorded over the first. The fix is two sentences the hub now
repeats everywhere: **a tick means verified, not written**, and **a verdict gate is taken once and never
retried for a better number** — a recorded FAIL is a complete outcome, and a fix is a new item with a new
gate. The session that did the work assembles the evidence and does not grade it.

## The checker reports; it never repairs

The first version of the checker fixed what it found. The findings vanished with the evidence that they had
existed, and nobody learned why the same drift kept returning. Now it reports and exits 1. Four other things
it learned the hard way: **code is quotation** (a retired marker inside a code span is being reported, not
used); **a missing roadmap fails, it does not skip** (a rename once turned four rules into "skipped" lines
in a green run); **an unknown repo prefix fails** (a worktree's folder name silently switched the hub rules
off); and **a link's anchor is checked too** (a renamed heading breaks links silently — the file still
exists, the link just lands somewhere else).

## Ids are never reused

An id was renumbered once to "tidy up". Every citation to it — in commits, notes, pull requests — pointed at
the wrong thing from then on. Then a sentence that said *"this will be X-14"* took X-14 before it was
issued, twice. So: **ids are never reused or renumbered**; `next_id.py` reads every document and a mention
anywhere counts; prose writes `X-<next>`.

## Live numbers carry their date

A registration count was copied from one document to the next for three weeks, and the plan was argued
from a number that had doubled. Now **every number lives in the constitution's scorecard with the date it
was read and the query that read it**; every other document quotes it with its date or points there; and
nobody quotes a brief's number without re-running the query.

## Note first, then ring

Two sessions in two repos found the same cross-repo problem on the same day and each invented the same
mechanism: a note in the hub's roadmap, under the other repo's row, citing file and line. A message to a
live session is only the doorbell; **the note is the record**, because a session ends and the note does
not. Three corollaries: file it **under the reader's row**, not the writer's (a dependency sat for a day under
the wrong item, where nobody opening the right one would look); **confirm by reading** the other repo's
tree and cite `file:line` (the first note did, and the receiving session had nothing to re-derive); and
**never ring a session that is running a verdict gate** — a contract moving under a gate makes the recorded
result ambiguous, and re-running is exactly what the gate rule forbids.

## The hub is the collision point

The hub is the one tree two sessions write at once. A branch switched under a running session; a malformed
merge failed while a chained push still ran; the default branch briefly carried a blocking return with no
record of the ruling that had already settled it. So: **pull first, read the branch you are on, push at
once.** An unpushed hub commit is invisible to every other repo.

## The prose did not stop it

A hub session with the whole cross-repo protocol in its rules file wrote another repo's plan *into that
repo* as a pull request, then offered to build it. The rule was already written down. It had been read once
and scrolled past. The fix was placement, not wording: the protocol became a **skill**, read at the moment
it is needed, and the rules file kept only the five lines a session must not miss.

## Parked means parked

Everything was "in progress". Nothing landed. The capacity rule that fixed it is one line: **one committed
outcome per repo per week** sits in 🔥 NOW; everything below it is not worked on, not reported on, not
re-raised until the committed outcome lands. Most of the discipline in this kit is in that line.

## The owner's queue stays true

Decisions waited in chat transcripts, in commit messages, in a session's memory. The owner could not see
what was theirs to do. Now the roadmap **opens** with every decision and owner-only action, oldest first;
the commit that records a ruling removes its line; a session that asks a new question adds one; and a pane
shows it in every session. The owner's part of the work is always the first thing on screen.
