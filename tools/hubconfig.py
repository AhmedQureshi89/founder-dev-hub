#!/usr/bin/env python3
"""hubconfig — read hub.json, the one file that names your product, your repos and your people.

Every tool in tools/ reads this instead of carrying its own list of repo names, id prefixes or
paths. Change hub.json and every tool, skill and mod follows.

    from hubconfig import load, find_hub
    cfg = load(find_hub())                # from anywhere inside the hub
    cfg.prefixes                          # ["WEB", "API", "JOB"] — the code repos' id prefixes
    cfg.all_prefixes                      # + "X" (cross-repo), "D" (decisions), "KI" (known issues)
    cfg.repo("API").name                  # "garden-api"
    cfg.prefix_for_folder("garden-api")   # "API"; the hub's own folder and unknown names → None

Reports. Never writes. Python 3.9 or newer, standard library only.
"""
import io
import json
import os
import re

HUB_FILE = "hub.json"
ROADMAP = os.path.join(".claude", "context", "roadmap.md")
CONSTITUTION = os.path.join(".claude", "context", "constitution.md")
OPEN_DECISIONS = os.path.join(".claude", "context", "open-decisions.md")

REQUIRED = ("product.name", "owner.name", "owner.git_email", "hub.name", "repos", "ids.cross")
PREFIX_RE = re.compile(r"^[A-Z][A-Z0-9]{0,5}$")


class HubConfigError(SystemExit):
    """Raised with a plain message; exits 2 so a wrong hub.json never reads as a passing check."""

    def __init__(self, msg):
        super().__init__("hub.json: %s" % msg)


class Repo:
    def __init__(self, d):
        self.prefix = d["prefix"]
        self.name = d["name"]
        self.what = d.get("what", "")
        self.github = d.get("github", "")
        self.path = d.get("path", "")
        self.default_branch = d.get("default_branch", "main")

    def resolve_path(self, hub):
        """The repo's working copy, absolute. Relative paths are relative to the hub root."""
        if not self.path:
            return None
        p = os.path.expanduser(self.path)
        return os.path.normpath(p if os.path.isabs(p) else os.path.join(hub, p))


class Person:
    def __init__(self, d):
        self.name = d.get("name", "")
        self.github = d.get("github", "")
        self.git_email = d.get("git_email", "").lower()
        self.branch_prefix = d.get("branch_prefix", "")


class HubConfig:
    def __init__(self, data, root):
        self.data = data
        self.root = root
        self.example = bool(data.get("example", False))
        self.product_name = data["product"]["name"]
        self.product_one_line = data["product"].get("one_line", "")
        self.owner = Person(data["owner"])
        self.hub_name = data["hub"]["name"]
        self.hub_github = data["hub"].get("github", "")
        self.default_branch = data["hub"].get("default_branch", "main")
        self.repos = [Repo(r) for r in data["repos"]]
        ids = data.get("ids", {})
        self.cross = ids.get("cross", "X")
        self.decision = ids.get("decision", "D")
        self.known_issue = ids.get("known_issue", "KI")
        self.contributors = [Person(c) for c in data.get("contributors", [])]
        self.forbidden_spellings = list(data.get("checks", {}).get("forbidden_spellings", []))

    # ── ids ───────────────────────────────────────────────────────────────
    @property
    def prefixes(self):
        return [r.prefix for r in self.repos]

    @property
    def all_prefixes(self):
        return self.prefixes + [self.cross, self.decision, self.known_issue]

    # ── repos ─────────────────────────────────────────────────────────────
    def repo(self, prefix):
        for r in self.repos:
            if r.prefix == (prefix or "").upper():
                return r
        return None

    def repo_named(self, name):
        for r in self.repos:
            if r.name.lower() == (name or "").lower():
                return r
        return None

    def prefix_for_folder(self, folder):
        """The id prefix of the repo whose name is `folder`, or None (the hub, a worktree, a stranger)."""
        r = self.repo_named(os.path.basename(os.path.normpath(folder)))
        return r.prefix if r else None

    def repo_names(self):
        return {r.prefix: r.name for r in self.repos}

    # ── people ────────────────────────────────────────────────────────────
    def role_of(self, git_email):
        e = (git_email or "").strip().lower()
        if e and e == self.owner.git_email:
            return "owner"
        if any(e == c.git_email for c in self.contributors if c.git_email):
            return "contributor"
        return "unknown"

    # ── paths ─────────────────────────────────────────────────────────────
    @property
    def roadmap(self):
        return os.path.join(self.root, ROADMAP)

    @property
    def constitution(self):
        return os.path.join(self.root, CONSTITUTION)


def _get(d, dotted):
    for k in dotted.split("."):
        if not isinstance(d, dict) or k not in d:
            return None
        d = d[k]
    return d


def validate(data):
    for key in REQUIRED:
        v = _get(data, key)
        if v in (None, "", []):
            raise HubConfigError("`%s` is missing or empty" % key)
    seen = set()
    for i, r in enumerate(data["repos"]):
        for k in ("prefix", "name"):
            if not r.get(k):
                raise HubConfigError("repos[%d] has no `%s`" % (i, k))
        if not PREFIX_RE.match(r["prefix"]):
            raise HubConfigError("repos[%d].prefix %r must be 1-6 capitals or digits, starting with a capital"
                                 % (i, r["prefix"]))
        if r["prefix"] in seen:
            raise HubConfigError("two repos share the prefix %s" % r["prefix"])
        seen.add(r["prefix"])
    ids = data.get("ids", {})
    for k in ("cross", "decision", "known_issue"):
        v = ids.get(k)
        if v is not None and (not PREFIX_RE.match(v) or v in seen):
            raise HubConfigError("ids.%s %r must be a short capital prefix no repo uses" % (k, v))


def find_hub(start=None):
    """Walk up from `start` (default: this file's folder) to the folder holding hub.json."""
    here = os.path.abspath(start or os.path.dirname(os.path.abspath(__file__)))
    while True:
        if os.path.isfile(os.path.join(here, HUB_FILE)):
            return here
        parent = os.path.dirname(here)
        if parent == here:
            raise HubConfigError("not found above %s — run from inside the hub, or pass --hub" % start)
        here = parent


def load(hub):
    """The HubConfig for the hub at `hub` (a folder holding hub.json)."""
    path = os.path.join(os.path.abspath(hub), HUB_FILE)
    if not os.path.isfile(path):
        raise HubConfigError("no %s in %s" % (HUB_FILE, hub))
    try:
        data = json.loads(io.open(path, encoding="utf-8").read())
    except ValueError as e:
        raise HubConfigError("%s is not valid JSON — %s" % (path, e))
    validate(data)
    return HubConfig(data, os.path.abspath(hub))


if __name__ == "__main__":
    import sys
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    cfg = load(find_hub(sys.argv[1] if len(sys.argv) > 1 else None))
    print("hub      %s (%s)" % (cfg.hub_name, cfg.root))
    print("product  %s — %s" % (cfg.product_name, cfg.product_one_line))
    print("owner    %s <%s>" % (cfg.owner.name, cfg.owner.git_email))
    for r in cfg.repos:
        print("repo     %-4s %-20s %s" % (r.prefix, r.name, r.what))
    print("ids      %s" % ", ".join(cfg.all_prefixes))
    print("example  %s" % cfg.example)
