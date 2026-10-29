# Why the fan-out is shaped this way — one miss, and the runs the shape is read from

Nothing here is needed to run the step. All of it is why the procedure in `SKILL.md` is shaped the
way it is. The incidents are told without their names: the product, the item ids and the dates do
not matter, the shape of each mistake does.

## 1. The miss — a cross-repo item lost its third half

A cross-repo item was filed as *web app + API*. The sentence that decided it read *"the text is
fixed copy rendered by the web app, so there is no worker dependency"* — true of the copy, and read
for a day as though it were true of the item. One requirement, *"the worker receives the outcome,
not the script"*, was in the requirements from the first day and belonged to the worker's repo from
that moment. It had no owning row until both other halves had shipped. The success metric would
have said so on day one: its last event was a delivery, and the only process in production that
delivered anything was the worker.

**What it produced:** the two checks in the hub's rules — *assign from the success metric, not
from the feature* (whoever owns the last event in the chain is on the critical path by definition)
and *tag every requirement with a repo, then count* (a claim about one requirement is never a
claim about the item). And the rule this skill and `hub-cross-review` are built on: **a "no" is
challenged, never believed.** One agent reading one repo cannot tell *true of the copy* from *true
of the item*; that is why every repo reads separately and a further step argues with them.

In Pocket Garden's terms: brief X-1, *"reminders people act on"*, metric
`plant_added → first_reminder_delivered`. The web app renders the reminder's text; the API records
when it is due; the worker sends it. A fan-out that returns `WEB YES, API YES, JOB NO` has
reproduced the miss exactly, and the cross-review's worked example shows it being caught.

## 2. The first fan-out — what three reads reach independently

One agent per repo, reading separately, on a brief about a feature that should fire on a
condition. What they reached independently was the strongest signal: the same reading of an
ambiguous requirement, by three different routes; and the finding that **the capability the brief
assumed existed somewhere existed nowhere** — each repo could see only that it was not in its own
tree, and only three reads side by side showed the seam between them. A single reader would have
found one of those; three found the gap.

Round two was not a second parallel read. It was **adjudication by reading**: three contested
points, each narrow and checkable, each settled by the session opening the tree — and one of them
caught an error the session had already committed: a field the hub had renamed in a note, where a
grep for the new name in the repo that owned it returned nothing at all. That is the pattern this
skill fixes as the default.

## 3. The shape — one YES, two NOs, and eight things the brief did not say

A single-repo brief was filed with its "no" for the other repos recorded for cross-review to
audit. The fan-out returned one YES on six REQs and two NOs — and **eight things the YES repo found
about its own tree that the brief did not say** (an analytics event that leaked the URL, a consent
banner a signed-in user never saw, unit tests with no browser object, a third case the brief's two
did not cover, …). Those eight reshaped the triad and two of them became gate amendments. The two
NOs handed three contract questions to the YES repo (a length cap, whether an event mirrors to the
API, whether an event fires on the press or on the server's response); round two answered all
three by reading the YES repo at the commit the fan-out read.

The note this produced is the six-part shape §B copies: provenance, trees as read, the blocks
verbatim, what the repos agreed, the own-tree findings, the hand-overs. It is also **cited by name**
from that repo's own triad, which is why the heading pattern is fixed.

**One correction the code repo recorded, carried here so the example is true:** the hub's
cross-review note said R13c would fire in that repo's CI until its `specs/phase-N/` existed. It
never did and never could — R13c walks cross-repo (`X-`) items only, so a single-repo item is never
on its list. The code repo's `verification.md` has the correction; the hub note carries it as a
dated note rather than an edit, because a filed note is a record.

## 4. Three NOs, and what a checked no looks like

A hub-only item — a procedure turned into a skill — was hub-only by construction, and the fan-out
ran anyway: every repo answered NO, each with its evidence written — the one line each tree holds
that points at the hub's rules file, the greps that found nothing, the CI that reads only the
checker. The cross-review checked each on C1–C3 from the hub session's own reads and overturned
none. Nothing was found, and that is a result: every `names:` line pointed at the hub, which became
a design constraint on the build (keep the heading byte for byte) rather than a REQ for a code repo.

The run that built this skill added one thing: **homonyms**. Searching the code repos for the word
the hub uses for this step found fifty hits in one repo — the product's own notification fan-out —
and seven in another — tool-call and pub-sub fan-out. None was a hit on the brief. The agent prompt
now says to classify a hit on a word the product also uses.

## 5. The disagreement is the deliverable

Agents that agree on the first pass have told you nothing you did not already believe. The
fan-out's value is in what one repo saw that the brief's author did not, and in what one repo
claimed of another that the other denies. That is why the blocks are recorded verbatim, why the
`names:` line exists, and why step ④ is not optional even when every answer is a clean no.
