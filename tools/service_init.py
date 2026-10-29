#!/usr/bin/env python3
"""service_init — give one code repo what the hub expects of it: a specs/ folder, a CI job that
runs the checker against the hub, a CLAUDE.md that points here, and the spec-* skills.

    python tools/service_init.py <PREFIX>                  # into the path hub.json gives that repo
    python tools/service_init.py <PREFIX> --out <folder>   # into another folder
    python tools/service_init.py <PREFIX> --force          # overwrite files that already exist

Writes, under the repo:
    CLAUDE.md                        the repo's rules: the hub is the source of truth, specs/ holds build truth
    specs/CONVENTIONS.md             the rules for specs/ — the checker asserts them
    specs/mission.md                 a pointer to the hub's constitution, never a document
    specs/roadmap.md                 this repo's phases, one row each; status lives in the hub
    specs/tech-specs.md              how this service is built (you fill it in)
    .github/workflows/specs-check.yml   runs tools/specs_check.py from the hub on every push and PR
    .claude/skills/spec-*/           spec-phase, spec-next, spec-run, spec-status — the triad and build loop

Existing files are left alone unless --force; the script says which. It never touches git.
"""
import argparse
import io
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hubconfig  # noqa: E402
import render  # noqa: E402

SERVICE_TEMPLATES = os.path.join(os.path.dirname(HERE), "templates", "service-repo")


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("prefix", help="the repo's id prefix in hub.json")
    ap.add_argument("--hub", default=None)
    ap.add_argument("--out", default=None, help="the repo's folder (default: its path in hub.json)")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    cfg = hubconfig.load(a.hub or hubconfig.find_hub())
    repo = cfg.repo(a.prefix)
    if repo is None:
        sys.exit("no repo with prefix %r in hub.json (have %s)" % (a.prefix, ", ".join(cfg.prefixes)))
    out = os.path.abspath(a.out) if a.out else repo.resolve_path(cfg.root)
    if not out:
        sys.exit("hub.json gives no path for %s — pass --out" % repo.prefix)
    os.makedirs(out, exist_ok=True)

    extra = {"repo": {"prefix": repo.prefix, "name": repo.name, "what": repo.what, "github": repo.github,
                      "default_branch": repo.default_branch, "phase_slug": repo.prefix.lower()}}
    written, kept = [], []
    for base, dirs, files in os.walk(SERVICE_TEMPLATES):
        for f in files:
            src = os.path.join(base, f)
            rel = os.path.relpath(src, SERVICE_TEMPLATES).replace("\\", "/")
            dest_rel = rel[:-5] if rel.endswith(".tmpl") else rel
            dest = os.path.join(out, dest_rel)
            if os.path.exists(dest) and not a.force:
                kept.append(dest_rel)
                continue
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if rel.endswith(".tmpl"):
                text = render.render(io.open(src, encoding="utf-8").read(), render.context(cfg, extra))
                with io.open(dest, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(text)
            else:
                shutil.copyfile(src, dest)
            written.append(dest_rel)

    print("\n%s (%s) at %s\n" % (repo.name, repo.prefix, out))
    for w in written:
        print("  wrote %s" % w)
    for k in kept:
        print("  kept  %s (exists; --force to overwrite)" % k)
    print("\nNext: fill in specs/tech-specs.md, commit on a branch, and in the repo's GitHub settings add the\n"
          "secret HUB_TOKEN if the hub is private (a fine-grained token that can read %s)."
          % (cfg.hub_github or "the hub repository"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
