// hub-gate — two standing rules of the hub, enforced at the tool call instead of remembered.
//
//   1. A commit is gated on the governance check. `git commit` and `git push` run only after
//      `python tools/specs_check.py <repo> --hub <hub>` exits 0; a red check refuses the call
//      with its failing lines, and the fix is made first. (A checker that is run after the
//      commit is a checker that is skipped.)
//   2. A contributor's write set. Under a git identity that `hub.json` lists in `contributors[]`
//      (onboarding/team-roles.md), Edit, Write and NotebookEdit to the protected paths — CLAUDE.md,
//      .claude/{context,briefs,returns,skills,mods}/, tools/, migrations and schema, CI and deploy
//      config — are refused. A Claude Code session is the person running it, so the guard reads
//      `git config user.email`. The owner, and anyone hub.json does not list, is never held.
//
// The hub is the first of the session's root, the main working tree's root and the mod's one
// option, Hub checkout, that holds hub.json and tools/specs_check.py. Without one, nothing is
// gated and the status line says so once. Nothing here names a product, a repo or a person.

import type { EngineInterface, Register } from 'claude-code'

const HUB_FILE = 'hub.json'
const CHECKER = 'tools/specs_check.py'
/** The branch prefix a contributor's row in hub.json may leave unsaid. */
const DEFAULT_BRANCH_PREFIX = 'contributor/'

/** `git … commit` / `git … push`, with global flags (`-C x`, `-c k=v`, `--no-pager`) allowed between. */
export const GIT_COMMIT_OR_PUSH = /\bgit(?:\s+-[A-Za-z]\S*(?:\s+\S+)?|\s+--\S+)*\s+(commit|push)(?![\w-])/

/** Paths, relative to the repo root, a contributor does not write (team-roles.md, "Does not write"). */
export const PROTECTED: readonly RegExp[] = [
  /^CLAUDE\.md$/i,
  /^\.claude\/(context|briefs|returns|skills|mods|inbox)\//i,
  /^\.claude\/settings\.json$/i,
  /^\.claude-plugin\//i,
  /^tools\//i,
  /^onboarding\//i,
  /^(migrations|drizzle|alembic|supabase\/migrations)\//i,
  /(^|\/)schema\.(ts|sql|prisma)$/i,
  /^\.github\//i,
  /^(infra|deploy)\//i,
  /^Dockerfile(\..*)?$/i,
  /^(railway|fly|render|vercel)\.(json|toml|yaml|yml)$/i,
]

// ---- paths ----------------------------------------------------------------

function folderName(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
}

function join(dir: string, rel: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.replace(/[\\/]+$/, '') + sep + rel.split('/').join(sep)
}

function slashes(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

/** `path` relative to `root` with forward slashes, or null when it is not under `root`. */
export function relativeTo(root: string, path: string): string | null {
  const r = slashes(root).toLowerCase()
  const p = slashes(path)
  if (!/^([A-Za-z]:)?\//.test(p)) return p // already relative
  if (p.toLowerCase() === r) return ''
  if (!p.toLowerCase().startsWith(r + '/')) return null
  return p.slice(r.length + 1)
}

export function isProtected(rel: string): boolean {
  return PROTECTED.some(rx => rx.test(rel))
}

// ---- hub.json ---------------------------------------------------------------

/** One contributor as hub.json lists them: the git identity the guard matches, and the prefix their branches carry. */
export type Contributor = { email: string; branchPrefix: string }

/** `hub.json`'s text → its contributors, emails lowercased; a row without a `git_email` is skipped. */
export function parseContributors(text: string): Contributor[] {
  const data = JSON.parse(text) as { contributors?: unknown }
  const rows = Array.isArray(data.contributors) ? data.contributors : []
  return rows.flatMap((row: unknown): Contributor[] => {
    const o = (row ?? {}) as { git_email?: unknown; branch_prefix?: unknown }
    if (typeof o.git_email !== 'string' || o.git_email.trim() === '') return []
    const branchPrefix =
      typeof o.branch_prefix === 'string' && o.branch_prefix !== '' ? o.branch_prefix : DEFAULT_BRANCH_PREFIX
    return [{ email: o.git_email.trim().toLowerCase(), branchPrefix }]
  })
}

// ---- where we are ---------------------------------------------------------

type Place = {
  root: string
  /** The folder holding hub.json and the checker; null when none of the candidates does. */
  hub: string | null
  /** hub.json's contributors — the identities whose writes are held to their write set. */
  contributors: Contributor[]
  /** Why hub.json could not be read, when it could not; the write-set guard is then off. */
  configError: string | null
}

let place: Promise<Place> | null = null
let email: Promise<string> | null = null
let saidNoHub = false
let saidNoConfig = false

/** The first of the session's root, the main working tree's root and the "hub" option that holds hub.json and the checker. */
async function locate($: EngineInterface, hubOption: string): Promise<Place> {
  const root = await $.session.root()
  const repoInfo = await $.session.repo().catch(() => null)
  const candidates = [root, repoInfo?.root ?? '', hubOption].filter(p => p.length > 0)
  for (const dir of candidates) {
    if (!(await $.fs.exists(join(dir, HUB_FILE))) || !(await $.fs.exists(join(dir, CHECKER)))) continue
    try {
      const text = await $.fs.read(join(dir, HUB_FILE))
      return { root, hub: dir, contributors: parseContributors(typeof text === 'string' ? text : ''), configError: null }
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      return { root, hub: dir, contributors: [], configError: `${join(dir, HUB_FILE)} could not be read: ${why}` }
    }
  }
  return { root, hub: null, contributors: [], configError: null }
}

function wherePlaced($: EngineInterface, hubOption: string): Promise<Place> {
  place ??= locate($, hubOption)
  return place
}

function whoCommits($: EngineInterface, root: string): Promise<string> {
  email ??= $.process
    .run(['git', 'config', 'user.email'], { cwd: root, timeoutMs: 10_000 })
    .then(ran => ran.stdout.trim().toLowerCase())
    .catch(() => '')
  return email
}

// ---- the check ------------------------------------------------------------

type Verdict = { isGreen: true; summary: string } | { isGreen: false; reason: string }

async function runChecker($: EngineInterface, p: Place & { hub: string }): Promise<Verdict> {
  const repoArg = slashes(p.root) === slashes(p.hub) ? '.' : p.root
  const hubArg = repoArg === '.' ? '.' : p.hub
  const ran = await $.process.run(['python', join(p.hub, CHECKER), repoArg, '--hub', hubArg], {
    cwd: p.hub,
    env: { PYTHONIOENCODING: 'utf-8' },
    timeoutMs: 120_000,
  })
  const lines = (ran.stdout + '\n' + ran.stderr).replace(/\r/g, '').split('\n').map(l => l.trimEnd())
  const summary = lines.filter(l => /\d+ passed/.test(l)).pop() ?? `exit ${ran.exitCode}`
  if (ran.exitCode === 0) return { isGreen: true, summary: summary.trim() }
  const red = lines.filter(l => /^\s*(✗|✘|×|FAIL|Traceback|\w+Error)/.test(l) || /^\s{4,}\S/.test(l))
  const shown = (red.length > 0 ? red : lines.filter(l => l.trim() !== '')).slice(-40).join('\n')
  return {
    isGreen: false,
    reason:
      `hub-gate: specs-check is red (${summary.trim()}), so this ${repoArg === '.' ? 'hub' : folderName(p.root)} ` +
      `commit/push is held. Fix the findings, re-run \`python ${CHECKER} ${repoArg} --hub ${hubArg}\`, then commit again.\n` +
      shown.slice(0, 3000),
  }
}

// ---- hooks ----------------------------------------------------------------

export const register: Register = (on, options) => {
  const hubOption = typeof options.hub === 'string' ? options.hub : ''

  // 1. git commit / push waits for a green specs-check
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const m = GIT_COMMIT_OR_PUSH.exec(e.command)
    if (m === null) return next(e)
    const p = await wherePlaced($, hubOption)
    if (p.hub === null) {
      if (!saidNoHub) {
        saidNoHub = true
        $.ui.status('hub-gate: no hub found, nothing gated')
      }
      return next(e)
    }
    const verdict = await runChecker($, { ...p, hub: p.hub })
    if (!verdict.isGreen) {
      $.ui.toast(`hub-gate held the ${m[1]}: specs-check is red`)
      return { deny: verdict.reason }
    }
    $.ui.status(`hub-gate ✓ ${verdict.summary} before ${m[1]}`)
    return next(e)
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: the specs-check could not run, so the commit is held. Run it by hand first.` },
  )

  // 2. a contributor's write set
  for (const tool of ['Edit', 'Write', 'NotebookEdit'] as const) {
    on('tool.call', { tool }, async ($, e, next) => {
      const path = 'file_path' in e ? e.file_path : 'notebook_path' in e ? e.notebook_path : ''
      if (typeof path !== 'string' || path === '') return next(e)
      const p = await wherePlaced($, hubOption)
      const rel = relativeTo(p.root, path)
      if (rel === null || !isProtected(rel)) return next(e)
      if (p.configError !== null && !saidNoConfig) {
        saidNoConfig = true
        $.ui.status(`hub-gate: ${p.configError}; the write-set guard is off`)
      }
      const who = await whoCommits($, p.root)
      const contributor = p.contributors.find(c => c.email === who)
      if (contributor === undefined) return next(e)
      return {
        deny:
          `hub-gate: ${rel} is outside a contributor's write set (onboarding/team-roles.md). ` +
          `This session commits as ${who}; code and tests for the assigned item, its triad text, ` +
          `and a ▶ inbox note under its own row are what a contributor writes, ` +
          `on a ${contributor.branchPrefix}<id>-… branch by pull request.`,
      }
    }).catch(($, e, next) => (next.called ? next(e) : { deny: `${$.plugin.name}: the write-set check could not run, so the write is held.` }))
  }
}
