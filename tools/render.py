#!/usr/bin/env python3
"""render — write the hub's governed documents from tools/templates/ and hub.json.

    python tools/render.py            # (re)write every rendered file from hub.json
    python tools/render.py --check    # exit 1 if any rendered file differs from its template
    python tools/render.py --list     # which files are rendered, and which only in example mode

The templates are a tiny Mustache: `{{owner.name}}` looks a value up in hub.json (dots walk
into objects); `{{#repos}} … {{/repos}}` repeats its body once per item of a list, with the
item's keys in scope (`{{prefix}}`, `{{name}}`, `{{what}}`); `{{#example}} … {{/example}}` renders
its body when the value is truthy and `{{^example}} … {{/example}}` when it is not. A few derived
values are added: `prefixes` ("WEB, API, JOB"), `prefixes_slash` ("WEB / API / JOB"),
`repo_count`, `cross`, `decision`, `known_issue`, `first_prefix`, `today`, and inside a repo loop
`last` (true on the last item) and `phase_slug`.

Who runs it: `tools/hub_init.py` after it writes hub.json, and the kit's own CI (`--check`) while
hub.json still says `"example": true`, so the shipped example never drifts from its templates.
After your own setup the documents are yours: edit them directly and leave the templates alone
(or edit the template and re-render, if you prefer — both work; `--check` is not run on your hub).
"""
import argparse
import datetime
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hubconfig  # noqa: E402

TEMPLATES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")

# (template under tools/templates/, destination under the hub root)
RENDERED = [
    ("CLAUDE.md.tmpl", "CLAUDE.md"),
    ("constitution.md.tmpl", ".claude/context/constitution.md"),
    ("roadmap.md.tmpl", ".claude/context/roadmap.md"),
    ("open-decisions.md.tmpl", ".claude/context/open-decisions.md"),
    ("history-README.md.tmpl", ".claude/context/history/README.md"),
    ("briefs-README.md.tmpl", ".claude/briefs/README.md"),
    ("returns-README.md.tmpl", ".claude/returns/README.md"),
    ("team-roles.md.tmpl", "onboarding/team-roles.md"),
    ("getting-started.md.tmpl", "onboarding/getting-started.md"),
]
# Written only while hub.json says "example": true; deleted by hub_init when the example goes.
EXAMPLE_ONLY = [
    ("example/brief-x-1.md.tmpl", ".claude/briefs/x-1.md"),
    ("example/phase-x1-requirements.md.tmpl", ".claude/context/phase-x1-reminders-delivered/requirements.md"),
    ("example/phase-x1-specs.md.tmpl", ".claude/context/phase-x1-reminders-delivered/specs.md"),
    ("example/phase-x1-verification.md.tmpl", ".claude/context/phase-x1-reminders-delivered/verification.md"),
]

_SECTION = re.compile(r"\{\{([#^])\s*([\w.]+)\s*\}\}(.*?)\{\{/\s*\2\s*\}\}", re.S)
_VAR = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")


def lookup(stack, dotted):
    for scope in reversed(stack):
        cur = scope
        found = True
        for part in dotted.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                found = False
                break
        if found:
            return cur
    return None


_RAW = "\x00RAW\x00"


def render(text, stack):
    """Render `text` against the scope stack. Write `\\{{` for a literal `{{` (a GitHub Actions
    expression, say); it comes out as `{{`."""
    return _render(text.replace("\\{{", _RAW), stack).replace(_RAW, "{{")


def _render(text, stack):
    def section(m):
        kind, key, body = m.group(1), m.group(2), m.group(3)
        val = lookup(stack, key)
        if kind == "^":
            return _render(body, stack) if not val else ""
        if isinstance(val, list):
            out = []
            for i, item in enumerate(val):
                scope = dict(item) if isinstance(item, dict) else {".": item}
                scope["last"] = i == len(val) - 1
                scope["first"] = i == 0
                out.append(_render(body, stack + [scope]))
            return "".join(out)
        return _render(body, stack) if val else ""

    text = _SECTION.sub(section, text)

    def var(m):
        val = lookup(stack, m.group(1))
        if val is None:
            raise SystemExit("render: {{%s}} is not defined (template needs it; hub.json has no such value)" % m.group(1))
        return str(val)

    return _VAR.sub(var, text)


def context(cfg, extra=None):
    d = dict(cfg.data)
    repos = []
    for r in d.get("repos", []):
        r = dict(r)
        r["phase_slug"] = r["prefix"].lower()
        repos.append(r)
    d["repos"] = repos
    d.update({
        "prefixes": ", ".join(cfg.prefixes),
        "prefixes_slash": " / ".join(cfg.prefixes),
        "repo_count": len(cfg.repos),
        "cross": cfg.cross,
        "decision": cfg.decision,
        "known_issue": cfg.known_issue,
        "first_prefix": cfg.prefixes[0] if cfg.prefixes else "WEB",
        "first_repo": repos[0] if repos else {},
        "has_contributors": bool(cfg.contributors),
        "today": datetime.date.today().isoformat(),
        "example": cfg.example,
    })
    if extra:
        d.update(extra)
    return [d]


def render_file(cfg, tmpl, extra=None):
    path = os.path.join(TEMPLATES, tmpl)
    return render(io.open(path, encoding="utf-8").read(), context(cfg, extra))


def targets(cfg):
    out = list(RENDERED)
    if cfg.example:
        out += EXAMPLE_ONLY
    return out


def write(path, text):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--hub", default=None)
    ap.add_argument("--check", action="store_true", help="compare, write nothing, exit 1 on a difference")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    cfg = hubconfig.load(a.hub or hubconfig.find_hub())

    if a.list:
        for t, dest in RENDERED:
            print("  %-45s ← %s" % (dest, t))
        for t, dest in EXAMPLE_ONLY:
            print("  %-45s ← %s   (example only)" % (dest, t))
        return 0

    stale = []
    for tmpl, dest in targets(cfg):
        text = render_file(cfg, tmpl)
        path = os.path.join(cfg.root, dest)
        if a.check:
            have = io.open(path, encoding="utf-8").read() if os.path.exists(path) else None
            if have != text:
                stale.append(dest)
        else:
            write(path, text)
            print("  wrote %s" % dest)
    if a.check:
        for d in stale:
            print("  ✗ %s differs from its template — run `python tools/render.py`" % d)
        print("  %d rendered file(s) checked, %d stale" % (len(targets(cfg)), len(stale)))
        return 1 if stale else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
