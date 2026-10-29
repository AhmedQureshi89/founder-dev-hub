---
name: hub-brief
description: Write a brief by interview - the document that makes a problem real enough to build from. Use when the founder types /hub-brief or says "I have a problem", "write a brief for …", "I want to build …", "we should add …", "help me scope this", or describes something the product should do. Asks for the problem, the evidence, the success metric and its last event, the non-goals, who is affected and the verdict gates; writes the brief in the shape intake expects, as a draft the founder reads before /hub-intake files it. Never files, never assigns an id, never names a repo as the owner.
---

A brief names a **problem**, not a feature and not a repo. This skill turns what the founder knows into
that document, in the fixed shape every brief has, so intake can file it verbatim and the fan-out can decide
which repos it becomes. It does not file it, does not give it an id, and does not start work.

**How to ask.** Two or three questions per message. Push back, kindly, on a solution offered as a problem
("add a button" is a solution; "people cannot find X" is a problem) and on a number with no source. "I
don't know" is an honest answer: it becomes a line in *Evidence* saying what is not known and how it could
be read. Never ask for credentials; if a database or analytics connector is available in the session, offer
to run the queries; otherwise write them down to be run.

## 1. Before asking — what the hub already knows

Read `.claude/context/constitution.md` §4 (binding principles), §5 (what it is NOT) and §7 (the
scorecard), and the roadmap's NOW / NEXT tables. If the founder's problem is already an item, say so and
stop; if it contradicts a principle or a NOT line, say which, and ask whether this is a brief or an
amendment to the constitution — those are different documents.

## 2. The questions

| Group | Ask | Becomes |
|---|---|---|
| **A. The problem** | What happens today that should not, or does not happen that should? Who does it happen to? How did you find out? | *The problem* — one or two paragraphs, in the founder's words |
| **B. Evidence** | What numbers show it? Where would each be read — which table, which event, which report? When was it last read? | *Evidence* — a table of **what · the query or source · the reading and its date**. A number with no source is written as *not yet read* with the query that would read it |
| **C. The chain** | When this works, what happens, in order, from the first thing a person does to the last thing the product does? Which of those is the one that says "it worked"? | *Success metric* — `first_event → last_event`, with the **last event** named, because whoever owns it is on the critical path |
| **D. Not this time** | What will people assume is included that is not? What are you deliberately leaving out? | *Non-goals* — a list; each line saves an argument later |
| **E. Who** | Who is affected, and how many of them, today? | *Who is affected* — one or two lines with a number and its date |
| **F. The bar** | How would you know it worked — what would you measure, by when, and what number is good enough? Offer two to four, each with a bar and a date. Ask "what if it comes back lower?" once: the answer goes in the gate's text or the brief fails on the first bad number. | *Verdict gates* — 🚦-1 …, each a measurement, a bar, a date, and the query that takes it |

A gate is taken **once**, on the date it names, and never retried for a better number. Say this when you
write the gates, and write it into the brief.

## 3. Read it back

Show the whole brief in chat, in the shape below, and ask for corrections. Say which repos it *seems* to
touch and why — then say plainly that the fan-out decides, not this conversation.

## 4. Write the draft

Write it to `.claude/briefs/_drafts/<slug>.md` (create the folder if needed), where `<slug>` is the title in
lowercase with hyphens. **No id anywhere in the file** — `tools/next_id.py` counts every mention, and the id
is intake's to issue. Existing ids it depends on (an open decision, a known issue) may be named.

```
# <title, as a problem, not a feature>

## The problem

<A — the founder's words, tidied, not rewritten>

## Evidence

Run again before quoting; the readings were taken <date>.

| What | Query or source | Read <date> |
|---|---|---|
| … | … | … / *not yet read* |

## Success metric

`<first event> → <last event>` within <time>, for <whom>. The last event in the chain is **<last event>** —
whoever owns it is on the critical path.

## Non-goals

- …

## Who is affected

<E>

## Verdict gates

Each is taken once, on the date it names, and never retried for a better number.

- **🚦-1** — <the measurement>, **<the bar>**, <by when>. <The query, or where it is read.>
- **🚦-2** — …
```

## 5. Hand it to intake

Say where the draft is and what happens next: `/hub-intake` issues the id, files the text **verbatim** below
a header block, indexes it, commits, and deletes the draft in the same commit. Offer to run it now. Until
then the brief is a draft: it has no id, no row, and no standing.

## Rules this skill must not break

- **A problem, not a feature.** The brief says what is wrong and how we will know it is fixed; the triad
  says how.
- **Never assign a repo.** "Seems to touch" is the most this conversation may say; the fan-out decides.
- **Never write an unissued id.** Not in the draft, not in chat.
- **Every number has a date and a source**, or is written as *not yet read*.
- **A gate has a bar and a date**, and is taken once.
