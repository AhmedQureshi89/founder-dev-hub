// hub-desk — a pane that shows what the hub holds for this repo.
//
// Two things, both read from the hub checkout and never written:
//   📬 the open `▶ … inbox` notes addressed to this repo, as `tools/inbox.py` lists them;
//   🧑‍⚖️ the owner's queue, the roadmap's opening section — the rulings and owner-only
//      actions that wait on the owner's word.
//
// Which repo this session is — and so whose inbox it reads — comes from `hub.json` at the hub
// root, the one file that names the repos and their id prefixes, matched against the main working
// tree's folder name. Nothing here names a product, a repo or a person.
// Read at session start, after every main-loop turn, on `/hub-desk`, and on Refresh; each
// read also pins "📬 n waiting" — the open and partial notes — as the status line under the prompt.
// A note's title is a button (its number is the hotkey): pressing it opens the note's own
// text, read from the roadmap at that line, in a second pane, with a button that puts
// "pick up this note" into the prompt.
//
// Drawn as two framed cards under a one-line header: each inbox note is a coloured
// status tag, its age, and its title on its own line; each queue row is its date in
// the margin and the question beside it. Inline (above the prompt) the long lists are
// cut to a few rows with a "+n more" line; docked beside the transcript they are whole.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Desk, Inbox, InboxNote, NoteView, QueueItem } from '../types'

const PANE = 'hub-desk'
const TITLE = 'Hub desk'
const NOTE_PANE = 'hub-desk-note'
const NOTE_PANE_TITLE = 'Inbox note'
const HUB_FILE = 'hub.json'
const ROADMAP = '.claude/context/roadmap.md'
const INBOX_TOOL = 'tools/inbox.py'
const QUEUE_HEADING = /^## .*Owner's queue/
/** Rows each queue list shows while the pane sits inline above the prompt. */
const INLINE_ROWS = 5
/** A note or a question older than this is drawn as overdue. */
const OLD_AFTER_DAYS = 30

const desk = atom({ plugin: 'hub-desk', key: 'desk' } as const, null)
const note = atom({ plugin: 'hub-desk', key: 'note' } as const, null)

// ---- paths ----------------------------------------------------------------

function folderName(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
}

function join(dir: string, rel: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.replace(/[\\/]+$/, '') + sep + rel.split('/').join(sep)
}

// ---- hub.json ---------------------------------------------------------------

/** What the desk needs from `hub.json`: the code repos, each with the id prefix that is its lane. */
export type HubConfig = { repos: { prefix: string; name: string }[] }

/** `hub.json`'s text → its repos; throws when the file is not the shape the kit expects. */
export function parseHubConfig(text: string): HubConfig {
  const data = JSON.parse(text) as { repos?: unknown }
  if (!Array.isArray(data.repos)) throw new Error(`${HUB_FILE} has no "repos" list`)
  const repos = data.repos.map((r: unknown) => {
    const o = (r ?? {}) as { prefix?: unknown; name?: unknown }
    if (typeof o.prefix !== 'string' || typeof o.name !== 'string') {
      throw new Error(`${HUB_FILE}: every repo needs a "prefix" and a "name"`)
    }
    return { prefix: o.prefix, name: o.name }
  })
  return { repos }
}

/** The lane of a working tree: the prefix of the repo whose name is its folder; anything else — the hub itself, a stranger — is HUB. */
export function laneOf(cfg: HubConfig | null, folder: string): string {
  const name = folder.toLowerCase()
  return cfg?.repos.find(r => r.name.toLowerCase() === name)?.prefix ?? 'HUB'
}

const configMemo = new Map<string, Promise<HubConfig>>()

/** `hub.json` at `hub`, read once per session; a read that failed is tried again next time. */
function hubConfig($: EngineInterface, hub: string): Promise<HubConfig> {
  let pending = configMemo.get(hub)
  if (pending === undefined) {
    pending = $.fs.read(join(hub, HUB_FILE)).then(text => parseHubConfig(typeof text === 'string' ? text : ''))
    pending.catch(() => configMemo.delete(hub))
    configMemo.set(hub, pending)
  }
  return pending
}

/**
 * Where the hub is — the first of the session's root, the main working tree's root and the "hub"
 * option that holds hub.json and tools/inbox.py — and which repo this session is: the main working
 * tree's folder name, matched against hub.json's repos.
 */
async function locate(
  $: EngineInterface,
  hubOption: string,
): Promise<{ repo: string; hub: string | null; error: string | null }> {
  const root = await $.session.root()
  const repoInfo = await $.session.repo().catch(() => null)
  const mainRoot = repoInfo?.root ?? root
  const candidates = [root, mainRoot, hubOption].filter(p => p.length > 0)
  for (const dir of candidates) {
    if (!(await $.fs.exists(join(dir, HUB_FILE))) || !(await $.fs.exists(join(dir, INBOX_TOOL)))) continue
    try {
      const cfg = await hubConfig($, dir)
      return { repo: laneOf(cfg, folderName(mainRoot)), hub: dir, error: null }
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      return { repo: 'HUB', hub: null, error: `${join(dir, HUB_FILE)} could not be read: ${why}` }
    }
  }
  return { repo: 'HUB', hub: null, error: null }
}

// ---- reading --------------------------------------------------------------

const NOTE_LINE = /^\s{2}(🔲 open|🟡 partial|✅ picked up)\s+(\S+)\s+filed (\S+)(?: \((\d+) d\))?/
const NOTE_TITLE = /^\s{6}▶ (.*)$/
const NOTE_PICKUP = /^\s{6}pick-up so far: (.*)$/

/** The notes in what `inbox.py` printed, one per status line, each with its own lines after it. */
export function parseInbox(stdout: string): Inbox {
  const lines = stdout
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trimEnd())
    .filter((line, i) => i > 0 || !line.startsWith('Hub inbox for')) // the header repeats the pane's own
  while (lines.length > 0 && lines[0] === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  const notes: InboxNote[] = []
  for (const line of lines) {
    const head = NOTE_LINE.exec(line)
    if (head) {
      const mark = head[1] ?? ''
      notes.push({
        state: mark.startsWith('🔲') ? 'open' : mark.startsWith('🟡') ? 'partial' : 'picked up',
        where: head[2] ?? '',
        filed: head[3] ?? '?',
        age: head[4] === undefined ? null : Number(head[4]),
        title: '',
        pickup: null,
      })
      continue
    }
    const last = notes[notes.length - 1]
    if (!last) continue
    const title = NOTE_TITLE.exec(line)
    if (title) last.title = title[1] ?? ''
    const pickup = NOTE_PICKUP.exec(line)
    if (pickup) last.pickup = (pickup[1] ?? '').replace(/^✅ PICKED UP\s*—?\s*/, '')
  }

  const counts = /(\d+) open, (\d+) partial/.exec(stdout)
  return {
    lines,
    notes,
    open: counts ? Number(counts[1]) : notes.filter(n => n.state === 'open').length,
    partial: counts ? Number(counts[2]) : notes.filter(n => n.state === 'partial').length,
  }
}

async function readInbox($: EngineInterface, hub: string, repo: string): Promise<Inbox> {
  const ran = await $.process.run(['python', join(hub, INBOX_TOOL), repo], {
    cwd: hub,
    env: { PYTHONIOENCODING: 'utf-8' },
    timeoutMs: 20_000,
  })
  if (ran.exitCode !== 0) {
    throw new Error(`inbox.py exited ${ran.exitCode}: ${ran.stderr.trim().split('\n').pop() ?? ''}`)
  }
  return parseInbox(ran.stdout)
}

/** Markdown a table cell carries that a one-line pane row does not need. */
function plain(cell: string): string {
  return cell
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](link) → text
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The rows of the two tables under the roadmap's "Owner's queue" heading. */
export function parseQueue(roadmap: string): QueueItem[] {
  const lines = roadmap.replace(/\r/g, '').split('\n')
  const start = lines.findIndex(line => QUEUE_HEADING.test(line))
  if (start < 0) return []
  const items: QueueItem[] = []
  let kind: QueueItem['kind'] | null = null
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    if (/^\*\*Rulings\*\*/.test(line)) kind = 'ruling'
    else if (/^\*\*Owner-only actions\*\*/.test(line)) kind = 'action'
    if (kind === null || !line.startsWith('| ') || /^\| Since \|/.test(line) || /^\|---/.test(line)) continue
    const cells = line.replace(/^\|\s?/, '').replace(/\s?\|$/, '').split(/\s\|\s/)
    if (cells.length < 2) continue
    items.push({
      kind,
      since: plain(cells[0] ?? ''),
      text: plain(cells[1] ?? ''),
      where: plain(cells[2] ?? ''),
    })
  }
  return items
}

async function readQueue($: EngineInterface, hub: string): Promise<QueueItem[]> {
  const text = await $.fs.read(join(hub, ROADMAP))
  return parseQueue(typeof text === 'string' ? text : '')
}

// ---- one note ---------------------------------------------------------------

const ROADMAP_WHERE = /^roadmap\.md:(\d+)$/
const NEXT_HEADING = /^#{2,3} (?!#)/

/** The lines of one roadmap note: from `line` (1-based) up to the next `##` or `###` heading. */
export function sliceNote(text: string, line: number): string {
  const lines = text.replace(/\r/g, '').split('\n')
  const start = Math.max(0, Math.min(line - 1, lines.length))
  let end = start + 1
  while (end < lines.length && !NEXT_HEADING.test(lines[end] ?? '')) end++
  return lines.slice(start, end).join('\n').trim()
}

/** Reads the note's text from the hub and shows it in its own pane. */
async function openNote($: EngineInterface, hub: string, n: InboxNote): Promise<void> {
  const m = ROADMAP_WHERE.exec(n.where)
  const path = m ? ROADMAP : n.where
  const line = m ? Number(m[1]) : 1
  let text: string
  try {
    const raw = await $.fs.read(join(hub, path))
    text = typeof raw === 'string' ? raw : ''
    if (m) text = sliceNote(text, line)
    if (text === '') text = `_Nothing at ${path}:${line} — the roadmap may have moved since the last Refresh._`
  } catch (err) {
    text = `🔴 Could not read ${path}: ${err instanceof Error ? err.message : String(err)}`
  }
  const next: NoteView = { where: n.where, title: n.title, path, line, text }
  await update($, note, () => next)
  await $.ui.open({ id: NOTE_PANE, title: NOTE_PANE_TITLE, focus: true, closeOnEscape: true })
}

let isRefreshing = false

/** One read of both sources into `$.state`; a read already running is left to finish. */
async function refresh($: EngineInterface, hubOption: string): Promise<Desk | null> {
  if (isRefreshing) return read($, desk)
  isRefreshing = true
  const readAt = new Date(await $.clock.now()).toISOString()
  try {
    const { repo, hub, error: whyNotFound } = await locate($, hubOption)
    if (hub === null) {
      const next: Desk = {
        repo, hub: '', readAt, inbox: null, queue: [], isBusy: false,
        error: whyNotFound ?? `No ${HUB_FILE} with ${INBOX_TOOL} under this session's root. Set the "hub" option to your hub checkout.`,
      }
      await update($, desk, () => next)
      $.ui.status(statusLine(next))
      return next
    }
    await update($, desk, old => ({
      repo, hub, readAt, isBusy: true, error: null,
      inbox: old?.inbox ?? null, queue: old?.queue ?? [],
    }))
    const [inbox, queue] = await Promise.allSettled([readInbox($, hub, repo), readQueue($, hub)])
    const errors = [inbox, queue]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
    const next: Desk = {
      repo, hub, readAt, isBusy: false,
      inbox: inbox.status === 'fulfilled' ? inbox.value : null,
      queue: queue.status === 'fulfilled' ? queue.value : [],
      error: errors.length > 0 ? errors.join(' · ') : null,
    }
    await update($, desk, () => next)
    $.ui.status(statusLine(next))
    return next
  } finally {
    isRefreshing = false
  }
}

/** The status line under the prompt: how many inbox notes wait on this repo. */
export function statusLine(d: Desk): string {
  if (d.hub === '') return '📬 hub not found'
  if (d.inbox === null) return d.isBusy ? '📬 reading…' : '📬 inbox unread'
  return `📬 ${d.inbox.open + d.inbox.partial} waiting`
}

function summary(d: Desk | null): string {
  if (d === null) return 'Hub desk: nothing read yet.'
  if (d.error !== null && d.inbox === null && d.queue.length === 0) return `Hub desk: ${d.error}`
  const rulings = d.queue.filter(q => q.kind === 'ruling').length
  const actions = d.queue.length - rulings
  const inbox = d.inbox ? `${d.inbox.open} open, ${d.inbox.partial} partial inbox note(s)` : 'inbox unread'
  return `Hub desk · ${d.repo}: ${inbox}; ${rulings} ruling(s) and ${actions} owner-only action(s) wait on the owner.`
}

// ---- drawing helpers ------------------------------------------------------

function clip(text: string, width: number): string {
  return text.length > width ? text.slice(0, Math.max(0, width - 1)) + '…' : text
}

/** `MM-DD` of the queue → days ago, from the read date; null when it does not parse. */
function daysSince(since: string, readAt: string): number | null {
  const m = /^(\d{2})-(\d{2})$/.exec(since)
  if (!m) return null
  const read = new Date(readAt)
  if (Number.isNaN(read.getTime())) return null
  let at = Date.UTC(read.getUTCFullYear(), Number(m[1]) - 1, Number(m[2]))
  if (at > read.getTime() + 24 * 3600 * 1000) at = Date.UTC(read.getUTCFullYear() - 1, Number(m[1]) - 1, Number(m[2]))
  return Math.max(0, Math.floor((read.getTime() - at) / (24 * 3600 * 1000)))
}

/** The tag an inbox note's state is drawn as. */
const STATE_TAG: Record<InboxNote['state'], { label: string; color: string }> = {
  open: { label: '🔲 OPEN   ', color: 'warning' },
  partial: { label: '🟡 PARTIAL', color: 'suggestion' },
  'picked up': { label: '✅ DONE   ', color: 'success' },
}

// ---- hooks ----------------------------------------------------------------

export const register: Register = (on, options) => {
  const hubOption = typeof options.hub === 'string' ? options.hub : ''

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hub-desk',
      description: 'Open the hub desk: this repo’s inbox notes and the owner’s queue, re-read now',
    })
    void refresh($, hubOption).then(() => $.ui.open({ id: PANE, title: TITLE }))
    return next(e)
  })

  on('command.run', { command: 'hub-desk' }, async $ => {
    const d = await refresh($, hubOption)
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    return { text: summary(d) }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) void refresh($, hubOption)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const d = await read($, desk)
    const repo = d?.repo ?? '…'
    const hub = d?.hub ?? ''
    const width = Math.max(24, e.props.bodyColumns)
    const inner = width - 4 // a card's border and its one cell of padding, each side
    const isInline = e.props.placement === 'inline'
    const cap = isInline ? INLINE_ROWS : Number.POSITIVE_INFINITY
    const rulings = d?.queue.filter(q => q.kind === 'ruling') ?? []
    const actions = d?.queue.filter(q => q.kind === 'action') ?? []
    const notes = d?.inbox?.notes ?? []
    const when = d ? d.readAt.slice(11, 16) + ' UTC' : ''
    const waiting = (d?.inbox?.open ?? 0) + (d?.inbox?.partial ?? 0)

    const queueRow = (q: QueueItem, i: number) => {
      const age = d ? daysSince(q.since, d.readAt) : null
      const isDue = /\bdue now\b/i.test(q.text)
      const isOld = age !== null && age > OLD_AFTER_DAYS
      return (
        <Box key={`${q.kind}-${i}`} gap={1}>
          <Text {...(isDue || isOld ? { color: 'warning' } : { dimColor: true })}>{q.since}</Text>
          <Text {...(isDue ? { bold: true, color: 'warning' } : {})}>{clip(q.text, inner - 6)}</Text>
        </Box>
      )
    }

    const more = (hidden: number) =>
      hidden > 0 ? <Text dimColor>  … +{hidden} more — ctrl+x tab, then ↑↓ to scroll</Text> : null

    return (
      <Box flexDirection="column" gap={1} width={width}>
        {/* header: what, where, when, and the two actions */}
        <Box gap={1} flexWrap="wrap">
          <Text bold>🗂 {TITLE}</Text>
          <Text bold inverse> {repo} </Text>
          <Text dimColor>{d?.isBusy ? 'reading…' : d ? `read ${when}` : 'not read yet'}</Text>
          <Button key="refresh" label="Refresh" hotkey="r" onPress={() => void refresh($, hubOption)} />
          <Button key="close" label="Close" role="dismiss" onPress={() => void $.ui.close({ id: PANE })} />
        </Box>

        {d?.error !== null && d?.error !== undefined && (
          <Box key="error" borderStyle="round" borderColor="error" paddingX={1}>
            <Text color="error">🔴 {d.error}</Text>
          </Box>
        )}

        {/* card 1: the inbox */}
        <Box
          key="inbox"
          flexDirection="column"
          borderStyle="round"
          borderColor={waiting > 0 ? 'warning' : 'subtle'}
          paddingX={1}
        >
          <Box justifyContent="space-between">
            <Text bold>📬 Inbox for {repo}</Text>
            <Text dimColor>{d?.inbox ? `${d.inbox.open} open · ${d.inbox.partial} partial` : ''}</Text>
          </Box>
          {d?.inbox && notes.length === 0 && d.inbox.lines.length === 0 && (
            <Text color="success">✅ Nothing waiting on {repo}</Text>
          )}
          {d?.inbox && notes.length === 0 && d.inbox.lines.length > 0 && d.inbox.lines.map(line => (
            <Text dimColor={line.startsWith('      ')}>{clip(line, inner)}</Text>
          ))}
          {notes.map((n, i) => {
            const tag = STATE_TAG[n.state]
            const isOld = n.age !== null && n.age > OLD_AFTER_DAYS
            return (
              <Box key={`inbox-${i}`} flexDirection="column" marginTop={i === 0 ? 0 : 1}>
                <Box gap={2}>
                  <Text bold color={tag.color}>{tag.label}</Text>
                  <Text {...(isOld ? { color: 'warning' } : { dimColor: true })}>
                    {n.age === null ? `filed ${n.filed}` : `${n.age} d old`}
                  </Text>
                  <Text dimColor>{n.where}</Text>
                </Box>
                <Button
                  key={`note-${i}`}
                  plain
                  {...(i < 9 ? { hotkey: String(i + 1) } : {})}
                  onPress={() => void openNote($, hub, n)}
                >
                  {clip(n.title, inner - 4)}
                </Button>
                {n.pickup !== null && <Text dimColor>  ↳ picked up: {clip(n.pickup, inner - 15)}</Text>}
              </Box>
            )
          })}
        </Box>

        {/* card 2: the owner's queue */}
        <Box key="queue" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
          <Box justifyContent="space-between">
            <Text bold>🧑‍⚖️ Owner's queue</Text>
            <Text dimColor>{rulings.length} rulings · {actions.length} owner-only actions</Text>
          </Box>
          {rulings.length > 0 && <Text bold color="claude">Rulings</Text>}
          {rulings.slice(0, cap).map(queueRow)}
          {more(Math.max(0, rulings.length - cap))}
          {actions.length > 0 && <Text bold color="claude">Owner-only actions</Text>}
          {actions.slice(0, cap).map(queueRow)}
          {more(Math.max(0, actions.length - cap))}
          {d && d.queue.length === 0 && d.error === null && <Text color="success">✅ Nothing waits on the owner</Text>}
        </Box>

        <Text dimColor>r refresh · 1-9 open a note · ↑↓ scroll · Esc back to the prompt · 🟠 date = older than {OLD_AFTER_DAYS} days or due now</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: NOTE_PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const v = await read($, note)
    if (v === null) {
      return (
        <Box>
          <Text dimColor>No note opened yet — press a note's number in the Hub desk.</Text>
        </Box>
      )
    }
    const ref = `${v.path}:${v.line}`
    return (
      <Box flexDirection="column" gap={1} width={Math.max(24, e.props.bodyColumns)}>
        <Box gap={1} flexWrap="wrap">
          <Text bold>📄 {ref}</Text>
          <Button
            key="to-prompt"
            label="Put in prompt"
            hotkey="p"
            onPress={() => void $.prompt.fill({ text: `Pick up the inbox note at ${ref} — ${v.title}`, mode: 'replace' })}
          />
          <Button key="close" label="Close" role="dismiss" onPress={() => void $.ui.close({ id: NOTE_PANE })} />
        </Box>
        <Markdown key="note-text" text={v.text} />
      </Box>
    )
  })
}
