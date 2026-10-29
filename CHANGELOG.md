# Changelog

## 0.1.0 — first public release

The hub as one founder ran it for two months, with everything specific to that product taken out and one
config file, `hub.json`, put in its place.

- **Config:** `hub.json` names the product, the owner, the code repos (prefix, name, path), the id
  prefixes and the contributors; `tools/hubconfig.py` loads and validates it.
- **Tools:** `specs_check.py` (R1–R13c), `next_id.py`, `inbox.py`, `check.py`, `render.py`, `hub_init.py`,
  `service_init.py`. Standard library only, Python 3.9+.
- **Documents, rendered from templates:** `CLAUDE.md`, the constitution, the roadmap, the open decisions,
  the briefs and returns indexes, history, the two onboarding pages.
- **The example:** Pocket Garden — a brief (X-1), a cross-repo triad, a fan-out and cross-review note, an
  inbox note, an open decision, a known issue — all removed by setup.
- **Skills:** `hub-setup`, `hub-tour`, `hub-brief`, `hub-intake`, `hub-fan-out`, `hub-cross-review`,
  `hub-inbox`; the `spec-phase`, `spec-next`, `spec-run`, `spec-status` skills shipped for code repos.
- **Code-repo kit:** `templates/service-repo/` — `CLAUDE.md`, `specs/` (CONVENTIONS, mission pointer,
  roadmap, tech-specs), a CI job that runs the checker against the hub.
- **Mods:** `hub-desk`, `hub-gate`, `phase-progress`, listed in the hub's own marketplace and turned on at
  project scope.
- **Docs:** the README, the walkthrough, the concepts, why the rules exist.
