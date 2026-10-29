#!/usr/bin/env python3
"""hub_init — make this hub yours: write hub.json from your answers and render the documents.

    python tools/hub_init.py                       # ask the questions in the terminal
    python tools/hub_init.py --answers my.json      # the same answers from a file (no questions)
    python tools/hub_init.py --from-hub             # hub.json is already yours: just re-render

What it does, in order:
  1. collects the product, the owner, the hub repo and each code repo (prefix, name, what it is,
     GitHub path, local path) — or reads them from --answers;
  2. writes hub.json with "example": false;
  3. renders CLAUDE.md, the constitution, the roadmap, the open decisions, the two indexes and
     the onboarding pages from tools/templates/;
  4. deletes the example brief and the example triad (they belong to the made-up product);
  5. runs the checker, so you start green.

It never touches git. Commit when you have read what it wrote. The `/hub-setup` skill runs this
conversationally from Claude Code; this is the same setup from a terminal.

The --answers file has the shape of hub.json minus `kit`, `example` and `checks`. Any key you
leave out gets a sensible default (default branch `main`, no contributors).
"""
import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hubconfig  # noqa: E402
import render  # noqa: E402

KIT = {"name": "founder-dev-hub", "version": "0.1.0"}


def ask(prompt, default=None, required=True, check=None):
    while True:
        shown = " [%s]" % default if default else ""
        try:
            v = input("  %s%s: " % (prompt, shown)).strip()
        except EOFError:
            v = ""
        if not v and default:
            v = default
        if not v and required:
            print("    (needed — try again)")
            continue
        if v and check and not check(v):
            continue
        return v


def is_prefix(v):
    if hubconfig.PREFIX_RE.match(v):
        return True
    print("    a prefix is 1-6 capitals or digits, starting with a capital: WEB, API, JOB, IOS")
    return False


def is_email(v):
    if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
        return True
    print("    that does not look like an email address")
    return False


def interview():
    print("\nLet's set up your hub. Enter accepts the value in [brackets]. Nothing is sent anywhere.\n")
    print("— The product —")
    product = ask("Product name (as customers see it)")
    one_line = ask("What it is, in one line (\"a web platform that …\")")
    print("\n— You, the owner —")
    owner = ask("Your name")
    owner_gh = ask("Your GitHub user name", required=False)
    owner_email = ask("The email your git commits carry (git config user.email)", check=is_email)
    print("\n— This hub repo —")
    slug = re.sub(r"[^a-z0-9]+", "-", product.lower()).strip("-")
    hub_name = ask("This repo's name", default="%s-hub" % slug)
    hub_gh = ask("Its GitHub path (user/repo)", default=("%s/%s" % (owner_gh, hub_name)) if owner_gh else None,
                 required=False)
    print("\n— Your code repos — one per line of work: the web app, the API, a worker, a mobile app…")
    print("  Each gets a short prefix for its ids (WEB-1, API-7). Leave the name empty to stop.")
    repos, used = [], set()
    n = 0
    while True:
        n += 1
        name = ask("Repo %d name (as the folder is called)" % n, required=False)
        if not name:
            if repos:
                break
            print("    at least one repo is needed")
            n -= 1
            continue
        # `shop-web` → WEB, `garden-worker` → WOR; a one-word name takes its first three letters
        words = [w for w in re.split(r"[-_ .]+", name.upper()) if w]
        guess = re.sub(r"[^A-Z0-9]", "", (words[-1] if len(words) > 1 else (words[0] if words else "APP")))[:3] or "APP"
        while guess in used:
            guess = guess[:2] + str(n)
        prefix = ask("  its id prefix", default=guess, check=lambda v: is_prefix(v) and v not in used)
        used.add(prefix)
        what = ask("  what it is, in a few words (\"the web app people use\")")
        gh = ask("  its GitHub path (user/repo)", default=("%s/%s" % (owner_gh, name)) if owner_gh else None,
                 required=False)
        path = ask("  where it is cloned, relative to this hub", default="../%s" % name)
        repos.append({"prefix": prefix, "name": name, "what": what, "github": gh, "path": path,
                      "default_branch": "main"})
    print("\n— Anyone else who writes code? (a contractor, a friend, an intern) — Enter to skip —")
    contributors = []
    while True:
        cname = ask("Contributor name", required=False)
        if not cname:
            break
        cemail = ask("  the email their git commits carry", check=is_email)
        cgh = ask("  their GitHub user name", required=False)
        first = re.sub(r"[^a-z0-9]+", "", cname.lower().split()[0]) or "contrib"
        contributors.append({"name": cname, "github": cgh, "git_email": cemail, "branch_prefix": first + "/"})
    return {
        "product": {"name": product, "one_line": one_line},
        "owner": {"name": owner, "github": owner_gh, "git_email": owner_email},
        "hub": {"name": hub_name, "github": hub_gh, "default_branch": "main"},
        "repos": repos,
        "contributors": contributors,
    }


def complete(answers):
    """The answers as a full hub.json document."""
    d = {"kit": KIT, "example": False}
    d["product"] = {"name": answers["product"]["name"], "one_line": answers["product"].get("one_line", "")}
    d["owner"] = {"name": answers["owner"]["name"], "github": answers["owner"].get("github", ""),
                  "git_email": answers["owner"]["git_email"]}
    h = answers.get("hub", {})
    d["hub"] = {"name": h.get("name") or re.sub(r"[^a-z0-9]+", "-", d["product"]["name"].lower()).strip("-") + "-hub",
                "github": h.get("github", ""), "default_branch": h.get("default_branch", "main")}
    d["repos"] = []
    for r in answers["repos"]:
        d["repos"].append({"prefix": r["prefix"], "name": r["name"], "what": r.get("what", ""),
                           "github": r.get("github", ""), "path": r.get("path", "../%s" % r["name"]),
                           "default_branch": r.get("default_branch", "main")})
    d["ids"] = answers.get("ids", {"cross": "X", "decision": "D", "known_issue": "KI"})
    d["contributors"] = answers.get("contributors", [])
    d["checks"] = {"forbidden_spellings": answers.get("checks", {}).get("forbidden_spellings", [])}
    hubconfig.validate(d)
    return d


def dump(d):
    """hub.json, one repo per line, readable when diffed."""
    out = ["{"]
    out.append('  "kit": %s,' % json.dumps(d["kit"]))
    out.append('  "example": %s,' % json.dumps(d["example"]))
    out.append('  "product": {\n    "name": %s,\n    "one_line": %s\n  },'
               % (json.dumps(d["product"]["name"], ensure_ascii=False),
                  json.dumps(d["product"]["one_line"], ensure_ascii=False)))
    out.append('  "owner": %s,' % json.dumps(d["owner"], ensure_ascii=False))
    out.append('  "hub": %s,' % json.dumps(d["hub"], ensure_ascii=False))
    out.append('  "repos": [')
    for i, r in enumerate(d["repos"]):
        out.append("    %s%s" % (json.dumps(r, ensure_ascii=False), "," if i < len(d["repos"]) - 1 else ""))
    out.append("  ],")
    out.append('  "ids": %s,' % json.dumps(d["ids"]))
    out.append('  "contributors": [')
    for i, c in enumerate(d["contributors"]):
        out.append("    %s%s" % (json.dumps(c, ensure_ascii=False), "," if i < len(d["contributors"]) - 1 else ""))
    out.append("  ],")
    out.append('  "checks": %s' % json.dumps(d["checks"], ensure_ascii=False))
    out.append("}")
    return "\n".join(out) + "\n"


def remove_example(hub):
    gone = []
    for _, dest in render.EXAMPLE_ONLY:
        p = os.path.join(hub, dest)
        if os.path.isfile(p):
            os.remove(p)
            gone.append(dest)
    for _, dest in render.EXAMPLE_ONLY:
        d = os.path.dirname(os.path.join(hub, dest))
        if os.path.isdir(d) and not os.listdir(d):
            shutil.rmtree(d)
    return gone


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--hub", default=None, help="the hub root (default: the one this script sits in)")
    ap.add_argument("--answers", default=None, help="a JSON file with the answers (no questions asked)")
    ap.add_argument("--from-hub", action="store_true", help="hub.json is already yours; only render")
    ap.add_argument("--keep-example", action="store_true", help="do not delete the example brief and triad")
    a = ap.parse_args()
    hub = os.path.abspath(a.hub or hubconfig.find_hub())
    hub_json = os.path.join(hub, hubconfig.HUB_FILE)

    if a.from_hub:
        cfg = hubconfig.load(hub)
    else:
        if a.answers:
            answers = json.loads(io.open(a.answers, encoding="utf-8").read())
        else:
            answers = interview()
        d = complete(answers)
        with io.open(hub_json, "w", encoding="utf-8", newline="\n") as f:
            f.write(dump(d))
        print("\n  wrote hub.json")
        cfg = hubconfig.load(hub)

    print("  rendering the documents from tools/templates/ …")
    for tmpl, dest in render.RENDERED:
        render.write(os.path.join(hub, dest), render.render_file(cfg, tmpl))
        print("  wrote %s" % dest)
    if not cfg.example and not a.keep_example:
        for dest in remove_example(hub):
            print("  removed %s (the example product's)" % dest)
    elif cfg.example:
        for tmpl, dest in render.EXAMPLE_ONLY:
            render.write(os.path.join(hub, dest), render.render_file(cfg, tmpl))
            print("  wrote %s (example)" % dest)

    print("\n  running the checker …")
    code = subprocess.call([sys.executable, os.path.join(HERE, "specs_check.py"), hub, "--hub", hub])
    if code == 0:
        print("  ✅ your hub is set up and green. Read CLAUDE.md, then commit.")
    else:
        print("  🔴 the checker found something — read the ✗ lines above.")
    return code


if __name__ == "__main__":
    sys.exit(main())
