#!/usr/bin/env python3
"""check — is this hub healthy? Everything the hub's CI runs, in one command.

    python tools/check.py [--hub <path>]

  1. tools/ compiles
  2. hub.json loads and validates
  3. specs_check.py in hub mode: R6 (markers), R10h (links), R13 (REQ owners)
  4. inbox.py --check: every inbox note names its receiving repo
  5. next_id.py resolves every prefix
  6. render.py --check, only while hub.json still says "example": true

Exit 0 when all pass. Reports; never repairs.
"""
import argparse
import os
import py_compile
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hubconfig  # noqa: E402


def run(label, argv, cwd):
    print("── %s" % label)
    code = subprocess.call(argv, cwd=cwd)
    print("   %s\n" % ("✅ ok" if code == 0 else "🔴 failed (exit %d)" % code))
    return code == 0


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--hub", default=None)
    a = ap.parse_args()
    hub = os.path.abspath(a.hub or hubconfig.find_hub())
    py = sys.executable
    ok = True

    print("── tools/ compiles")
    for f in sorted(os.listdir(HERE)):
        if f.endswith(".py"):
            try:
                py_compile.compile(os.path.join(HERE, f), doraise=True)
            except py_compile.PyCompileError as e:
                print("   🔴 %s" % e)
                ok = False
    print("   %s\n" % ("✅ ok" if ok else "🔴 failed"))

    print("── hub.json")
    try:
        cfg = hubconfig.load(hub)
        print("   ✅ %s — %d repo(s): %s\n" % (cfg.hub_name, len(cfg.repos), ", ".join(cfg.prefixes)))
    except SystemExit as e:
        print("   🔴 %s\n" % e)
        return 1

    ok &= run("specs_check (hub mode)", [py, os.path.join(HERE, "specs_check.py"), hub, "--hub", hub], hub)
    ok &= run("inbox --check", [py, os.path.join(HERE, "inbox.py"), "--check", "--hub", hub], hub)
    for p in cfg.all_prefixes:
        ok &= run("next_id %s" % p, [py, os.path.join(HERE, "next_id.py"), p, "--hub", hub, "--show"], hub)
    if cfg.example:
        ok &= run("render --check (the example is current)", [py, os.path.join(HERE, "render.py"), "--check", "--hub", hub], hub)

    print("══ %s" % ("✅ the hub is healthy" if ok else "🔴 something needs attention — read the lines above"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
