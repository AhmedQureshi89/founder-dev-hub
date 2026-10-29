// phase-progress — how far the current phase is from done, re-counted each time something merges.
//
// A phase is done when every box in its verification.md is ticked. This mod counts them on
// origin's default branch (what is merged) and in the working tree (what this branch adds),
// and draws, in a pane:
//   📐 the phase as a bar: ticked of total, what is left, the 🚦 verdict gates ticked;
//   🔲 the sections still open, each with its own count;
//   🔀 the last merges that changed the phase's verification.md, each with the ticks it brought.
// The status line under the prompt carries the bar at all times.
//
// Which phase: the one pinned with `/phase-progress <n>`, else the one the branch names
// (`job-5/…`, `api-4.7/…` — a lane prefix hub.json lists — or `claude/req-5-13-…`), else the
// phase whose verification.md changed last on the default branch and still has boxes open.
//
// When: at session start; then, each minute, `git ls-remote` asks whether origin's default branch
// moved, and after every main-loop turn too, and after a `git merge` / `pull` / `fetch` or a
// `gh pr merge` the session ran. A move is fetched and re-counted, and raised as a toast:
// "🔀 #41 merged — JOB-5: 27 → 31 of 116 (+4) · 85 to go". The first read of a session compares
// with where the last session in this repository left off, so a merge made between sessions is
// told too.
//
// Which lane a session is comes from `hub.json` at the hub root: the main working tree's folder
// name matched against `repos[].name` gives its prefix; the hub itself, or a folder hub.json does
// not list, is HUB. The hub is the first of the session's root, the main working tree's root and
// the mod's one option, Hub checkout, that holds hub.json. Nothing here names a product, a repo
// or a person.
//
// In the hub it stays quiet — no pane, no status line, no polling — until `/phase-progress` is
// run: development happens in the code repos.
//
// Reads git and the files; writes nothing but its own store (a pin, and where it last looked).

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BoxCount, MergeStep, PhaseCount, Progress, SectionCount } from '../types'

const PANE = 'phase-progress'
const TITLE = 'Phase progress'
const HUB_FILE = 'hub.json'
/** How often origin is asked whether the default branch moved. */
const POLL_MS = 60_000
/** The least time between two checks a turn's end starts. */
const TURN_GAP_MS = 20_000
/** Merges the pane lists. */
const HISTORY = 8
/** Open sections the pane lists while it sits inline above the prompt. */
const INLINE_ROWS = 5
/** A verification.md the mod counts: directly under `specs/` or the hub's `.claude/context/`. */
const VERIFICATION = /^(?:specs|\.claude\/context)\/(phase-[^/]+)\/verification\.md$/

const progress = atom({ plugin: 'phase-progress', key: 'progress' } as const, null)

// ---- hub.json ---------------------------------------------------------------

/** What the mod needs from `hub.json`: the code repos with their id prefixes, and the cross-repo prefix. */
export type HubConfig = { repos: { prefix: string; name: string }[]; cross: string }

/**
 * The id prefixes a branch name or a pin may carry — every repo's, the cross-repo one and the
 * hub's own — and the cross-repo one alone, which also names a hub phase folder (`phase-x21-…`).
 */
export type Lanes = { prefixes: string[]; cross: string }

/** `hub.json`'s text → its repos and cross-repo prefix; throws when the file is not the shape the kit expects. */
export function parseHubConfig(text: string): HubConfig {
  const data = JSON.parse(text) as { repos?: unknown; ids?: { cross?: unknown } }
  if (!Array.isArray(data.repos)) throw new Error(`${HUB_FILE} has no "repos" list`)
  const repos = data.repos.map((r: unknown) => {
    const o = (r ?? {}) as { prefix?: unknown; name?: unknown }
    if (typeof o.prefix !== 'string' || typeof o.name !== 'string') {
      throw new Error(`${HUB_FILE}: every repo needs a "prefix" and a "name"`)
    }
    return { prefix: o.prefix, name: o.name }
  })
  const cross = typeof data.ids?.cross === 'string' && data.ids.cross !== '' ? data.ids.cross : 'X'
  return { repos, cross }
}

/** The lane of a working tree: the prefix of the repo whose name is its folder; anything else — the hub itself, a stranger — is HUB. */
export function laneOf(cfg: HubConfig | null, folder: string): string {
  const name = folder.toLowerCase()
  return cfg?.repos.find(r => r.name.toLowerCase() === name)?.prefix ?? 'HUB'
}

/** The lanes hub.json gives; with none in reach, only the cross-repo prefix and the hub's own. */
export function lanesOf(cfg: HubConfig | null): Lanes {
  const cross = cfg?.cross ?? 'X'
  return { prefixes: [...new Set([...(cfg?.repos.map(r => r.prefix) ?? []), cross, 'HUB'])], cross }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** `(?:WEB|API|JOB|X|HUB)` for the lanes, to go in a case-insensitive pattern. */
function laneAlternation(lanes: Lanes): string {
  return `(?:${lanes.prefixes.map(escapeRegExp).join('|')})`
}

const configMemo = new Map<string, Promise<HubConfig | null>>()

/** `hub.json` at `hub`, read once per session; null when it could not be read or parsed, and tried again next time. */
function hubConfig($: EngineInterface, hub: string): Promise<HubConfig | null> {
  let pending = configMemo.get(hub)
  if (pending === undefined) {
    pending = $.fs
      .read(join(hub, HUB_FILE))
      .then(text => parseHubConfig(typeof text === 'string' ? text : ''))
      .catch(() => {
        configMemo.delete(hub)
        return null
      })
    configMemo.set(hub, pending)
  }
  return pending
}

/** The first of `candidates` that holds hub.json. */
async function findHub($: EngineInterface, candidates: readonly string[]): Promise<string | null> {
  for (const dir of candidates) {
    if (dir.length > 0 && (await $.fs.exists(join(dir, HUB_FILE)))) return dir
  }
  return null
}

// ---- counting -------------------------------------------------------------

const BOX = /^\s*(?:>\s*)*[-*+]\s+\[([^\]])\]\s*(.*)$/
const HEADING = /^(#{1,3})\s+(.*?)\s*#*\s*$/
const FENCE = /^\s*(?:>\s*)*(```|~~~)/
const GATE = /VERDICT GATE|^(?:\*\*)?🚦/

function zero(): BoxCount {
  return { done: 0, open: 0, partial: 0, setAside: 0, gates: 0, gatesDone: 0 }
}

/** Boxes that count toward the phase: every one but those struck through. */
export function boxes(c: BoxCount): number {
  return c.done + c.open + c.partial
}

export function toGo(c: BoxCount): number {
  return c.open + c.partial
}

function tally(c: BoxCount, mark: string, rest: string): void {
  const isGate = GATE.test(rest)
  if (mark === 'x' || mark === 'X') {
    c.done++
    if (isGate) {
      c.gates++
      c.gatesDone++
    }
    return
  }
  if (mark === ' ' && rest.startsWith('~~')) {
    c.setAside++
    return
  }
  if (mark === ' ') c.open++
  else c.partial++
  if (isGate) c.gates++
}

/** Markdown a heading carries that a one-line row does not need. */
function plain(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Every box of a verification.md, in total and per section; boxes in code fences and comments are examples, not checks. */
export function countBoxes(text: string): PhaseCount {
  const lines = text.replace(/\r/g, '').split('\n')
  let title = ''
  const total = zero()
  const sections: SectionCount[] = []
  let current: SectionCount | null = null
  let fence: string | null = null
  let isComment = false
  for (const line of lines) {
    const f = FENCE.exec(line)
    if (f) {
      if (fence === null) fence = f[1] ?? null
      else if (f[1] === fence) fence = null
      continue
    }
    if (fence !== null) continue
    if (isComment) {
      if (line.includes('-->')) isComment = false
      continue
    }
    if (/^\s*<!--/.test(line) && !line.includes('-->')) {
      isComment = true
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      const heading = plain(h[2] ?? '')
      if ((h[1] ?? '').length === 1) {
        if (title === '') title = heading.replace(/^Phase\s+\S+\s+Verification\s*[—–:-]\s*/i, '')
        continue
      }
      current = { heading, count: zero() }
      sections.push(current)
      continue
    }
    const b = BOX.exec(line)
    if (!b) continue
    if (current === null) {
      current = { heading: title || 'Before the first heading', count: zero() }
      sections.push(current)
    }
    tally(total, b[1] ?? ' ', b[2] ?? '')
    tally(current.count, b[1] ?? ' ', b[2] ?? '')
  }
  return { title, total, sections: sections.filter(s => boxes(s.count) + s.count.setAside > 0) }
}

// ---- which phase ----------------------------------------------------------

/** The phase numbers a branch name points at, most specific first: `<lane>-5/…` → 5; `req-5-13` → 5.13, then 5. */
export function hintsFromBranch(branch: string, lanes: Lanes): string[] {
  const out: string[] = []
  const lane = new RegExp(`(?:^|[/_-])${laneAlternation(lanes)}-(\\d+(?:\\.\\d+)*)`, 'i').exec(branch)
  if (lane?.[1]) out.push(lane[1])
  const req = /(?:^|[/_-])req-(\d+)(?:[.-](\d+))?/i.exec(branch)
  if (req?.[1]) {
    if (req[2]) out.push(`${req[1]}.${req[2]}`)
    out.push(req[1])
  }
  return [...new Set(out)]
}

/** The folders a phase number names: `phase-5` exactly, else `phase-21.0` … `phase-21.4`, `phase-8-access`, `phase-x21-…` (the cross-repo prefix, lowercased). */
export function foldersFor(num: string, folders: readonly string[], lanes: Lanes): string[] {
  const n = num.replace(/^phase-/i, '').replace(new RegExp(`^${laneAlternation(lanes)}-`, 'i'), '')
  const x = lanes.cross.toLowerCase()
  const exact = folders.filter(f => f === `phase-${n}` || f === `phase-${x}${n}`)
  if (exact.length > 0) return exact
  return folders.filter(f => [`phase-${n}.`, `phase-${n}-`, `phase-${x}${n}.`, `phase-${x}${n}-`].some(p => f.startsWith(p)))
}

/** How the phase is named on screen. */
export function phaseId(lane: string, folder: string): string {
  return lane === 'HUB' ? folder : `${lane}-${folder.replace(/^phase-/, '')}`
}

// ---- git --------------------------------------------------------------------

function folderName(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
}

function join(dir: string, rel: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.replace(/[\\/]+$/, '') + sep + rel.split('/').join(sep)
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function git($: EngineInterface, cwd: string, args: string[], timeoutMs = 20_000): Promise<string> {
  const ran = await $.process.run(['git', ...args], { cwd, timeoutMs, env: { GIT_TERMINAL_PROMPT: '0' } })
  if (ran.exitCode !== 0) {
    const why = ran.stderr.trim().split('\n').pop() ?? ''
    throw new Error(`git ${args[0]} exited ${ran.exitCode}${why ? `: ${why}` : ''}`)
  }
  return ran.stdout
}

async function baseBranch($: EngineInterface, cwd: string): Promise<string> {
  try {
    const head = (await git($, cwd, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])).trim()
    if (head.startsWith('origin/')) return head.slice('origin/'.length)
  } catch {
    // origin/HEAD is often unset in a clone; try the two usual names
  }
  for (const name of ['main', 'master']) {
    try {
      await git($, cwd, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${name}`])
      return name
    } catch {
      // not this one
    }
  }
  return 'main'
}

type Commit = { sha: string; at: string; subject: string; body: string }

/** `git log --format=%x1e%H%x1f%cI%x1f%s%x1f%b`, one record per commit. */
export function parseLog(stdout: string): Commit[] {
  return stdout
    .split('\x1e')
    .filter(record => record.trim() !== '')
    .map(record => {
      const [sha = '', at = '', subject = '', body = ''] = record.replace(/\r/g, '').split('\x1f')
      return { sha: sha.trim(), at: at.trim(), subject: subject.trim(), body: body.trim() }
    })
}

/** The pull request a commit merged, and its title: GitHub's merge subject, or a squash's `(#n)`. */
export function pullRequestOf(subject: string, body: string): { pr: number | null; title: string } {
  const merge = /^Merge pull request #(\d+) from (\S+)/.exec(subject)
  if (merge) {
    const first = body.split('\n').map(line => line.trim()).find(line => line !== '')
    return { pr: Number(merge[1]), title: first ?? merge[2] ?? subject }
  }
  const squash = /\(#(\d+)\)\s*$/.exec(subject)
  if (squash) return { pr: Number(squash[1]), title: subject.replace(/\s*\(#\d+\)\s*$/, '') }
  return { pr: null, title: subject }
}

// Read once per object: a blob at a commit never changes. Module memory, so a reload starts over.
const countMemo = new Map<string, PhaseCount | null>()
const treeMemo = new Map<string, Map<string, number>>()
const historyMemo = new Map<string, MergeStep[]>()

/** The phase's verification.md at `rev`, counted; null when it is not there. */
async function countAt($: EngineInterface, cwd: string, rev: string, path: string): Promise<PhaseCount | null> {
  const key = `${rev}:${path}`
  if (countMemo.has(key)) return countMemo.get(key) ?? null
  let counted: PhaseCount | null
  try {
    counted = countBoxes(await git($, cwd, ['show', key]))
  } catch {
    counted = null
  }
  countMemo.set(key, counted)
  return counted
}

/** Every verification.md at `tip`, each with when it last changed there (seconds since the epoch). */
async function phasesAt($: EngineInterface, cwd: string, tip: string): Promise<Map<string, number>> {
  const memo = treeMemo.get(tip)
  if (memo) return memo
  const listed = await git($, cwd, ['ls-tree', '-r', '--name-only', tip, '--', 'specs', '.claude/context'])
  const paths = listed.replace(/\r/g, '').split('\n').filter(p => VERIFICATION.test(p))
  const changed = new Map<string, number>(paths.map(p => [p, 0]))
  if (paths.length > 0) {
    const log = await git($, cwd, ['log', tip, '-n', '400', '--format=@%ct', '--name-only', '--', ...paths])
    let at = 0
    for (const line of log.replace(/\r/g, '').split('\n')) {
      if (line.startsWith('@')) at = Number(line.slice(1))
      else if (changed.get(line) === 0) changed.set(line, at)
    }
  }
  treeMemo.set(tip, changed)
  return changed
}

/** The last merges into `tip` that changed `path`, newest first, each with the ticks it brought. */
async function historyOf($: EngineInterface, cwd: string, tip: string, path: string): Promise<MergeStep[]> {
  const key = `${tip}:${path}`
  const memo = historyMemo.get(key)
  if (memo) return memo
  const commits = parseLog(
    await git($, cwd, ['log', tip, '--first-parent', '-n', String(HISTORY), '--format=%x1e%H%x1f%cI%x1f%s%x1f%b', '--', path]),
  )
  const counts = await Promise.all(commits.map(c => countAt($, cwd, c.sha, path)))
  const oldest = commits[commits.length - 1]
  const before = oldest ? await countAt($, cwd, `${oldest.sha}^1`, path) : null
  const steps = commits.map((c, i): MergeStep => {
    const now = counts[i] ?? null
    const prior = i + 1 < commits.length ? (counts[i + 1] ?? null) : before
    const { pr, title } = pullRequestOf(c.subject, c.body)
    const done = now?.total.done ?? 0
    return {
      sha: c.sha, at: c.at, pr, title, done,
      total: now ? boxes(now.total) : 0,
      delta: done - (prior?.total.done ?? 0),
    }
  })
  historyMemo.set(key, steps)
  return steps
}

/**
 * The verification.md files this branch adds — committed since it left the tip's line, staged, or
 * untracked. Not every file the working tree holds: a checkout that is only behind origin still
 * holds the phases origin has since moved to `specs/archive/`, and those are not new.
 */
async function addedOnBranch($: EngineInterface, cwd: string, tip: string): Promise<string[]> {
  let since = tip
  try {
    since = (await git($, cwd, ['merge-base', 'HEAD', tip])).trim()
  } catch {
    // unrelated histories: compare with the tip itself
  }
  const [added, untracked] = await Promise.all([
    git($, cwd, ['diff', '--name-only', '--diff-filter=A', since, '--', 'specs', '.claude/context']).catch(() => ''),
    git($, cwd, ['ls-files', '--others', '--exclude-standard', '--', 'specs', '.claude/context']).catch(() => ''),
  ])
  return [...added.split('\n'), ...untracked.split('\n')].map(p => p.trim()).filter(p => VERIFICATION.test(p))
}

/** What moved between two tips, in words: "#97 merged", "3 merges (#95 #96 #97)", "2 commits". */
async function movedLabel($: EngineInterface, cwd: string, from: string, to: string): Promise<string> {
  try {
    const commits = parseLog(await git($, cwd, ['log', `${from}..${to}`, '--first-parent', '-n', '50', '--format=%x1e%H%x1f%cI%x1f%s%x1f%b']))
    const prs = commits.map(c => pullRequestOf(c.subject, c.body).pr).filter((n): n is number => n !== null)
    if (prs.length === 1) return `#${prs[0]} merged`
    if (prs.length > 1) return `${prs.length} merges (${prs.slice(0, 5).map(n => `#${n}`).join(' ')}${prs.length > 5 ? ' …' : ''})`
    return `${commits.length} new commit${commits.length === 1 ? '' : 's'}`
  } catch {
    return 'the branch moved'
  }
}

// ---- reading --------------------------------------------------------------

type Seen = { tip: string; path: string; done: number }

let isRefreshing = false
let lastPollAt = 0
/** The session's lane, read at session start. In the hub the mod is quiet until `/phase-progress` wakes it. */
let sessionLane: string | null = null
let isWoken = false
let timer: { cancel: () => void } | null = null

function isLoud(lane: string): boolean {
  return lane !== 'HUB' || isWoken
}

/** The "hub" option as `register` read it: where hub.json is when this session is not inside the hub. */
let hubOption = ''

type Where = { root: string; mainRoot: string; lane: string; hasOrigin: boolean; lanes: Lanes; hubWarning: string | null }

/** The session's working tree, its lane as hub.json names it, and the id prefixes hub.json knows. */
async function locate($: EngineInterface): Promise<Where | null> {
  const root = await $.session.root()
  const repo = await $.session.repo().catch(() => null)
  if (repo === null) return null
  const hub = await findHub($, [root, repo.root, hubOption])
  const cfg = hub === null ? null : await hubConfig($, hub)
  const hubWarning =
    hub === null
      ? `No ${HUB_FILE} found — set the Hub checkout option; lane unknown, read as HUB.`
      : cfg === null
        ? `${join(hub, HUB_FILE)} could not be read — lane unknown, read as HUB.`
        : null
  return {
    root,
    mainRoot: repo.root,
    lane: laneOf(cfg, folderName(repo.root)),
    hasOrigin: repo.remote !== null,
    lanes: lanesOf(cfg),
    hubWarning,
  }
}

function blank(root: string, lane: string, readAt: string): Progress {
  return {
    root, lane, branch: '', base: '', tipRef: '', tip: '', readAt,
    phase: null, id: '', path: null, reason: '', merged: null, local: null,
    history: [], phases: [], warning: null, error: null, isBusy: false,
  }
}

/**
 * One read into `$.state`: fetch when asked, find the phase, count it at origin's tip and in the
 * working tree, and raise a toast when origin's tip moved since the last read. A read already
 * running is left to finish.
 */
export async function refresh($: EngineInterface, options: { fetch: boolean }): Promise<Progress | null> {
  if (isRefreshing) return read($, progress)
  isRefreshing = true
  const readAt = new Date(await $.clock.now()).toISOString()
  try {
    const where = await locate($)
    if (where === null) {
      const next = { ...blank(await $.session.root(), 'HUB', readAt), error: 'This session is not inside a git repository.' }
      await update($, progress, () => next)
      if (isLoud(next.lane)) $.ui.status(statusLine(next))
      return next
    }
    const { root, mainRoot, lane, hasOrigin, lanes, hubWarning } = where
    const before = await read($, progress)
    await update($, progress, old => (old ? { ...old, isBusy: true } : { ...blank(root, lane, readAt), isBusy: true }))

    const branch = (await git($, root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    const base = await baseBranch($, root)
    let warning: string | null = null
    if (options.fetch && hasOrigin) {
      try {
        await git($, root, ['fetch', '--quiet', '--no-tags', 'origin', base], 60_000)
      } catch (err) {
        warning = `Could not reach origin — counted as of the last fetch (${message(err)}).`
      }
    }
    let tipRef = `refs/remotes/origin/${base}`
    let tip: string
    try {
      tip = (await git($, root, ['rev-parse', '--verify', '--quiet', tipRef])).trim()
    } catch {
      tipRef = 'HEAD'
      tip = (await git($, root, ['rev-parse', 'HEAD'])).trim()
      warning = warning ?? `No origin/${base} here — counted at HEAD.`
    }

    // every phase: those merged at the tip, and those this branch adds
    const atTip = await phasesAt($, root, tip)
    const localOnly = (await addedOnBranch($, root, tip)).filter(p => !atTip.has(p))
    const now = Date.parse(readAt) / 1000
    const candidates = [
      ...[...atTip].map(([path, changedAt]) => ({ path, changedAt })),
      ...localOnly.map(path => ({ path, changedAt: now })), // a triad written on this branch is the newest thing here
    ]
      .map(c => ({ ...c, folder: VERIFICATION.exec(c.path)?.[1] ?? '' }))
      .sort((a, b) => b.changedAt - a.changedAt)
    const folders = candidates.map(c => c.folder)
    if (candidates.length === 0) {
      const next = { ...blank(root, lane, readAt), branch, base, tipRef, tip, warning: warning ?? hubWarning, error: 'No specs/phase-*/verification.md here.' }
      await update($, progress, () => next)
      if (isLoud(lane)) $.ui.status(statusLine(next))
      return next
    }

    const countOf = async (path: string) =>
      atTip.has(path) ? countAt($, root, tip, path) : countBoxes(String(await $.fs.read(join(root, path))))
    const firstOpen = async (list: typeof candidates) => {
      for (const c of list) {
        const n = await countOf(c.path).catch(() => null)
        if (n && toGo(n.total) > 0) return { chosen: c, isOpen: true }
      }
      return { chosen: list[0] ?? candidates[0]!, isOpen: false }
    }
    const among = (names: string[]) => candidates.filter(c => names.includes(c.folder))

    let chosen = candidates[0]!
    let reason = ''
    const pin = await $.store.get(`pin:${mainRoot}`)
    const pinned = typeof pin === 'string' ? foldersFor(pin, folders, lanes) : []
    if (typeof pin === 'string' && pinned.length === 0) {
      warning = warning ?? `The pinned phase "${pin}" is not here — chosen automatically. /phase-progress auto unpins.`
    }
    const hinted = hintsFromBranch(branch, lanes).map(h => foldersFor(h, folders, lanes)).find(m => m.length > 0) ?? []
    if (pinned.length > 0) {
      chosen = (await firstOpen(among(pinned))).chosen
      reason = `pinned with /phase-progress ${String(pin)}`
    } else if (hinted.length > 0) {
      chosen = (await firstOpen(among(hinted))).chosen
      reason = `named by the branch ${branch}`
    } else {
      const found = await firstOpen(candidates)
      chosen = found.chosen
      reason = found.isOpen
        ? `changed last on ${base}, with boxes still open`
        : `changed last on ${base} — every phase here is ticked`
    }

    const path = chosen.path
    const merged = atTip.has(path) ? await countAt($, root, tip, path) : null
    let local: PhaseCount | null = null
    try {
      const text = await $.fs.read(join(root, path))
      local = countBoxes(typeof text === 'string' ? text : '')
    } catch {
      local = null // deleted on this branch: the merged count stands alone
    }
    const history = merged ? await historyOf($, root, tip, path) : []

    const next: Progress = {
      root, lane, branch, base, tipRef, tip, readAt,
      phase: chosen.folder, id: phaseId(lane, chosen.folder), path, reason,
      merged, local, history, phases: [...folders].sort(), error: null, isBusy: false,
      warning: [warning, hubWarning].filter((w): w is string => w !== null).join(' ') || null,
    }
    await update($, progress, () => next)
    if (isLoud(lane)) $.ui.status(statusLine(next))

    // tell a move of origin's tip: since the last read in this session, else since the last session here
    const seenKey = `seen:${mainRoot}`
    const stored = await $.store.get(seenKey)
    const prior: Seen | null =
      before && before.tip && before.path
        ? { tip: before.tip, path: before.path, done: before.merged?.total.done ?? 0 }
        : isSeen(stored) ? stored : null
    if (prior && merged && tipRef !== 'HEAD' && prior.tip !== tip && prior.path === path) {
      const label = await movedLabel($, root, prior.tip, tip)
      const since = before && before.tip ? '' : 'Since the last session: '
      if (isLoud(lane)) $.ui.toast(since + mergeToast(label, next.id, prior.done, merged.total), { timeoutMs: 15_000 })
    }
    if (merged) await $.store.set(seenKey, { tip, path, done: merged.total.done } satisfies Seen)
    return next
  } catch (err) {
    await update($, progress, old => ({
      ...(old ?? blank('', sessionLane ?? 'HUB', readAt)), readAt, isBusy: false, error: message(err),
    }))
    const p = await read($, progress)
    if (p && isLoud(p.lane)) $.ui.status(statusLine(p))
    return p
  } finally {
    isRefreshing = false
  }
}

function isSeen(value: unknown): value is Seen {
  const v = value as Partial<Seen> | null | undefined
  return typeof v?.tip === 'string' && typeof v.path === 'string' && typeof v.done === 'number'
}

/** Asks origin whether its default branch moved; reads again when it did, or the working tree when `local`. */
async function poll($: EngineInterface, local: boolean): Promise<void> {
  const at = await $.clock.now()
  if (isRefreshing || at - lastPollAt < TURN_GAP_MS) return
  lastPollAt = at
  const p = await read($, progress)
  if (p === null || p.tipRef === 'HEAD' || p.base === '') {
    if (local) await refresh($, { fetch: false })
    return
  }
  let remote = ''
  try {
    const out = await git($, p.root, ['ls-remote', 'origin', `refs/heads/${p.base}`], 20_000)
    remote = out.trim().split(/\s+/)[0] ?? ''
  } catch {
    remote = '' // offline: try again next time
  }
  if (remote !== '' && remote !== p.tip) await refresh($, { fetch: true })
  else if (local) await refresh($, { fetch: false })
}

// ---- words ------------------------------------------------------------------

/** A bar of `width` cells, never empty while anything is ticked and never full while anything is open. */
export function barCells(done: number, total: number, width: number): number {
  if (total <= 0 || width <= 0) return 0
  let filled = Math.round((done / total) * width)
  if (done > 0 && filled === 0) filled = 1
  if (done < total && filled === width) filled = width - 1
  return Math.max(0, Math.min(width, filled))
}

function bar(done: number, total: number, width: number): string {
  const filled = barCells(done, total, width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function percent(done: number, total: number): number {
  return total <= 0 ? 0 : Math.floor((done / total) * 100)
}

/** The toast a move of origin's tip raises. */
export function mergeToast(label: string, id: string, before: number, after: BoxCount): string {
  const total = boxes(after)
  const left = toGo(after)
  const delta = after.done - before
  const counts =
    delta === 0
      ? `${id} unchanged: ${after.done} of ${total}`
      : `${id}: ${before} → ${after.done} of ${total} (${delta > 0 ? '+' : ''}${delta})`
  return `🔀 ${label} — ${counts} · ${left === 0 ? '🎉 every box ticked' : `${left} to go`}`
}

/** The status line under the prompt. */
export function statusLine(p: Progress): string {
  if (p.error !== null && p.merged === null && p.local === null) return '📐 phase unread'
  const c = p.merged ?? p.local
  if (c === null) return p.isBusy ? '📐 reading…' : '📐 phase unread'
  const total = boxes(c.total)
  if (total > 0 && toGo(c.total) === 0) return `📐 ${p.id} ✅ all ${total} ticked`
  return `📐 ${p.id} ${bar(c.total.done, total, 10)} ${c.total.done}/${total} · ${toGo(c.total)} to go`
}

function summary(p: Progress | null): string {
  if (p === null) return 'Phase progress: nothing read yet.'
  if (p.error !== null && p.merged === null && p.local === null) return `Phase progress: ${p.error}`
  const c = p.merged ?? p.local
  if (c === null || p.path === null) return 'Phase progress: nothing counted.'
  const where = p.merged ? `on origin/${p.base}` : `on this branch (${p.branch}) — not on origin/${p.base} yet`
  const gates = c.total.gates > 0 ? `; 🚦 ${c.total.gatesDone} of ${c.total.gates} verdict gates ticked` : ''
  const others = p.phases.length > 1 ? ` Other phases here: ${p.phases.filter(f => f !== p.phase).join(', ')}.` : ''
  return (
    `Phase progress · ${p.id} (${p.path}, ${p.reason}): ${c.total.done} of ${boxes(c.total)} boxes ticked ${where} — ` +
    `${toGo(c.total)} to go${gates}.${p.warning ? ` ${p.warning}` : ''}${others}`
  )
}

function clip(text: string, width: number): string {
  return text.length > width ? text.slice(0, Math.max(0, width - 1)) + '…' : text
}

// ---- hooks ----------------------------------------------------------------

export const register: Register = (on, options) => {
  hubOption = typeof options.hub === 'string' ? options.hub : ''

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'phase-progress',
      description: 'How far the current phase is from done — re-read now. "/phase-progress 5" pins a phase, "auto" unpins',
      argumentHint: '[phase | auto]',
    })
    const where = await locate($).catch(() => null)
    sessionLane = where?.lane ?? null
    if (where !== null && where.lane !== 'HUB') {
      void refresh($, { fetch: true }).then(() => $.ui.open({ id: PANE, title: TITLE }))
      timer?.cancel()
      timer = $.clock.every(POLL_MS, () => void poll($, false))
    }
    return next(e)
  })

  on('command.run', { command: 'phase-progress' }, async ($, e) => {
    const arg = e.args.trim()
    const where = await locate($)
    if (where !== null && arg !== '') {
      if (arg === 'auto') await $.store.delete(`pin:${where.mainRoot}`)
      else await $.store.set(`pin:${where.mainRoot}`, arg)
    }
    if (!isWoken && where !== null && where.lane === 'HUB') {
      isWoken = true
      timer?.cancel()
      timer = $.clock.every(POLL_MS, () => void poll($, false))
    }
    const p = await refresh($, { fetch: true })
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    return { text: summary(p) }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && sessionLane !== null && isLoud(sessionLane)) void poll($, true)
    return next(e)
  })

  // a merge, pull or fetch the session ran itself: read again once it is done
  const MERGE_COMMAND = /\b(?:gh\s+pr\s+merge|git\s+(?:merge|pull|fetch))\b/
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    if (MERGE_COMMAND.test(e.command)) void refresh($, { fetch: true })
    return result
  }).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'PowerShell' }, async ($, e, next) => {
    const result = await next(e)
    if (MERGE_COMMAND.test(e.command)) void refresh($, { fetch: true })
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = await read($, progress)
    const width = Math.max(24, e.props.bodyColumns)
    const inner = width - 4 // a card's border and its one cell of padding, each side
    const isInline = e.props.placement === 'inline'
    const c = p?.merged ?? p?.local ?? null
    const total = c ? boxes(c.total) : 0
    const left = c ? toGo(c.total) : 0
    const barWidth = Math.max(10, Math.min(48, inner - 8))
    const filled = c ? barCells(c.total.done, total, barWidth) : 0
    const isDone = c !== null && total > 0 && left === 0
    const openSections = c?.sections.filter(s => toGo(s.count) > 0) ?? []
    const doneSections = c?.sections.filter(s => toGo(s.count) === 0 && boxes(s.count) > 0) ?? []
    const shown = isInline ? openSections.slice(0, INLINE_ROWS) : openSections
    const when = p ? p.readAt.slice(11, 16) + ' UTC' : ''
    const diff = p?.merged && p.local && p.branch !== p.base ? p.local.total.done - p.merged.total.done : 0
    const added = p?.merged && p.local && p.branch !== p.base ? boxes(p.local.total) - boxes(p.merged.total) : 0

    return (
      <Box flexDirection="column" gap={1} width={width}>
        {/* header: what, where, when, and the two actions */}
        <Box gap={1} flexWrap="wrap">
          <Text bold>📐 {TITLE}</Text>
          {p?.id ? <Text bold inverse> {p.id} </Text> : null}
          <Text dimColor>
            {p?.isBusy ? 'reading…' : p ? `${p.tipRef === 'HEAD' ? 'HEAD' : `origin/${p.base}`} ${p.tip.slice(0, 7)} · read ${when}` : 'not read yet'}
          </Text>
          <Button key="refresh" label="Refresh" hotkey="r" onPress={() => void refresh($, { fetch: true })} />
          <Button key="close" label="Close" role="dismiss" onPress={() => void $.ui.close({ id: PANE })} />
        </Box>

        {p?.error ? (
          <Box key="error" borderStyle="round" borderColor="error" paddingX={1}>
            <Text color="error">🔴 {p.error}</Text>
          </Box>
        ) : null}

        {/* card 1: the phase as a bar */}
        {c && p ? (
          <Box key="phase" flexDirection="column" borderStyle="round" borderColor={isDone ? 'success' : 'claude'} paddingX={1}>
            <Text bold>{clip(c.title || p.phase || '', inner)}</Text>
            <Text dimColor>{clip(`${p.path} — ${p.reason}`, inner)}</Text>
            <Box key="bar" marginTop={1}>
              <Text color="success">{'█'.repeat(filled)}</Text>
              <Text dimColor>{'░'.repeat(barWidth - filled)}</Text>
              <Text bold> {percent(c.total.done, total)} %</Text>
            </Box>
            <Box key="numbers" gap={1} flexWrap="wrap">
              <Text>{c.total.done} of {total} boxes ticked</Text>
              <Text dimColor>·</Text>
              {isDone ? (
                <Text bold color="success">🎉 every box ticked — the phase closes on the owner's word</Text>
              ) : (
                <Text bold color="warning">{left} to go</Text>
              )}
              {c.total.gates > 0 ? <Text dimColor>·</Text> : null}
              {c.total.gates > 0 ? (
                <Text {...(c.total.gatesDone === c.total.gates ? { color: 'success' } : {})}>
                  🚦 {c.total.gatesDone} of {c.total.gates} verdict gates ticked
                </Text>
              ) : null}
            </Box>
            {c.total.partial > 0 || c.total.setAside > 0 ? (
              <Text dimColor>
                {c.total.partial > 0 ? `${c.total.partial} marked partial (counted as to go)` : ''}
                {c.total.partial > 0 && c.total.setAside > 0 ? ' · ' : ''}
                {c.total.setAside > 0 ? `${c.total.setAside} struck through (not counted)` : ''}
              </Text>
            ) : null}
            {p.merged === null && p.local !== null ? (
              <Text color="suggestion">🌿 Only on this branch ({p.branch}) — not on origin/{p.base} yet.</Text>
            ) : null}
            {diff > 0 ? (
              <Text color="suggestion">🌿 {p.branch}: +{diff} ticked here, not merged yet{added !== 0 ? ` (${added > 0 ? '+' : ''}${added} boxes)` : ''}</Text>
            ) : null}
            {diff < 0 ? (
              <Text color="warning">🌿 {p.branch} is {-diff} tick{diff === -1 ? '' : 's'} behind origin/{p.base} — pull to catch up</Text>
            ) : null}
            {diff === 0 && added !== 0 ? (
              <Text color="suggestion">🌿 {p.branch}: {added > 0 ? '+' : ''}{added} boxes here, not merged yet</Text>
            ) : null}
            {p.warning ? <Text color="warning">⚠ {clip(p.warning, inner - 2)}</Text> : null}
          </Box>
        ) : null}

        {/* card 2: what is left, section by section */}
        {c && openSections.length > 0 ? (
          <Box key="open" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
            <Box justifyContent="space-between">
              <Text bold>🔲 Still open</Text>
              <Text dimColor>{openSections.length} of {openSections.length + doneSections.length} sections</Text>
            </Box>
            {shown.map((s, i) => {
              const n = boxes(s.count)
              const isStarted = s.count.done > 0
              return (
                <Box key={`open-${i}`} justifyContent="space-between" gap={1}>
                  <Text>
                    {isStarted ? '🟡' : '🔲'} {clip(s.heading, Math.max(8, inner - 20))}
                  </Text>
                  <Text dimColor>
                    {bar(s.count.done, n, 6)} {s.count.done}/{n}
                  </Text>
                </Box>
              )
            })}
            {openSections.length > shown.length ? (
              <Text dimColor>  … +{openSections.length - shown.length} more — ctrl+x tab, then ↑↓ to scroll</Text>
            ) : null}
            {doneSections.length > 0 ? (
              <Text color="success">✅ {doneSections.length} section{doneSections.length === 1 ? '' : 's'} complete</Text>
            ) : null}
          </Box>
        ) : null}

        {/* card 3: the merges that moved it */}
        {p && p.history.length > 0 ? (
          <Box key="merges" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
            <Box justifyContent="space-between">
              <Text bold>🔀 Merges into {p.base}</Text>
              <Text dimColor>the last {p.history.length} that changed this phase</Text>
            </Box>
            {(isInline ? p.history.slice(0, 3) : p.history).map((m, i) => (
              <Box key={`merge-${i}`} justifyContent="space-between" gap={1}>
                <Text>
                  <Text dimColor>{m.at.slice(5, 10)} </Text>
                  {m.pr !== null ? <Text bold>#{m.pr} </Text> : null}
                  {clip(m.title, Math.max(8, inner - 30))}
                </Text>
                <Text>
                  <Text {...(m.delta > 0 ? { color: 'success' } : m.delta < 0 ? { color: 'warning' } : { dimColor: true })}>
                    {m.delta > 0 ? `+${m.delta}` : String(m.delta)}
                  </Text>
                  <Text dimColor> → {m.done}/{m.total}</Text>
                </Text>
              </Box>
            ))}
          </Box>
        ) : null}

        <Text dimColor>r refresh · /phase-progress 5 pins a phase, auto unpins · origin is checked every minute</Text>
      </Box>
    )
  })
}
