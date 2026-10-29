# `hub-fan-out` templates — copy from here

Two templates. §A is the prompt each agent receives — one per repo in `hub.json`; §B is the note
the session writes from their answers. Fill every `<…>` slot from step 0 of `SKILL.md`; change
nothing else.

## §A — the agent prompt (one per repo, all spawned in one turn)

```
You are the intake fan-out agent for ONE repository: `<REPO NAME>` (`<PREFIX>` — <its `what` from
hub.json, one line>). Its working copy is at `<PATH, resolved from hub.json repos[].path>`. You
READ ONLY that tree. Do not read or write any other repository, do not write any file anywhere, do
not run git commands that change state (read-only git such as `git log`, `git rev-parse`,
`git status`, `git branch --show-current` is fine). Ignore any `.claude/worktrees/` directory and
any checkout of the hub nested inside the repo — count only the main tree.

The brief is <ID>, at `<BRIEF PATH>`. Read it in full first (the brief is the input, not another
repo's tree). Then answer, from your repo's tree only:

**Which requirements of this brief (<REQ LIST>) are mine — that is, require a change in
`<REPO NAME>`?**

Method, in this order:
1. Record the commit and branch you read: `git -C <repo> rev-parse --short HEAD`,
   `branch --show-current`, `status --porcelain | wc -l`.
2. Read your repo's `CLAUDE.md` in full, and its `specs/README.md` or `specs/CONVENTIONS.md` if it
   has one.
3. Search the tree (grep over `<FILE GLOBS>`, excluding `node_modules`, `dist`, `.git`, `.venv`,
   `__pycache__`, `.claude/worktrees`) for every contract the brief names:
   <CONTRACTS — tables, enums, endpoints, event names, copy strings, one per line>
   and for the brief's key strings: <KEY STRINGS>. For each: the hits with file:line, or "no hit".
   Classify homonyms — a hit on a word the product also uses is not a hit on the brief.
4. Read the success metric: `<METRIC>`; its last event is `<LAST EVENT>`. Does that event happen
   in your repo's process? Cite where, or where you looked.
5. Decide YES or NO for each REQ with a one-line reason grounded in what you read.

Return EXACTLY this block, then at most 10 lines of elaboration:

repo:      <PREFIX>
read at:   <commit> on <branch>, <n> dirty files
answer:    YES | NO
reqs:      <REQ ids claimed, or none>
evidence:  <file:line reads that support the answer, separated by " · " — or the searches that
           found nothing>
names:     <other repos this answer depends on — "API must expose …", "the worker delivers …" —
           or none>
own tree:  <what your tree says that the brief does not — a line number that moved, a contract the
           brief assumes that does not exist, a second site the brief missed — or nothing>

Rules: confirm by reading, not by reasoning. Never write "probably". A NO with an empty evidence
line is legal but weak — the cross-review will challenge it, so put in the evidence line the reads
that make it a NO.
```

## §B — the note (written by the session, under the item's row)

`<n>` is the number of repos in `hub.json`, written as a word — *three* in the kit's example.

```
### ▶ <ID> — intake fan-out, round one: what <n> repos found reading separately

*Run <YYYY-MM-DD> by the hub session that <filed / picked up> <ID> (`<hub commit>`), per
`.claude/skills/hub-fan-out/` — one agent per repo in `hub.json`, each reading only its own tree,
none able to see another's answer, each asked which of <REQ LIST> are its own. Nothing here is
tagged by this note; the cross-review below turns these answers into verdicts.*

**Trees as read.** `<repo name>` at `<commit>` (`<branch>`, <n> dirty<, note>) — one such clause
per repo in `hub.json`. <Which are off their `default_branch`, and that the fan-out read what is
on disk.>

#### The blocks, as returned

```
<every block, verbatim, in hub.json order>
```

#### ✅ What the repos reached independently

| Finding | Agreement |
|---|---|
| <one finding> | <WEB + API + JOB / API + JOB / …, by what route> |

#### 🔴 What <repo> found about its own tree that the brief does not say — these shape the triad

1. **<finding>.** <file:line, what it changes for the triad>

#### 🟡 What the NO repos handed to <the YES repos> — adjudicated by reading in round two

| From | The check | Answer, read by the hub session in `<repo>` at `<commit>` |
|---|---|---|
| <API / JOB> | <the contract question the names: line raised> | <the answer, file:line> |
```

The cross-review note that follows it is `hub-cross-review` §4's table under
`### ▶ <ID> — cross-review: the <n> NOs challenged, per `hub-cross-review`` — there `<n>` is the
number of NO blocks.

## A filled example — Pocket Garden, brief X-1 *"reminders people act on"*

Success metric `plant_added → first_reminder_delivered`; the last event is `first_reminder_delivered`.
The blocks as a fan-out might return them:

```
repo:      WEB
read at:   3f9c2a1 on main, 0 dirty files
answer:    YES
reqs:      X1.1, X1.2, X1.6
evidence:  src/plants/PlantForm.tsx:41 · src/plants/PlantPage.tsx:88 · src/routes.ts:17
names:     API must accept watering_interval_days on POST /plants and return next_due_at on GET /plants/:id
own tree:  PlantForm.tsx:41 already has an unlabelled "frequency" field that nothing saves

repo:      API
read at:   b71e0d4 on main, 0 dirty files
answer:    YES
reqs:      X1.3, X1.4
evidence:  db/migrations/0007_plants.sql:12 · src/routes/plants.ts:30 · src/events.ts:9
names:     the worker delivers — the API records reminders.due_at and never sends; JOB reads the reminders table
own tree:  reminders.due_at exists (0007_plants.sql:12) and nothing writes it yet

repo:      JOB
read at:   9ad44c0 on main, 0 dirty files
answer:    NO
reqs:      none
evidence:
names:     none
own tree:  nothing
```

The `JOB` block is legal and it is weak: a NO with an empty evidence line, while another block's
`names:` line says *the worker delivers* and the metric's last event is a delivery. That is what
`hub-cross-review` exists to catch — see its worked example.
