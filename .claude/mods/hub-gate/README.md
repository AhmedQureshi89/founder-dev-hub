# hub-gate

Two standing rules of the hub, enforced at the tool call instead of remembered. It writes nothing.

```
  Claude runs  git commit … / git push …
        │
        ▼
  python tools/specs_check.py <repo> --hub <hub>
        ├─ exit 0  ──► the commit runs; status line: "hub-gate ✓ 3 passed … before commit"
        └─ exit 1  ──► the call is refused; the reason carries the ✗ lines; fix, then commit again

  Claude edits a file          (Edit · Write · NotebookEdit)
        │
        ▼
  git config user.email is one of hub.json's contributors[]  AND  the path is protected?
        ├─ no   ──► the write runs
        └─ yes  ──► refused, pointing at onboarding/team-roles.md
```

**Who is a contributor** is `hub.json`'s `contributors[]`: each row's `git_email` (matched
lowercased) and `branch_prefix` (`alex/` in the kit's example; `contributor/` when the row has
none). The owner's identity, and any identity hub.json does not list, is never held — the guard
narrows a contributor's session to a contributor's write set, nothing more. The refusal reads:

> hub-gate: CLAUDE.md is outside a contributor's write set (onboarding/team-roles.md). This session
> commits as alex@example.com; code and tests for the assigned item, its triad text, and a ▶ inbox
> note under its own row are what a contributor writes, on a alex/<id>-… branch by pull request.

**Protected paths**, relative to the repo root (`team-roles.md` §"Does not write"): `CLAUDE.md`,
`.claude/{context,briefs,returns,skills,mods,inbox}/`, `.claude/settings.json`, `.claude-plugin/`,
`tools/`, `onboarding/`, migrations (`migrations/`, `drizzle/`, `alembic/`, `supabase/migrations/`),
a `schema.{ts,sql,prisma}`, `.github/`, `infra/`, `deploy/`, any `Dockerfile*`, and a hosting config
(`railway.json`, `fly.toml`, …). The list is `PROTECTED` in `hooks/register.ts`.

- **Which commands**: `git … commit` and `git … push`, with git's global flags allowed between
  (`git -C x commit`, `git -c k=v push`); `git commit-tree`, `git log`, `gh pr merge` are not gated.
- **Where the hub is**: the first of the session's root, the main working tree's root and the
  **Hub checkout** option that holds both `hub.json` and `tools/specs_check.py`. Without one,
  nothing is gated and the status line says so once.
- **In a code repo**: the check is `specs_check.py <that repo> --hub <hub>` — the same line that
  repo's CI runs — so a red there holds the commit there too.
- **Known gap**: a write made through Bash (`sed`, a heredoc, `rm`) is not a file tool call and
  passes the write-set guard. The guard covers the path Claude Code normally takes.
- **When the check cannot run** (python missing, a timeout): the commit is held, not let through,
  and the reason says to run the check by hand.
- **When hub.json cannot be read**: the commit gate still runs the checker, which reads hub.json
  itself and goes red; the write-set guard has no contributors to match and is off, and the status
  line says so once.

Install outside the hub, where the project-scope switch does not reach (the hub's
[`mods/README.md`](../README.md) has the marketplace lines):

```
/plugin install hub-gate@founder-dev-hub
```

Hooks and calls, as `claude plugin validate` lists them: `tool.call{Bash}` and
`tool.call{Edit|Write|NotebookEdit}`, both gating with a `.catch`; `$.process.run`, `$.fs.read`,
`$.fs.exists`, `$.session.root`, `$.session.repo`, `$.ui.status`, `$.ui.toast`. Tests:
`claude plugin test` runs eight — the patterns, reading the contributors from hub.json, a red check
holding a commit, a green one letting it through and `git status` never running it, a contributor
refused on `CLAUDE.md` and allowed on a spec, the owner allowed on both, an unlisted identity left
alone, and a hub.json that does not parse turning the guard off.
