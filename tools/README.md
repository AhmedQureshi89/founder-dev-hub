# tools/

Everything here is standard-library Python 3.9+, reads `hub.json`, and **reports — never repairs.** A
checker that fixes its own findings destroys the evidence they existed.

| Command | Does |
|---|---|
| `python tools/check.py` | Every check CI runs, in one command. Green or the ✗ lines. Run it before every commit; the `hub-gate` mod runs the checker for you on `git commit` |
| `python tools/hub_init.py` | Makes the hub yours: asks about your product, repos and people; writes `hub.json`; renders the documents; removes the example; runs the checker. `--answers file.json` skips the questions; `--from-hub` only re-renders |
| `python tools/service_init.py <PREFIX>` | Gives one code repo its `CLAUDE.md`, `specs/` folder, CI job and the `spec-*` skills, from `templates/service-repo/`. Existing files are kept unless `--force` |
| `python tools/specs_check.py . --hub .` | The governance checker in hub mode (R6, R10h, R13). From a code repo: `python <hub>/tools/specs_check.py . --hub <hub> --prefix API` |
| `python tools/next_id.py <PREFIX> --show` | The next free id for a prefix, read from every hub document. Never type one from memory |
| `python tools/inbox.py <PREFIX\|HUB>` | The open `▶ … inbox` notes waiting on one repo, oldest first. `--all` adds the picked-up ones; `--check` exits 1 if a note names no repo |
| `python tools/render.py` | Re-renders the documents from `tools/templates/` and `hub.json`. `--check` compares instead (the kit's CI runs it while the example is in place); `--list` says which files are rendered |
| `python tools/hubconfig.py` | Prints what `hub.json` says, as the tools read it |

## `hub.json` — the one place names live

```json
{
  "kit":     { "name": "founder-dev-hub", "version": "0.1.0" },
  "example": false,
  "product": { "name": "Pocket Garden", "one_line": "a web platform that reminds people to water their plants" },
  "owner":   { "name": "Sam", "github": "sam-example", "git_email": "sam@example.com" },
  "hub":     { "name": "pocket-garden-hub", "github": "sam-example/pocket-garden-hub", "default_branch": "main" },
  "repos": [
    { "prefix": "WEB", "name": "garden-web", "what": "the web app people use", "github": "sam-example/garden-web", "path": "../garden-web", "default_branch": "main" }
  ],
  "ids": { "cross": "X", "decision": "D", "known_issue": "KI" },
  "contributors": [ { "name": "Alex", "github": "alex-example", "git_email": "alex@example.com", "branch_prefix": "alex/" } ],
  "checks": { "forbidden_spellings": ["PocketGarden"] }
}
```

| Key | Used by |
|---|---|
| `example` | `true` means the kit's made-up product is still in place: `CLAUDE.md` tells Claude to offer `/hub-setup`, and CI checks the documents match their templates |
| `product.name`, `product.one_line` | every rendered document |
| `owner.git_email` | the `hub-gate` mod: this address writes anything |
| `repos[].prefix` | the id prefixes (`WEB-1`); `next_id`, `inbox`, `specs_check` R13 |
| `repos[].name` | how a session knows which repo it is in (the folder's name); the pick-up lines of inbox notes |
| `repos[].path` | where the repo is on disk, relative to the hub — the fan-out and cross-review read it; `service_init` writes there |
| `ids.cross` | the prefix of cross-repo items, whose triads live in the hub and whose REQs carry owner tags |
| `contributors[].git_email` | the `hub-gate` mod: these addresses get the contributor's write set |
| `checks.forbidden_spellings` | `specs_check` R5 — misspellings of the product name that must not appear in a code repo |

## `specs_check.py` — the rules

| | Rule | Needs the hub |
|---|---|---|
| R1 | a code repo's `specs/` has `mission.md`, `roadmap.md`, `CONVENTIONS.md` and `tech-specs.md` | |
| R2 | every `phase-*/` carries the full triad; **`spec.md` fails** | |
| R3 | every phase dir has a hub roadmap row **carrying a canonical marker** | ✅ |
| R4 | `mission.md` is a pointer, not a document | |
| R5 | no forbidden spelling of the product name outside `specs/archive/`, `backups/`, `.agents/` | ✅ (reads `hub.json`) |
| R6 | the hub roadmap uses only the canonical markers — **outside code spans**, which are quotation | ✅ |
| R8 | a phase the hub calls done has **no unticked boxes it owns** (a box noted *Not counted here —* is another repo's) | ✅ |
| R10 | every relative `.md` link under `specs/` resolves, **anchors included** | |
| R10h | the same for the hub's own documents (`CLAUDE.md`, `README.md`, `.claude/`, `onboarding/`, `tools/`, `docs/`, `templates/`) | hub only |
| R11 | every loose spec at the root of `specs/` is named in `roadmap.md` | |
| R12 | briefs exist in the hub | ✅ |
| R13 | every REQ in a cross-repo triad names an owning repo, and every repo it names has a roadmap row | ✅ |
| R13c | every hub REQ tagged with **this** repo is mentioned somewhere in its `specs/` | ✅ |

R7 (a parked phase has `RUN-HALTED.md`, an awaiting-verdict phase has `VERDICT-DRAFT.md`) is reported, not
enforced. R9 (a verdict gate is never re-run into green) is deliberately **not automated**: it needs git
history, not the working tree, and the script says so rather than pretending to cover it.

Three readings the checker is strict about, because each was wrong once before it was written down:

- **Status comes from a table row whose first cell is the bold id**, from the first marker *by position* in
  the cell to its right. A marker used as a bullet in prose, or a bold id quoted in a note, proves the id
  exists and says nothing about its state.
- **Code is quotation.** A retired marker inside a code span, or a link inside a fenced block, is being
  reported, not used.
- **With `--hub`, a missing roadmap, a missing context tree or an unknown prefix fails.** They are broken
  paths, not reasons to skip — a rename must never read as a green run.

## `inbox.py` — how a note is routed

By its heading, the only part every note has. An id before the first ` — ` names its repo (`▶ API-3 —
inbox` → API; `▶ API-3 / JOB-2 — …` → both; `▶ WEB · API · JOB — inbox` → all); so does a repo's name or a
distinctive word of it, or `Hub`. A parenthesis after "inbox" overrides the ids: `▶ X-1 — inbox (api)`. A
cross-repo id names no repo, so an `X-` note needs the parenthesis — `--check` fails on a heading it cannot
route, and CI runs it.

A pick-up line (`**✅ PICKED UP …**` or `#### ✅ PICKED UP`) closes the note for the repo it names, or for
every addressee if it names none. "only", "open", "partial" or "not picked up" in that line leaves it
**partial**, and the listing quotes the line.

Notes may also live one per file under `.claude/inbox/open/` and `.claude/inbox/closed/`, each opening
with a header block; `inbox.py` reads both places, so a hub that moves its notes out of the roadmap keeps
the same command:

```
---
to: API, JOB        # the receiving repos' prefixes
item: X-1           # the roadmap row the note concerns
from: HUB           # who filed it
kind: inbox         # inbox | fan-out | reading
state: open         # open | partial | closed
filed: 2026-10-02
---
# ▶ X-1 — inbox (api, worker): <what the receiving repo must do>
```

## `render.py` — the templates

`tools/templates/*.md.tmpl` are a tiny Mustache: `{{owner.name}}` looks a value up in `hub.json`;
`{{#repos}} … {{/repos}}` repeats per repo with `{{prefix}}`, `{{name}}`, `{{what}}` in scope;
`{{#example}} … {{/example}}` renders only while the example is in place and `{{^example}} … {{/example}}`
only after. Write `\{{` for a literal `{{`. Derived values: `prefixes`, `prefixes_slash`, `repo_count`,
`cross`, `decision`, `known_issue`, `first_prefix`, `has_contributors`, and `first` / `last` inside a loop.

After `hub_init.py` the documents are yours — edit them directly. The templates stay for
`service_init.py`, which renders `templates/service-repo/` for one repo at a time.
