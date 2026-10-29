#!/usr/bin/env python3
"""specs_check — assert the governance rules against a code repo, or against the hub itself.

Reports. Never repairs. A checker that fixes its own findings destroys the evidence they existed.

    python tools/specs_check.py <code-repo-path> --hub <hub-path> [--prefix API]   # a code repo
    python tools/specs_check.py . --hub .                                          # the hub itself

Exit 0 if every rule passes, 1 otherwise. Without --hub the rules that need the hub's roadmap are
reported as skipped, never silently passed. With --hub, a missing roadmap, a missing context tree
or an unknown repo prefix FAILS: those are broken paths, not reasons to skip.

Rules (the code repo's specs/CONVENTIONS.md states them; this file asserts them):
  R1   specs/ has mission.md, roadmap.md, CONVENTIONS.md and tech-specs.md
  R2   every specs/phase-*/ carries requirements.md, specs.md, verification.md (spec.md fails)
  R3   every phase dir has a hub roadmap row carrying a canonical status marker      (hub)
  R4   mission.md is a pointer to the hub's constitution, not a document
  R5   none of hub.json's `checks.forbidden_spellings` appears outside the exempt folders
  R6   the hub roadmap uses only the canonical markers, outside code spans              (hub)
  R7   informational: which RUN-HALTED.md / VERDICT-DRAFT.md files exist
  R8   a phase the hub calls done has no unticked boxes it owns                         (hub)
  R9   not automated: a verdict gate is never re-run into green (needs git history)
  R10  every relative .md link under specs/ resolves, anchors included
  R10h the same for the hub's own documents                                             (hub only)
  R11  every loose spec at the root of specs/ is named in roadmap.md
  R12  briefs exist in the hub                                                          (hub)
  R13  every REQ in a cross-repo triad names an owning repo that has a roadmap row      (hub)
  R13c every hub REQ tagged with THIS repo is mentioned somewhere in its specs/         (hub)
"""
import argparse
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hubconfig  # noqa: E402

# ── R5: where an old spelling may survive, and why: archives, backups, the rule's own statement
CASING_EXEMPT = ("specs/archive/", "backups/", ".agents/", "node_modules/", "dist/", ".git/",
                 "CONVENTIONS.md", "CLAUDE.md", "hub.json")

# ── R6: the canonical markers (CONVENTIONS.md section 5)
STATUS_MARKERS = ["🔲", "📋", "⏳", "⏸️", "🚦", "✅", "🟢", "🟡", "➖", "⛔"]
NONCANONICAL = {
    "⬜": "use 🔲 (not started) or ➖ (nothing to do)",
    "🛠️": "use ⏳ (in progress)",
    "🔨": "use ⏳ (in progress)",
}

TRIAD = ("requirements.md", "specs.md", "verification.md")
DONE_MARKERS = ("✅", "🟢")

# R8 — an unticked box carrying this marker is not counted against THIS repo's status. An item
# split across repos has its verdict gates copied verbatim into every half's triad, so one repo's
# verification.md can hold gates it cannot measure. The marker is explicit, never inferred: a box
# with no marker counts, and the gate's own text is never edited to carry it (it goes in a note
# underneath the box).
NOT_COUNTED_HERE = "Not counted here —"

_FENCE = re.compile(r"^(`{3,}|~{3,})[^\n]*\n.*?^\1[ \t]*$", re.M | re.S)
_SPAN = re.compile(r"(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)")


def outside_code(text):
    """`text` with fenced blocks and inline code spans removed. Code is quotation: a note that
    quotes a retired marker in a code span is reporting it, not using it."""
    return _SPAN.sub("", _FENCE.sub("", text))


class Report:
    def __init__(self):
        self.fail, self.ok, self.skip = [], [], []

    def failed(self, rule, msg, where=""):
        self.fail.append((rule, msg, where))

    def passed(self, rule, msg):
        self.ok.append((rule, msg))

    def skipped(self, rule, msg):
        self.skip.append((rule, msg))


def read(p):
    return io.open(p, encoding="utf-8", errors="replace").read()


def walk(root, skip_dirs=(".git", "node_modules", "dist", "__pycache__", ".venv"), exclude=None):
    """Walk `root`, skipping build noise and anything under `exclude` (CI checks the hub out INTO
    the repo as `.hub/`; without the exclusion the repo scan would read the hub's own files)."""
    exclude = os.path.abspath(exclude) if exclude else None
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        if exclude and os.path.abspath(base).startswith(exclude):
            dirs[:] = []
            continue
        for f in files:
            yield os.path.join(base, f)


def phase_dirs(specs):
    if not os.path.isdir(specs):
        return []
    return sorted(d for d in os.listdir(specs)
                  if d.startswith("phase-") and os.path.isdir(os.path.join(specs, d)))


# ─────────────────────────────────────────────────────────── repo-only rules

def r1_required_files(repo, specs, r):
    need = ("mission.md", "roadmap.md", "CONVENTIONS.md")
    have_techspec = any(os.path.exists(os.path.join(specs, n)) for n in ("tech-specs.md", "tech-stack.md"))
    missing = [n for n in need if not os.path.exists(os.path.join(specs, n))]
    if not have_techspec:
        missing.append("tech-specs.md")
    if missing:
        r.failed("R1", "specs/ is missing: " + ", ".join(sorted(missing)), "specs/")
    else:
        r.passed("R1", "constitution files present")


def r2_triad(repo, specs, r):
    bad = False
    for d in phase_dirs(specs):
        p = os.path.join(specs, d)
        files = set(os.listdir(p))
        if "spec.md" in files:
            r.failed("R2", "%s/spec.md is singular — a checker globbing specs.md skips it SILENTLY" % d,
                     "specs/%s/spec.md" % d)
            bad = True
        for t in TRIAD:
            if t not in files:
                r.failed("R2", "%s is missing %s" % (d, t), "specs/%s/" % d)
                bad = True
    if not bad:
        r.passed("R2", "%d phase dirs carry the full triad" % len(phase_dirs(specs)))


def r4_mission_is_pointer(repo, specs, cfg, r):
    p = os.path.join(specs, "mission.md")
    if not os.path.exists(p):
        return
    s = read(p)
    lines = len(s.splitlines())
    headings = ["Target Audience", "Audience", "Business Model", "Pricing", "Guiding Principles",
                "Binding Principles", "Success Metrics", "Core Product Pillars"]
    if cfg is not None:
        headings.append("What %s Is NOT" % cfg.product_name)
    restates = [w for w in headings if re.search(r"^#{1,4}\s*[\d.]*\s*%s" % re.escape(w), s, re.M | re.I)]
    if restates or lines > 60:
        r.failed("R4", "mission.md is still a document (%d lines%s) — it must be a pointer to the "
                       "hub's constitution" % (lines, "; restates " + ", ".join(restates) if restates else ""),
                 "specs/mission.md")
    else:
        r.passed("R4", "mission.md is a pointer (%d lines)" % lines)


def r5_forbidden_spellings(repo, hub, cfg, r):
    words = cfg.forbidden_spellings if cfg else []
    if not words:
        r.passed("R5", "no forbidden spellings configured (hub.json checks.forbidden_spellings)")
        return
    hits = []
    for f in walk(repo, exclude=hub):
        rel = os.path.relpath(f, repo).replace("\\", "/")
        if any(x in rel or rel.startswith(x) for x in CASING_EXEMPT):
            continue
        if not f.lower().endswith((".md", ".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".sh", ".ps1",
                                   ".yml", ".yaml", ".html", ".css", ".txt")):
            continue
        try:
            s = read(f)
        except Exception:
            continue
        for w in words:
            n = s.count(w)
            if n:
                hits.append((rel, w, n))
    if hits:
        for rel, w, n in sorted(hits):
            r.failed("R5", "%d× %r — the product is written %r (constitution)" % (n, w, cfg.product_name), rel)
    else:
        r.passed("R5", "none of the %d forbidden spellings outside the exempt set" % len(words))


def r7_state_files(repo, specs, r):
    have = []
    for d in phase_dirs(specs):
        files = set(os.listdir(os.path.join(specs, d)))
        if "RUN-HALTED.md" in files or "VERDICT-DRAFT.md" in files:
            have.append(d)
    r.passed("R7", "state files present in: %s" % (", ".join(have) or "none"))


def _heading_keys(path):
    """Heading keys for anchor matching, compared on alphanumerics only. Emulating the host's
    slug rule exactly produces false positives; an anchor is reported broken only when no heading
    could plausibly be meant."""
    keys = set()
    for h in re.findall(r"^#{1,6}\s+(.*?)\s*$", read(path), re.M):
        keys.add(re.sub(r"[^0-9a-z؀-ۿ]", "", h.lower()))
    return keys


def _check_links(f, text, rel, rule, r, exempt=()):
    """The two halves of a link check on one file: the target exists, and its anchor names a
    heading. Returns (dead, used_exemptions)."""
    base = os.path.dirname(f)
    dead, used = 0, set()
    for m in re.finditer(r"\]\((?!https?:|file:|#|mailto:)([^)\s]+\.md)", text):
        target = m.group(1).split("#")[0]
        # normpath folds "../.." first: on Windows an unfolded path past 260 characters reads as missing
        if os.path.exists(os.path.normpath(os.path.join(base, target))):
            continue
        if target in exempt:
            used.add(target)
            continue
        r.failed(rule, "dead link → %s" % target, rel)
        dead += 1
    for m in re.finditer(r"\]\((?!https?:|file:|mailto:)([^)\s#]*)#([^)\s]+)\)", text):
        target, frag = m.group(1), m.group(2)
        path = f if not target else os.path.normpath(os.path.join(base, target))
        if not path.lower().endswith(".md") or not os.path.exists(path):
            continue
        key = re.sub(r"[^0-9a-z؀-ۿ]", "", frag.lower())
        if key and key not in _heading_keys(path):
            r.failed(rule, "anchor names no heading → %s#%s" % (target or "(this file)", frag), rel)
            dead += 1
    return dead, used


def r10_links(repo, specs, r):
    dead = 0
    for f in walk(specs):
        if not f.endswith(".md"):
            continue
        rel = os.path.relpath(f, repo).replace("\\", "/")
        d, _ = _check_links(f, read(f), rel, "R10", r)
        dead += d
    if not dead:
        r.passed("R10", "every relative .md link resolves, anchors included")


# ── R10h: R10 for the hub's own documents. Code is skipped (outside_code): a proposal quoted in a
# fence carries links that resolve where it is proposed, not where it is quoted.
# templates/service-repo/ is left out on purpose: its files land in a code repo, and their links resolve
# there (R10 checks them in that repo), not here.
HUB_LINK_ROOTS = (".claude/context", ".claude/briefs", ".claude/returns", ".claude/skills", ".claude/mods",
                  "onboarding", "tools", "docs")
HUB_LINK_FILES = ("CLAUDE.md", "README.md")
# Deliberate dead links, each with its reason: {"path/in/hub.md": ({"target.md", ...}, "why")}.
# A link listed here that is no longer dead is reported too, so the list cannot outlive what it excuses.
HUB_LINK_EXEMPT = {}


def r10h_hub_links(hub, r):
    files = [os.path.join(hub, f) for f in HUB_LINK_FILES if os.path.exists(os.path.join(hub, f))]
    for root in HUB_LINK_ROOTS:
        files += [f for f in walk(os.path.join(hub, root)) if f.endswith(".md")]
    dead, used = 0, set()
    for f in sorted(files):
        rel = os.path.relpath(f, hub).replace("\\", "/")
        exempt = HUB_LINK_EXEMPT.get(rel, (set(), ""))[0]
        d, u = _check_links(f, outside_code(read(f)), rel, "R10h", r, exempt)
        dead += d
        used.update((rel, t) for t in u)
    stale = [(rel, t) for rel, (targets, _) in HUB_LINK_EXEMPT.items() for t in targets if (rel, t) not in used]
    for rel, t in sorted(stale):
        r.failed("R10h", "HUB_LINK_EXEMPT excuses a link that is no longer dead or no longer there → %s "
                         "— remove it from the list" % t, rel)
    if not dead and not stale:
        r.passed("R10h", "every relative .md link in the hub's documents resolves, anchors included "
                         "(%d files; %d deliberate exceptions)" % (len(files), len(used)))


def r11_loose_files(repo, specs, r):
    road = os.path.join(specs, "roadmap.md")
    if not os.path.exists(road):
        return
    text = read(road)
    known = {"mission.md", "roadmap.md", "tech-specs.md", "tech-stack.md", "CONVENTIONS.md", "README.md"}
    orphans = [n for n in sorted(os.listdir(specs))
               if n.endswith(".md") and n not in known and n not in text]
    for n in orphans:
        r.failed("R11", "loose spec is not named in roadmap.md — CONVENTIONS §6 requires it be explained",
                 "specs/" + n)
    if not orphans:
        r.passed("R11", "every loose spec is accounted for in roadmap.md")


# ─────────────────────────────────────────────────────────── hub-dependent

# ⛔ Retired is terminal by the owner's ruling and is NOT a done marker: R8 must not read a retired
# phase's unticked boxes as a defect — they record what was verified while the phase was live.
ALL_MARKERS = DONE_MARKERS + ("🔲", "⏳", "⏸️", "📋", "🟡", "🚦", "➖", "⛔")


def _first_marker(text):
    """The earliest marker by POSITION in `text`, or None — not the first in vocabulary order,
    which differs whenever a cell uses a marker as an inline bullet."""
    best, at = None, len(text) + 1
    for mk in ALL_MARKERS:
        i = text.find(mk)
        if i != -1 and i < at:
            best, at = mk, i
    return best


def hub_status(hub_road, prefix):
    """(seen, status) — every id of `prefix` mentioned in the roadmap, and the status of those
    whose row sets one.

    Status comes from a TABLE ROW whose first non-empty cell IS the bold id (`**API-6**`,
    `**API-6/7**`, `**API-6 / API-7**`), from the first cell to its right that carries a marker,
    first marker by position. A bold mention anywhere else — prose, a note, another cell — proves
    the id exists and says nothing about its state. An id present with no marker, and an id absent
    from the hub, are two different failures and are reported as such.
    """
    seen, status = set(), {}
    num = r"[0-9][0-9.A-Z]*"
    id_re = re.compile(r"\*\*(%s-%s(?:\s*/\s*(?:%s-)?%s)*)\*\*" % (re.escape(prefix), num, re.escape(prefix), num))
    strip = re.compile(r"^%s-" % re.escape(prefix))

    def parts(cell_id):                    # "API-6 / API-7" -> ["6", "7"]; "API-6/7" -> ["6", "7"]
        return [strip.sub("", p.strip()) for p in cell_id.split("/")]

    for line in hub_road.splitlines():
        ids = id_re.findall(line)
        if not ids:
            continue
        for cell_id in ids:
            seen.update(parts(cell_id))
        if not line.lstrip().startswith("|"):
            continue                       # prose: names the id, never sets its state
        cells = [c.strip() for c in line.split("|")]
        first = next((c for c in cells if c), "")
        m = id_re.fullmatch(first)
        if m is None:
            continue
        idx = cells.index(first)
        for c in cells[idx + 1:]:
            mk = _first_marker(c)
            if mk:
                for n in parts(m.group(1)):
                    status.setdefault(n, mk)
                break
    return seen, status


def r3_r8_against_hub(repo, specs, cfg, prefix, r):
    hub_road = cfg.roadmap
    if not os.path.exists(hub_road):
        r.failed("R3/R8", "hub roadmap not found — --hub was given, so a missing roadmap is a broken path, "
                          "not a skip", hub_road)
        return
    seen, status = hub_status(read(hub_road), prefix)
    if not seen and phase_dirs(specs):
        r.failed("R3/R8", "no bold %s- id anywhere in the hub roadmap — a wrong --prefix, or the roadmap's "
                          "id format changed" % prefix, hub_road)
        return

    missing, unmarked = [], []
    for d in phase_dirs(specs):
        num = d[len("phase-"):]
        if num not in seen:
            missing.append(num)
        elif num not in status:
            unmarked.append(num)
    for num in missing:
        r.failed("R3", "no %s-%s row in the hub roadmap" % (prefix, num), "specs/phase-%s/" % num)
    for num in unmarked:
        r.failed("R3", "%s-%s is in the hub but carries no status marker CONVENTIONS §5 defines" % (prefix, num),
                 "roadmap.md (hub)")
    if not missing and not unmarked:
        r.passed("R3", "every phase dir has a hub row with a canonical marker")

    bad = False
    for d in phase_dirs(specs):
        num = d[len("phase-"):]
        mk = status.get(num)
        if mk not in DONE_MARKERS:
            continue
        v = os.path.join(specs, d, "verification.md")
        if not os.path.exists(v):
            continue
        body = read(v)
        # each unticked box owns the text up to the next top-level bullet or heading; the waiver is
        # looked for in THAT block, so one box's note never excuses another's
        blocks = re.split(r"^(?=- \[[ x]\])", body, flags=re.M)
        un, waived = 0, 0
        for b in blocks:
            if not re.match(r"^- \[ \]", b):
                continue
            if NOT_COUNTED_HERE in b:
                waived += 1
            else:
                un += 1
        if un:
            r.failed("R8", "hub says %s-%s is %s, but verification.md has %d unticked it owns" % (prefix, num, mk, un),
                     "specs/%s/verification.md" % d)
            bad = True
        elif waived:
            r.passed("R8", "%s-%s: every box it owns is ticked; %d waived as another repo's" % (prefix, num, waived))
    if not bad:
        r.passed("R8", "no phase the hub calls done has unticked checks it owns")


def r12_brief_link(cfg, r):
    briefs = os.path.join(cfg.root, ".claude", "briefs")
    if not os.path.isdir(briefs):
        r.skipped("R12", "no briefs directory in the hub")
        return
    ids = [os.path.splitext(f)[0] for f in os.listdir(briefs) if f.endswith(".md") and f != "README.md"]
    if not ids:
        r.skipped("R12", "no briefs written yet")
        return
    r.passed("R12", "%d brief(s) exist; triads predating briefs are exempt" % len(ids))


def r6_hub_status_vocabulary(cfg, r):
    hub_road = cfg.roadmap
    if not os.path.exists(hub_road):
        r.failed("R6", "hub roadmap not found — --hub was given, so a missing roadmap is a broken path, not a skip",
                 hub_road)
        return
    s = outside_code(read(hub_road))
    found = {m: s.count(m) for m in NONCANONICAL if m in s}
    if found:
        for m, n in sorted(found.items()):
            r.failed("R6", "%d× '%s' is not in the CONVENTIONS §5 set — %s (to quote one, put it in a code span)"
                     % (n, m, NONCANONICAL[m]), "roadmap.md (hub)")
    else:
        r.passed("R6", "only canonical status markers in the hub roadmap, outside code spans")


# ─────────────────────────────────── rule 13: every REQ names an owning repo

REQ_DEF = re.compile(r"^\*\*(REQ-[A-Za-z0-9.]+?)\s*(?:·\s*([A-Z0-9+]+)\s*)?—", re.M)


def item_id_re(cfg):
    alts = "|".join(re.escape(p) for p in cfg.prefixes + [cfg.cross])
    return re.compile(r"^#\s+((?:%s)-[0-9][0-9.]*)\b" % alts)


def hub_triads(cfg):
    """(item_id, path) for every requirements.md under the hub's context tree, at any depth. The
    item id is read from the document's own H1, not its folder name."""
    ctx = os.path.dirname(cfg.roadmap)
    pat = item_id_re(cfg)
    out = []
    for base, dirs, files in os.walk(ctx):
        dirs.sort()
        if "requirements.md" in files and os.path.abspath(base) != os.path.abspath(ctx):
            req = os.path.join(base, "requirements.md")
            m = pat.search(read(req))
            out.append((m.group(1) if m else None, req))
    return sorted(out, key=lambda t: t[1])


def _names_item(line, item):
    """`item` appears in `line` as a whole id: "X-1" is not found in "X-11" or "X-1.2"."""
    return re.search(r"(?<![A-Za-z0-9.-])%s(?![0-9]|\.[0-9])" % re.escape(item), line) is not None


def _is_row_of(line, item):
    if not line.lstrip().startswith("|"):
        return False
    first = next((c.strip() for c in line.split("|") if c.strip()), "")
    return first == "**%s**" % item


def r13_req_ownership(cfg, r):
    """R13 — the mechanical half of intake's second check: tag every REQ with a repo, then count;
    one or more REQs earns a roadmap row. Only cross-repo items are checked: a single-repo triad's
    REQs belong to that repo by construction. R13 proves an owner was RECORDED, never that the
    owner is RIGHT — that is the fan-out's job."""
    hub_road = cfg.roadmap
    triads = hub_triads(cfg)
    if not triads:
        if os.path.isdir(os.path.dirname(hub_road)):
            r.skipped("R13", "no requirements.md under the hub's context tree")
        else:
            r.failed("R13", "the hub's context tree is not there — --hub was given, so this is a broken path, "
                            "not a skip", os.path.dirname(hub_road))
        return
    if not os.path.exists(hub_road):
        r.failed("R13", "hub roadmap not found — the row half of the rule cannot run", hub_road)
        return
    road = read(hub_road)
    table = [ln for ln in road.splitlines() if ln.lstrip().startswith("|")]
    prefixes = cfg.prefixes
    cross = cfg.cross + "-"
    bad = False
    crossing = 0

    for item, path in triads:
        rel = os.path.relpath(path, cfg.root).replace("\\", "/")
        if item is None:
            r.failed("R13", "the H1 declares no prefixed item id — write `# X-1 — <title>` (a bare 'Phase 3' "
                            "means a different thing in every repo)", rel)
            bad = True
            continue
        if not item.startswith(cross):
            continue
        crossing += 1
        owners = set()
        for req, tags in REQ_DEF.findall(read(path)):
            if not tags:
                r.failed("R13", "%s names no owning repo — write `**%s · %s — ...**` (a prefix from hub.json, "
                                "several joined with +, or HUB)" % (req, req, prefixes[0] if prefixes else "WEB"), rel)
                bad = True
                continue
            parts = [t for t in tags.split("+") if t]
            unknown = [t for t in parts if t not in prefixes and t != "HUB"]
            if unknown:
                r.failed("R13", "%s is tagged '%s' — not a repo prefix (%s, or HUB)"
                         % (req, ",".join(unknown), "/".join(prefixes)), rel)
                bad = True
            owners.update(t for t in parts if t in prefixes)
            if "HUB" in parts and not any(_is_row_of(ln, item) for ln in table):
                r.failed("R13", "%s is tagged HUB and the roadmap has no %s row" % (req, item), "roadmap.md (hub)")
                bad = True
        for pref in sorted(owners):
            rows = [ln for ln in table
                    if re.search(r"\*\*%s-[0-9][0-9.]*\*\*" % re.escape(pref), ln) and _names_item(ln, item)]
            if not rows:
                r.failed("R13", "%s REQs are tagged %s, but no %s- row in the roadmap names %s — a requirement "
                                "with no owning row is how work goes missing" % (item, pref, pref, item),
                         "roadmap.md (hub)")
                bad = True

    if not bad:
        r.passed("R13", "every cross-repo REQ names a repo, and every repo named has a row (%d triads read, "
                        "%d cross-repo)" % (len(triads), crossing))


def r13c_picked_up(repo, specs, cfg, prefix, r):
    """R13c — the repo side: this repo's specs actually name the REQs tagged to it."""
    missing = []
    cross = cfg.cross + "-"
    for item, path in hub_triads(cfg):
        if not item or not item.startswith(cross):
            continue
        for req, tags in REQ_DEF.findall(read(path)):
            if prefix not in (tags or "").split("+"):
                continue
            if not any(f.endswith(".md") and req in read(f) for f in walk(specs)):
                missing.append((item, req))
    for item, req in missing:
        r.failed("R13c", "%s is tagged %s in the hub and no file under specs/ names it" % (req, prefix), "specs/")
    if not missing:
        r.passed("R13c", "every hub REQ tagged %s is named in this repo's specs" % prefix)


# ─────────────────────────────────────────────────────────── main

def report(r, name):
    print("\n%s — specs-check\n" % name)
    for rule, msg, where in r.fail:
        print("  ✗ %-4s %s" % (rule, msg))
        if where:
            print("       %s" % where)
    for rule, msg in r.ok:
        print("  ✓ %-4s %s" % (rule, msg))
    for rule, msg in r.skip:
        print("  — %-4s skipped: %s" % (rule, msg))
    print("\n  %d passed, %d failed, %d skipped\n" % (len(r.ok), len(r.fail), len(r.skip)))
    return 1 if r.fail else 0


def main():
    try:  # Windows consoles default to cp1252 and cannot print the markers
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("repo", help="a code repo's path, or the hub's own path")
    ap.add_argument("--hub", default=None, help="the hub's path (the folder holding hub.json)")
    ap.add_argument("--prefix", default=None, help="this repo's id prefix from hub.json; inferred from the folder name")
    a = ap.parse_args()

    repo = os.path.abspath(a.repo)
    specs = os.path.join(repo, "specs")
    name = os.path.basename(repo)
    cfg = hubconfig.load(a.hub) if a.hub else None
    prefix = (a.prefix or "").upper() or (cfg.prefix_for_folder(repo) if cfg else None)

    r = Report()
    hub_only = not os.path.isdir(specs)
    if hub_only and not a.hub:
        print("%s — no specs/ directory and no --hub. Nothing to check." % name)
        return 0
    if hub_only:
        r6_hub_status_vocabulary(cfg, r)
        r10h_hub_links(cfg.root, r)
        r13_req_ownership(cfg, r)
        return report(r, name)

    r1_required_files(repo, specs, r)
    r2_triad(repo, specs, r)
    r4_mission_is_pointer(repo, specs, cfg, r)
    r5_forbidden_spellings(repo, a.hub, cfg, r)
    r7_state_files(repo, specs, r)
    r10_links(repo, specs, r)
    r11_loose_files(repo, specs, r)

    if cfg:
        if prefix and prefix not in cfg.prefixes:
            r.failed("R3/R8/R13c", "--prefix %s is not a repo prefix in hub.json (%s)" % (prefix, ", ".join(cfg.prefixes)))
            prefix = None
        if prefix:
            r3_r8_against_hub(repo, specs, cfg, prefix, r)
        r12_brief_link(cfg, r)
        r6_hub_status_vocabulary(cfg, r)
        r13_req_ownership(cfg, r)
        if prefix:
            r13c_picked_up(repo, specs, cfg, prefix, r)
        else:
            r.failed("R3/R8/R13c", "--hub was given but this repo's prefix is unknown (folder '%s' is not a repo "
                                   "name in hub.json) — pass --prefix %s" % (name, " / ".join(cfg.prefixes)))
    else:
        r.skipped("R3/R6/R8/R12/R13", "no --hub given")
    r.skipped("R9", "gate re-runs need git history, not the working tree — not automated")

    return report(r, name)


if __name__ == "__main__":
    sys.exit(main())
