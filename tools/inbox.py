#!/usr/bin/env python3
"""inbox — what is waiting on one repo in the hub, in one call.

    python tools/inbox.py <PREFIX|HUB> [--hub <hub-path>] [--all]
    python tools/inbox.py --check [--hub <hub-path>]

Lists the open and partly picked-up `▶ … inbox` notes addressed to that repo, oldest first,
with where each one is, when it was filed and how old it is. `--all` adds the notes already
picked up but not yet moved out. `--check` lists every inbox note whose heading names no
receiving repo — the one shape this script cannot route — and exits 1 if there is any.

Reports. Never writes. It exists so that finding a repo's notes never depends on reading the
whole roadmap: a session asks for its repo's notes and gets them, with their line numbers.

**Where it reads.** Two places, so the command a code repo runs at session start never changes:
- the `### ▶ … inbox` notes in `.claude/context/roadmap.md`;
- one note per file under `.claude/inbox/open/` and `.claude/inbox/closed/`, each opening with a
  header block — `to:` `item:` `from:` `kind:` `state:` `filed:` — see tools/README.md.

**How a roadmap note is routed** — by its heading, the only part every note has:
- an id before the first " — " names its repo: `▶ API-3 — inbox` → API; `▶ API-3 / JOB-2 — …` →
  API and JOB; `▶ WEB · API · JOB — inbox` → all three; a repo's name (`garden-api`) or `Hub`
  likewise;
- a parenthesis after "inbox" overrides it: `▶ X-1 — inbox (api)` → API, `▶ X-1 — inbox (worker)`
  → the repo whose name contains "worker". A note about a cross-repo item names no repo by its
  id, so it needs the parenthesis.
Only notes whose heading says "inbox" are messages. The fan-out records, cross-reviews and other
notes that share the `▶` shape are records, and are not listed.

**When a note is picked up.** A line that opens `#### ✅ PICKED UP` or `**✅ PICKED UP` closes it
for the repo it names (by the repo's name from hub.json), or for every addressee if it names none.
A pick-up whose own line says "only", "open", "partial" or "not picked up" leaves the note
**partial** — read it.
"""
import argparse
import datetime
import glob
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hubconfig  # noqa: E402

INBOX_DIR = (".claude", "inbox")
ANY_NOTE = re.compile(r"^### ▶ ")
END = re.compile(r"^#{2,3} (?!#)")
PICKUP = re.compile(r"^(?:#### |\*\*)✅ PICKED UP")
PARTIAL = re.compile(r"\b(only|open|partial|not picked up)\b", re.I)
FILED = re.compile(r"\*Written (\d{4}-\d{2}-\d{2})")


class Router:
    """Turns a heading's targets into prefixes, using hub.json's repos."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.prefixes = cfg.prefixes
        self.names = {}                                   # lowercase word → prefix
        for r in cfg.repos:
            self.names[r.name.lower()] = r.prefix
            self.names[r.prefix.lower()] = r.prefix
            # the distinctive words of the name route too: `garden-worker` → "worker"
            for word in re.split(r"[-_ ]", r.name.lower()):
                if len(word) > 2 and word not in self.names:
                    self.names[word] = r.prefix
        self.names["hub"] = "HUB"
        self.names[cfg.hub_name.lower()] = "HUB"
        self.heading = re.compile(
            r"^### ▶ (?P<targets>.+?) — (?P<kind>(?:[A-Z][A-Z0-9]*-\d+(?:\.\d+)? )?inbox)"
            r"(?: \((?P<to>[A-Za-z0-9 ,/-]+)\))?(?::\s*(?P<title>.*))?$")
        self.id_re = re.compile(r"^(%s)(?:-\d|$)" % "|".join(re.escape(p) for p in self.prefixes))

    def addressees(self, targets, to):
        if to:
            out = {self.names.get(t.strip().lower()) for t in re.split(r"[,/]| and ", to)}
            return sorted(o for o in out if o)
        out = set()
        for tok in re.split(r"\s*(?:/|·|,|\+)\s*", targets.strip()):
            tok = tok.strip("` *")
            m = self.id_re.match(tok)
            if m:
                out.add(m.group(1))
            elif tok.lower() in self.names:
                out.add(self.names[tok.lower()])
        return sorted(out)

    def repo_names_in(self, line):
        low = line.lower()
        return {r.prefix for r in self.cfg.repos if r.name.lower() in low}


def pickup_state(router, lines, who):
    """('open' | 'partial' | 'picked up', the pick-up line that decided it) for one addressee."""
    state, line = "open", None
    for ln in lines:
        named = router.repo_names_in(ln)
        if named and who not in named:
            continue                       # another repo's pick-up of a shared note
        state, line = ("partial" if PARTIAL.search(ln) else "picked up"), ln
    return state, line


def roadmap_notes(cfg, router):
    path = cfg.roadmap
    if not os.path.exists(path):
        sys.exit("hub roadmap not found at %s — pass --hub" % path)
    lines = io.open(path, encoding="utf-8", errors="replace").read().splitlines()
    notes, i = [], 0
    while i < len(lines):
        if not ANY_NOTE.match(lines[i]):
            i += 1
            continue
        start, head = i, lines[i]
        i += 1
        while i < len(lines) and not END.match(lines[i]):
            i += 1
        body = lines[start + 1:i]
        m = router.heading.match(head)
        if not m:
            continue                       # a record (fan-out, cross-review, reading), not a message
        filed = next((f.group(1) for f in map(FILED.search, body) if f), None)
        picks = [ln for ln in body if PICKUP.match(ln)]
        to = router.addressees(m.group("targets"), m.group("to"))
        decided = {w: pickup_state(router, picks, w) for w in to}
        notes.append({"where": "roadmap.md:%d" % (start + 1), "heading": head[4:],
                      "to": to, "filed": filed,
                      "state": {w: s for w, (s, _) in decided.items()},
                      "pickup": {w: ln for w, (_, ln) in decided.items()}})
    return notes


def folder_notes(cfg):
    """Notes kept one per file under .claude/inbox/{open,closed}/. Absent until someone uses it."""
    out = []
    for sub in ("open", "closed"):
        for f in sorted(glob.glob(os.path.join(cfg.root, *INBOX_DIR, sub, "*.md"))):
            text = io.open(f, encoding="utf-8", errors="replace").read()
            meta = {}
            m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
            if m:
                for ln in m.group(1).splitlines():
                    k, _, v = ln.partition(":")
                    meta[k.strip()] = v.split("#")[0].strip()
            title = next((ln[2:] for ln in text.splitlines() if ln.startswith("# ")),
                         os.path.basename(f))
            to = sorted(t.strip().upper() for t in meta.get("to", "").split(",") if t.strip())
            state = meta.get("state", "closed" if sub == "closed" else "open")
            state = "picked up" if state == "closed" else state
            out.append({"where": os.path.relpath(f, cfg.root).replace("\\", "/"), "heading": title,
                        "to": to, "filed": meta.get("filed"),
                        "state": {w: state for w in to}, "pickup": {}})
    return out


def age(filed, today):
    try:
        return (today - datetime.date.fromisoformat(filed)).days
    except (TypeError, ValueError):
        return None


def main():
    try:  # Windows consoles default to cp1252 and cannot print the markers
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("repo", nargs="?", help="a repo prefix from hub.json, or HUB")
    ap.add_argument("--hub", default=None, help="the hub root (default: the one this script sits in)")
    ap.add_argument("--all", action="store_true", help="also list notes already picked up")
    ap.add_argument("--check", action="store_true", help="exit 1 if a note names no repo")
    a = ap.parse_args()

    cfg = hubconfig.load(a.hub or hubconfig.find_hub())
    router = Router(cfg)
    notes = roadmap_notes(cfg, router) + folder_notes(cfg)

    if a.check:
        bad = [n for n in notes if not n["to"]]
        for n in bad:
            print("✗ names no receiving repo — add one to the heading, e.g. `(%s)`: %s\n    %s"
                  % (cfg.repos[0].prefix.lower() if cfg.repos else "api", n["where"], n["heading"][:120]))
        print("%d inbox note(s) read, %d unroutable" % (len(notes), len(bad)))
        return 1 if bad else 0

    who = (a.repo or "").upper()
    names = dict(cfg.repo_names(), HUB=cfg.hub_name)
    if who not in names:
        ap.error("name a repo: %s or HUB (or use --check)" % ", ".join(cfg.prefixes))
    today = datetime.datetime.now(datetime.timezone.utc).date()
    mine = [n for n in notes if who in n["to"]]
    show = [n for n in mine if a.all or n["state"][who] != "picked up"]
    show.sort(key=lambda n: n["filed"] or "9999")

    mark = {"open": "🔲 open     ", "partial": "🟡 partial  ", "picked up": "✅ picked up"}
    print("Hub inbox for %s (%s) — read %s\n" % (who, names[who], today.isoformat()))
    for n in show:
        d = age(n["filed"], today)
        print("  %s  %-26s filed %s%s" % (mark[n["state"][who]], n["where"], n["filed"] or "?",
                                         " (%d d)" % d if d is not None else ""))
        print("      %s" % n["heading"][:150])
        if n["state"][who] == "partial" and n["pickup"].get(who):
            print("      pick-up so far: %s" % n["pickup"][who].lstrip("#* ")[:150])
    counts = {s: sum(1 for n in mine if n["state"][who] == s) for s in mark}
    print("\n%d open, %d partial%s." % (counts["open"], counts["partial"],
          "" if a.all else "; %d picked up and not yet moved out (--all lists them)"
          % counts["picked up"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
