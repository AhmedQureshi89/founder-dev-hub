import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import {
  barCells,
  boxes,
  countBoxes,
  foldersFor,
  hintsFromBranch,
  laneOf,
  lanesOf,
  mergeToast,
  parseHubConfig,
  parseLog,
  pullRequestOf,
  statusLine,
  toGo,
} from './register'

const FENCE = '```'

/** The kit's example hub.json: a product called Pocket Garden, three code repos, one contributor. */
const HUB_JSON = JSON.stringify({
  kit: { name: 'founder-dev-hub', version: '0.1.0' },
  example: true,
  product: { name: 'Pocket Garden', one_line: 'a web platform that reminds people to water their plants and shows them what it noticed' },
  owner: { name: 'Sam', github: 'sam-example', git_email: 'sam@example.com' },
  hub: { name: 'pocket-garden-hub', github: 'sam-example/pocket-garden-hub', default_branch: 'main' },
  repos: [
    { prefix: 'WEB', name: 'garden-web', what: 'the web app people use', github: 'sam-example/garden-web', path: '../garden-web', default_branch: 'main' },
    { prefix: 'API', name: 'garden-api', what: 'the API and the database', github: 'sam-example/garden-api', path: '../garden-api', default_branch: 'main' },
    { prefix: 'JOB', name: 'garden-worker', what: 'the background jobs that send the reminders', github: 'sam-example/garden-worker', path: '../garden-worker', default_branch: 'main' },
  ],
  ids: { cross: 'X', decision: 'D', known_issue: 'KI' },
  contributors: [{ name: 'Alex', github: 'alex-example', git_email: 'alex@example.com', branch_prefix: 'alex/' }],
  checks: { forbidden_spellings: ['PocketGarden', 'Pocket garden'] },
})
/** The hub checkout, and the worker repo's checkout beside it. */
const HUB = 'C:/work/pocket-garden-hub'
const WORKER = 'C:/work/garden-worker'
const LANES = lanesOf(parseHubConfig(HUB_JSON))

/** Phase 5 as origin/main holds it at tip A: 4 of 9 ticked. */
const AT_A = `# Phase 5 Verification — A Reminder Engine

## 0. How to read this file

${FENCE}
- [ ] an example inside a fence, not a check
${FENCE}

<!--
- [ ] a commented-out box
-->

## 1. Before anything is built — REQ-5.12

- [x] 🚦 **REQ-5.12 (VERDICT GATE — no retry):** watering times for two plants
  - [x] recorded per call
  - [x] the schedule's delay

## 2. The engine — REQ-5.1, 5.4

### REQ-5.1 — readings in

- [x] timeframes parse
- [ ] the call
> - [ ] an amendment's box, inside a quote

### REQ-5.4 — values only, in CI

- [ ] runs in CI
- [~] the word list is written in the test
- [ ] ~~struck: a record kept on purpose~~

## 8. After the swap

- [ ] 🚦 **🚦-2 (VERDICT GATE — no retry):** no advice anywhere
`

/** One merge earlier: the gate and its two checks ticked, nothing else. */
const AT_A0 = AT_A.replace('- [x] timeframes parse', '- [ ] timeframes parse')

/** Tip B, after #42: "the call" and "runs in CI" ticked too — 6 of 9. */
const AT_B = AT_A.replace('- [ ] the call', '- [x] the call').replace('- [ ] runs in CI', '- [x] runs in CI')

const PANE = {
  plugin: 'phase-progress',
  component: 'Pane',
  requestId: 'phase-progress',
  props: {
    title: 'Phase progress',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const ok = (stdout: string) => ({
  value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})
const fail = (stderr = 'fatal') => ({
  value: { exitCode: 128, stdout: '', stderr, isStdoutTruncated: false, isStderrTruncated: false },
})
const record = (sha: string, at: string, subject: string, body = '') => `\x1e${sha}\x1f${at}\x1f${subject}\x1f${body}\n`

type Repo = {
  branch: string
  base: string
  tip: string
  /** `rev:path` → the file at that revision. */
  blobs: Record<string, string>
  /** verification.md paths at the tip, newest change first. */
  phases: string[]
  /** `tip` → the first-parent log of the phase file, newest first. */
  history: Record<string, string>
  /** `from..to` → the commits between. */
  ranges: Record<string, string>
  /** verification.md files the branch adds, not on the tip. */
  added?: string[]
  ran: string[][]
}

/** Answers the git commands the mod runs, from `repo`. */
function gitMock(on: On, repo: Repo): void {
  on('process.run', (_, e) => {
    const argv = [...e.argv]
    repo.ran.push(argv)
    const [cmd, ...args] = argv.slice(1)
    const a = args.join(' ')
    if (argv[0] !== 'git') return fail('not git')
    if (cmd === 'rev-parse' && a === '--abbrev-ref HEAD') return ok(repo.branch + '\n')
    if (cmd === 'symbolic-ref') return fail('')
    if (cmd === 'rev-parse' && a === `--verify --quiet refs/remotes/origin/${repo.base}`) return ok(repo.tip + '\n')
    if (cmd === 'rev-parse' && a.startsWith('--verify --quiet refs/remotes/origin/')) return fail('')
    if (cmd === 'fetch') return ok('')
    if (cmd === 'ls-tree') return ok([...repo.phases, 'specs/phase-5/specs.md', 'specs/archive/phase-1/verification.md'].join('\n') + '\n')
    if (cmd === 'merge-base') return ok(repo.tip + '\n')
    if (cmd === 'diff') return ok((repo.added ?? []).join('\n'))
    if (cmd === 'ls-files') return ok('')
    if (cmd === 'log' && args.includes('--name-only')) {
      return ok(repo.phases.map((p, i) => `@${1000 - i}\n\n${p}\n`).join(''))
    }
    if (cmd === 'log' && args[0]?.includes('..')) return ok(repo.ranges[args[0]] ?? '')
    if (cmd === 'log') return ok(repo.history[args[0] ?? ''] ?? '')
    if (cmd === 'show') {
      const blob = repo.blobs[args[0] ?? '']
      return blob === undefined ? fail(`fatal: path does not exist in ${args[0]}`) : ok(blob)
    }
    return fail(`unexpected: git ${a}`)
  })
}

/** Whether `path` sits under the hub folder `hub`, however the engine spelled it (slashes, case, an absolute form). */
function under(path: string, hub: string): boolean {
  const folder = hub.replace(/[\\/]+$/, '').split(/[\\/]/).pop()!.toLowerCase()
  return path.replace(/\\/g, '/').toLowerCase().includes(`/${folder}/`)
}

/** The files the mod reads: hub.json at `hub` (nowhere, when null), and `verification` for every other read. */
function files(on: On, hub: string | null, verification: (path: string) => string): void {
  on('fs.exists', (_, e) => ({ value: hub !== null && under(e.path, hub) && e.path.endsWith('hub.json') }))
  on('fs.read', (_, e) => ({ value: e.path.endsWith('hub.json') ? HUB_JSON : verification(e.path) }))
}

/** A session in the worker repo's checkout, its origin on GitHub. */
function workerSession(on: On): void {
  on('session.root', () => ({ value: WORKER }))
  on('session.repo', () => ({
    value: { root: WORKER, remote: 'https://github.com/sam-example/garden-worker.git', internal: false, name: null },
  }))
}

function workerRepo(): Repo {
  const path = 'specs/phase-5/verification.md'
  return {
    branch: 'job-5/req-5.6-the-swap',
    base: 'main',
    tip: 'aaaa000000000000000000000000000000000000',
    phases: [path, 'specs/phase-10/verification.md'],
    blobs: {
      [`aaaa000000000000000000000000000000000000:${path}`]: AT_A,
      [`a0a0000000000000000000000000000000000000:${path}`]: AT_A0,
      [`bbbb000000000000000000000000000000000000:${path}`]: AT_B,
    },
    history: {
      aaaa000000000000000000000000000000000000:
        record('aaaa000000000000000000000000000000000000', '2026-10-11T21:36:56+00:00', 'Merge pull request #41 from sam-example/job-5/req-5.11', 'REQ-5.11: the check-in') +
        record('a0a0000000000000000000000000000000000000', '2026-10-09T10:00:00+00:00', 'Merge pull request #40 from sam-example/job-5/req-5.12', 'REQ-5.12: P-0 taken'),
      bbbb000000000000000000000000000000000000:
        record('bbbb000000000000000000000000000000000000', '2026-10-12T09:00:00+00:00', 'Merge pull request #42 from sam-example/job-5/req-5.6', 'REQ-5.6: the swap') +
        record('aaaa000000000000000000000000000000000000', '2026-10-11T21:36:56+00:00', 'Merge pull request #41 from sam-example/job-5/req-5.11', 'REQ-5.11: the check-in') +
        record('a0a0000000000000000000000000000000000000', '2026-10-09T10:00:00+00:00', 'Merge pull request #40 from sam-example/job-5/req-5.12', 'REQ-5.12: P-0 taken'),
    },
    ranges: {
      'aaaa000000000000000000000000000000000000..bbbb000000000000000000000000000000000000':
        record('bbbb000000000000000000000000000000000000', '2026-10-12T09:00:00+00:00', 'Merge pull request #42 from sam-example/job-5/req-5.6', 'REQ-5.6: the swap'),
    },
    ran: [],
  }
}

test('countBoxes counts ticked, open, partial and struck boxes, and the verdict gates, per section', async () => {
  const c = countBoxes(AT_A)
  expect(c.title).toBe('A Reminder Engine')
  expect(c.total).toEqual({ done: 4, open: 4, partial: 1, setAside: 1, gates: 2, gatesDone: 1 })
  expect(boxes(c.total)).toBe(9) // the fenced and commented boxes are examples; the struck one is a record
  expect(toGo(c.total)).toBe(5)
  expect(c.sections.map(s => [s.heading, s.count.done, boxes(s.count)])).toEqual([
    ['1. Before anything is built — REQ-5.12', 3, 3],
    ['REQ-5.1 — readings in', 1, 3],
    ['REQ-5.4 — values only, in CI', 0, 2],
    ['8. After the swap', 0, 1],
  ])
  expect(countBoxes('- [x] one\r\n- [ ] two\r\n').sections[0]?.heading).toBe('Before the first heading')
})

test('hub.json names the lanes: a folder gets its repo’s prefix; the hub and a stranger are HUB', async () => {
  const cfg = parseHubConfig(HUB_JSON)
  expect(LANES).toEqual({ prefixes: ['WEB', 'API', 'JOB', 'X', 'HUB'], cross: 'X' })
  expect(laneOf(cfg, 'garden-worker')).toBe('JOB')
  expect(laneOf(cfg, 'Garden-Web')).toBe('WEB') // the folder's case does not matter
  expect(laneOf(cfg, 'pocket-garden-hub')).toBe('HUB')
  expect(laneOf(cfg, 'some-other-repo')).toBe('HUB')
  expect(laneOf(null, 'garden-api')).toBe('HUB') // no hub.json in reach: the lane cannot be known
  expect(lanesOf(null)).toEqual({ prefixes: ['X', 'HUB'], cross: 'X' })
  expect(() => parseHubConfig('{"product":{"name":"x"}}')).toThrow(/no "repos" list/)
})

test('the branch names the phase, with the lane prefixes hub.json gives; a number finds its folder, or the folders that start with it', async () => {
  expect(hintsFromBranch('job-5/req-5.2-9kot3u', LANES)).toEqual(['5', '5.2'])
  expect(hintsFromBranch('api-4.7/leg4-hosting-references', LANES)).toEqual(['4.7'])
  expect(hintsFromBranch('claude/req-5-13-ring-standby-cd473b', LANES)).toEqual(['5.13', '5'])
  expect(hintsFromBranch('alex/web-23-chart-colours', LANES)).toEqual(['23'])
  expect(hintsFromBranch('x-11/the-funnel', LANES)).toEqual(['11']) // the cross-repo prefix is a lane too
  expect(hintsFromBranch('ag-5/not-a-lane-here', LANES)).toEqual([]) // a prefix hub.json does not list is not one
  expect(hintsFromBranch('claude/dev-progress-tracking-mod-6d91d4', LANES)).toEqual([])
  expect(hintsFromBranch('main', LANES)).toEqual([])

  const web = ['phase-21.0', 'phase-21.1', 'phase-21.2', 'phase-23', 'phase-5']
  expect(foldersFor('5', web, LANES)).toEqual(['phase-5'])
  expect(foldersFor('21', web, LANES)).toEqual(['phase-21.0', 'phase-21.1', 'phase-21.2'])
  expect(foldersFor('WEB-21.2', web, LANES)).toEqual(['phase-21.2'])
  expect(foldersFor('5.13', web, LANES)).toEqual([])
  const hub = ['phase-8-access', 'phase-x21-fan-out']
  expect(foldersFor('8', hub, LANES)).toEqual(['phase-8-access'])
  expect(foldersFor('21', hub, LANES)).toEqual(['phase-x21-fan-out'])
  expect(foldersFor('X-21', hub, LANES)).toEqual(['phase-x21-fan-out'])
  // a hub whose cross-repo prefix is not X names its cross-repo phase folders with its own letter
  expect(foldersFor('21', ['phase-c21-fan-out'], lanesOf({ repos: [], cross: 'C' }))).toEqual(['phase-c21-fan-out'])
})

test('merge commits name their pull request; a direct commit names none', async () => {
  const log = parseLog(record('abc', '2026-10-11T21:36:56+00:00', 'Merge pull request #42 from sam-example/claude/x', 'REQ-5.13 sealed\n\nmore'))
  expect(log).toHaveLength(1)
  expect(pullRequestOf(log[0]!.subject, log[0]!.body)).toEqual({ pr: 42, title: 'REQ-5.13 sealed' })
  expect(pullRequestOf('Merge pull request #12 from me/branch', '')).toEqual({ pr: 12, title: 'me/branch' })
  expect(pullRequestOf('WEB-21: roll back the expiry (#136)', '')).toEqual({ pr: 136, title: 'WEB-21: roll back the expiry' })
  expect(pullRequestOf('JOB-5: REQ-5.13 sealed', '')).toEqual({ pr: null, title: 'JOB-5: REQ-5.13 sealed' })
})

test('the bar is never empty while anything is ticked, never full while anything is open', async () => {
  expect(barCells(0, 116, 10)).toBe(0)
  expect(barCells(1, 116, 10)).toBe(1)
  expect(barCells(115, 116, 10)).toBe(9)
  expect(barCells(116, 116, 10)).toBe(10)
  expect(barCells(0, 0, 10)).toBe(0)
  const after = countBoxes(AT_B).total
  expect(mergeToast('#42 merged', 'JOB-5', 4, after)).toBe('🔀 #42 merged — JOB-5: 4 → 6 of 9 (+2) · 3 to go')
  expect(mergeToast('2 new commits', 'JOB-5', 6, after)).toBe('🔀 2 new commits — JOB-5 unchanged: 6 of 9 · 3 to go')
  const all = { ...after, done: 9, open: 0, partial: 0 }
  expect(mergeToast('#43 merged', 'JOB-5', 6, all)).toBe('🔀 #43 merged — JOB-5: 6 → 9 of 9 (+3) · 🎉 every box ticked')
})

test('a code repo: the pane shows the phase on origin, what is left, the merges — and a merge raises a toast', { options: { hub: HUB } }, async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  mock.store(on)
  const repo = workerRepo()
  const statuses: (string | undefined)[] = []
  const toasts: string[] = []
  on('ui.status', (_, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  workerSession(on)
  files(on, HUB, () => AT_B) // this branch already ticks what #42 will bring
  gitMock(on, repo)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'refresh' })

    expect(await ui.find({ type: 'Text', text: /^ JOB-5 $/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^A Reminder Engine$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /named by the branch job-5\/req-5\.6-the-swap/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^4 of 9 boxes ticked$/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^5 to go$/ }))?.props.color).toBe('warning')
    expect(await ui.find({ type: 'Text', text: /🚦 1 of 2 verdict gates ticked/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1 marked partial .* · 1 struck through/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\+2 ticked here, not merged yet/ })).toBeDefined()
    // what is left, section by section; the finished one folded into a count
    expect(await ui.find({ type: 'Text', text: /🟡 REQ-5\.1 — readings in/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /🔲 REQ-5\.4 — values only, in CI/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /3 of 4 sections/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /✅ 1 section complete/ })).toBeDefined()
    // the merges that moved it, newest first, each with the ticks it brought
    expect(await ui.find({ type: 'Text', text: /^#41 $/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^\+1$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^\+3$/ })).toBeDefined()
    // hub.json was found, so no warning about the lane
    expect(await ui.find({ type: 'Text', text: /lane unknown/ })).toBeUndefined()
    await ui.unmount()
  }

  expect(statuses.pop()).toBe('📐 JOB-5 ████░░░░░░ 4/9 · 5 to go')
  expect(repo.ran.some(argv => argv[1] === 'fetch' && argv.includes('main'))).toBe(true)
  // the first read of a session has nothing to compare with yet
  expect(toasts).toEqual([])

  // #42 merges on GitHub: origin/main moves to B
  repo.tip = 'bbbb000000000000000000000000000000000000'
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(toasts).toEqual(['🔀 #42 merged — JOB-5: 4 → 6 of 9 (+2) · 3 to go'])
  expect(statuses.pop()).toBe('📐 JOB-5 ███████░░░ 6/9 · 3 to go')
  expect(await ui.find({ type: 'Text', text: /^6 of 9 boxes ticked$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^#42 $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ticked here, not merged yet/ })).toBeUndefined() // the branch is merged now
  await ui.unmount()
})

test('a new session tells the merges made since the last one in this repository', { options: { hub: HUB } }, async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  // the last session here left off at tip A, with 4 ticked
  mock.store(on, { [`seen:${WORKER}`]: { tip: 'aaaa000000000000000000000000000000000000', path: 'specs/phase-5/verification.md', done: 4 } })
  const repo = workerRepo()
  repo.tip = 'bbbb000000000000000000000000000000000000'
  const toasts: string[] = []
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  workerSession(on)
  files(on, HUB, () => AT_B)
  gitMock(on, repo)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(toasts).toEqual(['Since the last session: 🔀 #42 merged — JOB-5: 4 → 6 of 9 (+2) · 3 to go'])
  await ui.unmount()
})

test('a pin wins over the branch', { options: { hub: HUB } }, async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  mock.store(on, { [`pin:${WORKER}`]: '10' })
  const repo = workerRepo()
  const phase10 = '# Phase 10 Verification — The weekly digest\n\n## G4\n\n- [x] one\n- [ ] two\n'
  repo.blobs['aaaa000000000000000000000000000000000000:specs/phase-10/verification.md'] = phase10
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  workerSession(on)
  files(on, HUB, path => (path.includes('phase-10') ? phase10 : AT_A))
  gitMock(on, repo)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /^ JOB-10 $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /pinned with \/phase-progress 10/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^1 of 2 boxes ticked$/ })).toBeDefined()
  await ui.unmount()
})

test('a pin that names no phase here falls back to the branch and says so; a checkout behind origin says so', { options: { hub: HUB } }, async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  mock.store(on, { [`pin:${WORKER}`]: '99' })
  const repo = workerRepo()
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  workerSession(on)
  files(on, HUB, () => AT_A0) // this checkout is one merge behind origin
  gitMock(on, repo)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /^ JOB-5 $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /The pinned phase "99" is not here/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /is 1 tick behind origin\/main — pull to catch up/ })).toBeDefined()
  await ui.unmount()
})

test('a phase this branch adds is counted from the working tree, and says it is not merged', { options: { hub: HUB } }, async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  mock.store(on)
  const repo = workerRepo()
  repo.branch = 'job-16/triad'
  repo.added = ['specs/phase-16/verification.md']
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  workerSession(on)
  files(on, HUB, () => '# Phase 16 Verification — JOB-16\n\n## R3\n\n- [ ] one\n- [ ] two\n')
  gitMock(on, repo)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /^ JOB-16 $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^0 of 2 boxes ticked$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Only on this branch \(job-16\/triad\) — not on origin\/main yet/ })).toBeDefined()
  await ui.unmount()
})

test('in the hub it draws on request but leaves the status line alone, and picks the phase changed last with boxes open', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  mock.store(on)
  const statuses: (string | undefined)[] = []
  on('ui.status', (_, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('session.root', () => ({ value: HUB }))
  on('session.repo', () => ({ value: { root: HUB, remote: 'origin-url', internal: false, name: null } }))
  const done = '# Phase X21 Verification — fan-out\n\n## Gates\n\n- [x] one\n- [x] two\n'
  const open = '# Phase 8 Verification — access rules\n\n## Gates\n\n- [ ] one\n- [ ] two\n- [x] three\n'
  const tip = 'cccc000000000000000000000000000000000000'
  const repo: Repo = {
    branch: 'main', base: 'main', tip,
    phases: ['.claude/context/phase-x21-fan-out/verification.md', '.claude/context/phase-8-access/verification.md'],
    blobs: {
      [`${tip}:.claude/context/phase-x21-fan-out/verification.md`]: done,
      [`${tip}:.claude/context/phase-8-access/verification.md`]: open,
    },
    history: {}, ranges: {}, ran: [],
  }
  files(on, HUB, () => open) // hub.json sits at the session's own root
  gitMock(on, repo)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /^ phase-8-access $/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /changed last on main, with boxes still open/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^1 of 3 boxes ticked$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /lane unknown/ })).toBeUndefined()
  expect(statuses).toEqual([])
  await ui.unmount()
})

test('with no hub.json in reach a code repo reads as HUB: quiet, drawn on request, and the pane says to set the Hub checkout option', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  mock.store(on)
  const repo = workerRepo()
  const statuses: (string | undefined)[] = []
  on('ui.status', (_, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  workerSession(on)
  files(on, null, () => AT_A) // no "hub" option, and no hub.json in the worker's checkout
  gitMock(on, repo)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /^ phase-5 $/ })).toBeDefined() // no lane to prefix the id with
  expect(await ui.find({ type: 'Text', text: /No hub\.json found — set the Hub checkout option/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^4 of 9 boxes ticked$/ })).toBeDefined()
  expect(statuses).toEqual([]) // read as HUB, it keeps off the status line
  await ui.unmount()
})

test('statusLine: the bar, all ticked, or why nothing was read', async () => {
  const base = {
    root: '/r', lane: 'JOB', branch: 'main', base: 'main', tipRef: 'refs/remotes/origin/main', tip: 'a',
    readAt: '2026-10-12T10:00:00.000Z', phase: 'phase-5', id: 'JOB-5', path: 'specs/phase-5/verification.md',
    reason: '', local: null, history: [], phases: [], warning: null, error: null, isBusy: false,
  }
  const all = countBoxes('# P\n\n## S\n\n- [x] a\n- [x] b\n')
  expect(statusLine({ ...base, merged: all })).toBe('📐 JOB-5 ✅ all 2 ticked')
  expect(statusLine({ ...base, merged: countBoxes(AT_A) })).toBe('📐 JOB-5 ████░░░░░░ 4/9 · 5 to go')
  expect(statusLine({ ...base, merged: null, error: 'boom' })).toBe('📐 phase unread')
})
