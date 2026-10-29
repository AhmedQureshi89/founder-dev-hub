# Hub skills — the workflow, step by step, and what is built

A brief becomes work in one or more code repos through eight steps, with a set-up step before the
first. Each step is either a skill in this directory, a skill shipped with the code-repo template,
or a procedure done by hand with a check behind it. This file is the map; it is not the rules —
those are in the hub's `CLAUDE.md` and in each skill.

Everything here reads `hub.json` at the hub's root for the product, the owner, the repos and their
prefixes. The worked examples use the kit's example product, Pocket Garden — owner Sam, repos
`WEB` (`garden-web`), `API` (`garden-api`), `JOB` (`garden-worker`).

| Step | What it does | State | Where |
|---|---|---|---|
| ⓪ setup | first run: write `hub.json`, the context documents, the indexes and the checks for a new product | ✅ built | [`hub-setup/`](hub-setup/SKILL.md) |
| ① brief | write a brief by interview — problem, evidence as re-runnable queries, success metric, non-goals, who is affected, verdict gates — in the shape intake expects | ✅ built | [`hub-brief/`](hub-brief/SKILL.md) |
| ② intake | issue an id, file the text verbatim, index it, commit — before any work | ✅ built | [`hub-intake/`](hub-intake/SKILL.md) · `tools/next_id.py` |
| ③ fan-out | one subagent per repo in `hub.json`, each reading only its own tree: *which REQs are mine?*; the note in the fixed shape; round two as adjudication; hand-off to ④ | ✅ built | [`hub-fan-out/`](hub-fan-out/SKILL.md) · its [templates](hub-fan-out/references/templates.md) and [why](hub-fan-out/references/why.md) |
| ④ cross-review | challenge every "not my repo" before it is believed; verdict per repo | ✅ built | [`hub-cross-review/`](hub-cross-review/SKILL.md) |
| ⑤ roadmap rows and REQ tags | tag each REQ with its owning repo on its definition line (`**REQ-X1.4 · API+JOB — …**`); one REQ earns a half-row | 🔲 manual — `tools/specs_check.py` R13 (a REQ with no tag, a tag with no row) and R13c (a tagged REQ a code repo's `specs/` never mentions) check the result | the hub's `CLAUDE.md` §Briefs |
| ⑥ triad | `requirements.md` · `specs.md` · `verification.md` for the phase, in the code repo's `specs/phase-N/`, gates copied verbatim | ✅ built — a code-repo skill | `spec-phase`, shipped in `templates/service-repo/.claude/skills/` |
| ⑦ build | one REQ per session: write it, run its gate, tick the box, commit, stop — or run the phase through | ✅ built — code-repo skills | `spec-next` · `spec-run`, shipped beside `spec-phase` |
| ⑧ status write-back | the roadmap row and the brief's header updated on close — never the briefs index; a return's one mark in `.claude/returns/README.md` set once, when it is ruled | 🔲 manual | the `▶ Where <ID> is` board in each triad's `verification.md` |

Also here, outside the numbered flow:

- [`hub-inbox/`](hub-inbox/SKILL.md) — the cross-repo protocol as a procedure: file a
  `▶ <ID> — inbox` note for the repo that must act, ring a live session, pick a note up and close it
  with `✅ PICKED UP`. `python tools/inbox.py <PREFIX|HUB>` lists what is waiting on a repo; its
  [why](hub-inbox/references/why.md) holds the incidents behind each rule.
- [`hub-tour/`](hub-tour/SKILL.md) — a walk through the example hub, Pocket Garden, from the brief
  to the ticked box.

```
  owner ──► ⓪ setup ──► ① brief ──► ② intake ──► ③ fan-out ──► ④ cross-review ──► ⑤ rows ──► ⑥ triad ──► ⑦ build ──► ⑧ close
              ✅          ✅          ✅           ✅            ✅                 🔲         ✅           ✅          🔲
                                       hub ─────────────────────────────────────────┘ └──── code repo ────────┘ hub
```

The hub holds steps ② to ⑤ and ⑧; steps ⑥ and ⑦ happen in the code repo that owns the REQs, with
the hub's skills reading its tree and never writing it. `hub-inbox` is how the two sides talk when
one finds something the other must act on.

What CI runs, from the hub root: `python tools/check.py` — which includes
`python tools/specs_check.py . --hub .` and `python tools/inbox.py --check`. The `hub-gate` mod
holds `git commit` and `git push` until that is green.
