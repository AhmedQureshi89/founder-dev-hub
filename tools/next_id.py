#!/usr/bin/env python3
"""next_id — the next free roadmap id for a prefix, read from the hub, never guessed.

    python tools/next_id.py <PREFIX> [--hub <hub-path>] [--show]

Prints e.g. `API-4`, one above the highest id mentioned anywhere in the hub. An id is *taken*
if any hub document mentions it — the roadmap, the briefs, the returns, the context documents,
the inbox folder or CLAUDE.md — retired and closed rows included, because ids are never reused.
Sub-ids (`X-3.1`) count toward their integer (`X-3`). `--show` also prints the highest taken id
and the file it was read in.

Reports. Never writes. The `hub-intake` skill calls this and files under what it prints. Two
consequences worth knowing:
- re-running intake on the same text never reuses an id, because the first filing is itself
  a mention;
- a sentence that names an unissued id takes it. Hub documents write `X-<next>` until the id
  is issued, never a real number from memory.

The prefixes are hub.json's: each code repo's prefix, plus the cross-repo, decision and
known-issue prefixes under `ids`.
"""
import argparse
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hubconfig  # noqa: E402

SCAN = (".claude/context", ".claude/briefs", ".claude/returns", ".claude/inbox", "CLAUDE.md")


def mentions(hub, prefix):
    pat = re.compile(r"(?<![A-Za-z0-9])%s-(\d+)(?:\.\d+)?(?![0-9])" % re.escape(prefix))
    best, where = 0, None
    for rel in SCAN:
        path = os.path.join(hub, rel)
        if os.path.isfile(path):
            files = [path]
        elif os.path.isdir(path):
            files = [os.path.join(b, f) for b, _, fs in os.walk(path) for f in fs if f.endswith(".md")]
        else:
            files = []
        for f in files:
            text = io.open(f, encoding="utf-8", errors="replace").read()
            for m in pat.finditer(text):
                n = int(m.group(1))
                if n > best:
                    best, where = n, os.path.relpath(f, hub).replace("\\", "/")
    return best, where


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("prefix", help="a repo prefix from hub.json, or the cross / decision / known-issue prefix")
    ap.add_argument("--hub", default=None, help="the hub root (default: the one this script sits in)")
    ap.add_argument("--show", action="store_true", help="also print the highest taken id and where")
    a = ap.parse_args()

    hub = a.hub or hubconfig.find_hub()
    cfg = hubconfig.load(hub)
    prefix = a.prefix.upper().rstrip("-")
    if prefix not in cfg.all_prefixes:
        sys.exit("unknown prefix %r — hub.json knows %s" % (prefix, ", ".join(cfg.all_prefixes)))
    best, where = mentions(hub, prefix)
    if a.show:
        if where:
            print("highest taken: %s-%d  (read in %s)" % (prefix, best, where))
        else:
            print("highest taken: none — no %s- id is mentioned anywhere in the hub yet" % prefix)
    print("%s-%d" % (prefix, best + 1))


if __name__ == "__main__":
    main()
