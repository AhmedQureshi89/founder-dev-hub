# Why each rule exists — the incidents behind `hub-inbox`

Nothing here is needed to file or pick up a note. All of it is why the procedure in `SKILL.md`
is shaped the way it is. Each section is *what happened · what rule it produced*. The incidents are
told without their names — the product, the items, the people and the dates do not matter; the
shape of each mistake does.

## 1. Invented twice before it was written down

Two notes — one from the API's session to the web app's, one from the web app's session to the
worker's — were written on the same day by two sessions that had never seen each other's note.
Both put the record in the hub's roadmap; both cited file and line; both expected the receiver to
close the loop in place. One mechanism under two names. The hub's rules file named it once that
evening, and this skill is that text as a procedure.

**Rule it produced:** *the hub note is the record.* Two sessions arrived at it independently
because nothing else survives a session ending.

**The first of those notes is also the standard for A.1.** A session in the API's repo read the
web app's source directly and cited the file, the line and the two constant names: the client sent
one spelling of a value, the database's check constraint wanted another. Measured in the other
repo, not guessed. The session that picked it up had nothing to re-derive.

## 2. Filed on the wrong row

A requirement with another repo as its subject — *"the worker receives the outcome, not the
script"* — was in a cross-repo item's requirements from the first day and belonged to the worker's
repo from that moment. The dependency was recorded, but under **the writer's** row and in a
diagram: the writer's place, not the reader's. A session opening the worker's item to see what was
waiting on it found nothing there. The requirement had no owning row until both other halves of
the item had shipped, and nobody had noticed the worker was on the critical path.

**Rule it produced:** *file it in the reader's row, with a `↩`.* A note is found where its reader
looks, and the row of the item that must act is the only place that reader is certain to look.

## 3. The hub is the collision point

The hub is the one tree two sessions write at once. Once, the hub's branch switched under a
running session; a malformed `git merge` failed while the chained `push` still ran; and the default
branch was briefly left holding a **blocking** return with no record of the ruling that had already
resolved it. Anyone reading the hub in that window saw an open blocker on a settled question.

**Rules it produced:** *pull first; read the branch you are on rather than assuming; push
immediately.* An unpushed hub commit is invisible to every other repo, because each of them reads
the hub as a separate working copy. And *note first, then ring*: the note survives the session,
the message does not.

## 4. The prose did not stop it

A hub session that had just run a brief's fan-out and cross-review, with the full cross-repo
protocol in its always-loaded rules file, wrote the code repo's triad **into that repo's tree** as
a pull request — a hub session writing a code repo, the thing the protocol's first diagram forbids.
It then offered to build. The owner corrected both. The PR was closed and an inbox note was written
instead, opening with *"Both were wrong. The PR is closed; this note is what should have been
written instead."* A session of that repo picked the note up the same day and wrote the triad from
its own side.

**What it produced:** this skill. A procedure that lives in an always-loaded rules file is read
once and scrolled past; a skill is read at the moment it is needed. The rule itself — *no session
edits another repo's tree* — was already written down. Placement was the problem.

## 5. Never ring a session inside a gate — a rule with no incident yet

This one is preventive, and stays so on purpose. A verdict gate is pre-registered, run once, and
never retried for a better number; a recorded FAIL is a complete outcome. If a contract moves
under a running gate — because a message arrived mid-run and the session acted on it — the result
is ambiguous: neither the old contract's nor the new one's. There is no clean way back from that,
because re-running is exactly what the rule forbids. So the note waits, and the next session of
that repo reads it at start.
