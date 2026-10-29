import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { laneOf, parseHubConfig, parseInbox, parseQueue, sliceNote, statusLine } from './register'

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

const ROADMAP = `# Roadmap

## 🧑‍⚖️ Owner's queue — what waits on your word

*Every open decision, oldest first.*

**Rulings**

| Since | The question | Recorded in |
|---|---|---|
| 09-04 | Product decisions **D-1** reminder cadence · **D-3** the weekly digest | [open decisions §1](open-decisions.md) |
| 10-07 | **API-22 (JOB-8), before Day 1.** Amend the clause? | API-22 \`verification.md\` |
| 09-14 | After X-11: what enters NOW. ↩ ***Due now — X-11 closed 2026-10-08.*** | 🔥 NOW |

**Owner-only actions**

| Since | The action | Recorded in |
|---|---|---|
| 09-04 | X-3: rotate the mail provider's key | X-3 row |

---

## 🆔 How to read an ID

| Since | not a queue row | nowhere |
`

const INBOX = `Hub inbox for HUB (pocket-garden-hub) — read 2026-10-10

  🟡 partial    roadmap.md:357     filed 2026-09-27 (13 d)
      ▶ Hub — inbox: clear the worker's three standing specs-check reds
      pick-up so far: ✅ PICKED UP — (A) only

0 open, 1 partial; 1 picked up and not yet moved out (--all lists them).
`

const PANE = {
  plugin: 'hub-desk',
  component: 'Pane',
  requestId: 'hub-desk',
  props: {
    title: 'Hub desk',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const ran = (stdout: string) => ({
  value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

/** Whether `path` sits under the hub folder `hub`, however the engine spelled it (slashes, case, an absolute form). */
function under(path: string, hub: string): boolean {
  const folder = hub.replace(/[\\/]+$/, '').split(/[\\/]/).pop()!.toLowerCase()
  return path.replace(/\\/g, '/').toLowerCase().includes(`/${folder}/`)
}

/** The hub's files: hub.json and tools/inbox.py at `hub`, and `roadmap` for every other read. */
function hubFiles(on: On, hub: string, roadmap = ROADMAP, hubJson = HUB_JSON): void {
  on('fs.exists', (_, e) => ({ value: under(e.path, hub) && (e.path.endsWith('hub.json') || e.path.endsWith('inbox.py')) }))
  on('fs.read', (_, e) => ({ value: e.path.endsWith('hub.json') ? hubJson : roadmap }))
}

test('hub.json names the repos, and a folder name gives its lane; the hub and a stranger are HUB', async () => {
  const cfg = parseHubConfig(HUB_JSON)
  expect(cfg.repos.map(r => r.prefix)).toEqual(['WEB', 'API', 'JOB'])
  expect(laneOf(cfg, 'garden-api')).toBe('API')
  expect(laneOf(cfg, 'Garden-Worker')).toBe('JOB') // the folder's case does not matter
  expect(laneOf(cfg, 'pocket-garden-hub')).toBe('HUB')
  expect(laneOf(cfg, 'some-other-repo')).toBe('HUB')
  expect(laneOf(null, 'garden-api')).toBe('HUB') // no hub.json in reach: the lane cannot be known
  expect(() => parseHubConfig('{"product":{"name":"x"}}')).toThrow(/no "repos" list/)
  expect(() => parseHubConfig('{"repos":[{"name":"no-prefix"}]}')).toThrow(/"prefix" and a "name"/)
})

test('parseQueue reads the two tables and stops at the next heading', async () => {
  const items = parseQueue(ROADMAP)
  expect(items).toHaveLength(4)
  expect(items[0]).toEqual({
    kind: 'ruling',
    since: '09-04',
    text: 'Product decisions D-1 reminder cadence · D-3 the weekly digest',
    where: 'open decisions §1',
  })
  expect(items[1]?.text).toBe('API-22 (JOB-8), before Day 1. Amend the clause?')
  expect(items[2]?.text).toBe('After X-11: what enters NOW. ↩ Due now — X-11 closed 2026-10-08.')
  expect(items[3]?.kind).toBe('action')
})

test('parseInbox reads one note per status line, with its title and partial pick-up', async () => {
  const inbox = parseInbox(INBOX)
  expect(inbox.open).toBe(0)
  expect(inbox.partial).toBe(1)
  expect(inbox.notes).toHaveLength(1)
  expect(inbox.notes[0]).toEqual({
    state: 'partial',
    where: 'roadmap.md:357',
    filed: '2026-09-27',
    age: 13,
    title: "Hub — inbox: clear the worker's three standing specs-check reds",
    pickup: '(A) only',
  })
  expect(parseInbox('Hub inbox for API (garden-api) — read 2026-10-10\n\n0 open, 0 partial.\n').notes).toHaveLength(0)
})

test('Refresh reads the inbox and the queue from the hub and the pane shows both', async ($, on) => {
  mock.clock(on)
  const argvs: string[][] = []
  const statuses: (string | undefined)[] = []
  on('ui.status', (_, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('session.root', () => ({ value: 'C:/hub' }))
  on('session.repo', () => ({ value: { root: 'C:/hub', remote: null, internal: false, name: null } }))
  hubFiles(on, 'C:/hub')
  on('process.run', (_, e) => {
    argvs.push([...e.argv])
    return ran(INBOX)
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') {
      // nothing read yet: the state is empty until the first Refresh, and it then outlives a remount
      expect(await ui.find({ type: 'Text', text: /0 rulings/ })).toBeDefined()
    }

    await ui.press({ key: 'refresh' })

    expect(await ui.find({ type: 'Text', text: /Inbox for HUB/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /0 open · 1 partial/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Owner's queue/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /3 rulings · 1 owner-only actions/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /Due now/ }))?.props.color).toBe('warning')
    // the note: a coloured status tag, its age, and its title on the next line
    expect((await ui.find({ type: 'Text', text: /PARTIAL/ }))?.props.color).toBe('suggestion')
    expect(await ui.find({ type: 'Text', text: /13 d old/ })).toBeDefined()
    expect((await ui.find({ key: 'note-0' }))?.text).toMatch(/clear the worker's three standing/) // the title is a button
    expect(await ui.find({ type: 'Text', text: /picked up: \(A\) only/ })).toBeDefined()
    // the queue: the date in the margin, the question beside it; "Due now" rows stand out
    expect(await ui.find({ type: 'Text', text: /^Rulings$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Product decisions D-1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Owner-only actions$/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^X-3: rotate/ }))?.props.bold).toBeUndefined()
    await ui.unmount()
  }

  expect(argvs[0]?.[0]).toBe('python')
  expect(argvs[0]?.[2]).toBe('HUB')
  // the status line under the prompt counts the open and partial notes
  expect(statuses.pop()).toBe('📬 1 waiting')
})

test('in a code repo the lane is what hub.json gives its folder, found through the "hub" option; a worktree reads as its repository', { options: { hub: 'C:/hub' } }, async ($, on) => {
  mock.clock(on)
  const argvs: string[][] = []
  on('ui.status', () => ({ value: undefined }))
  on('session.root', () => ({ value: 'C:/work/garden-api-wt' })) // a worktree of garden-api
  on('session.repo', () => ({ value: { root: 'C:/work/garden-api', remote: 'origin-url', internal: false, name: null } }))
  hubFiles(on, 'C:/hub')
  on('process.run', (_, e) => {
    argvs.push([...e.argv])
    return ran('Hub inbox for API (garden-api) — read 2026-10-10\n\n0 open, 0 partial.\n')
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /Inbox for API/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /0 open · 0 partial/ })).toBeDefined()
  expect(argvs[0]?.[1]).toBe('C:/hub/tools/inbox.py')
  expect(argvs[0]?.[2]).toBe('API')
  await ui.unmount()
})

test('statusLine says what the inbox holds, or why it could not be read', async () => {
  const base = { repo: 'HUB', hub: '/hub', readAt: '2026-10-10T14:02:00.000Z', queue: [], error: null, isBusy: false }
  expect(statusLine({ ...base, inbox: { lines: [], notes: [], open: 2, partial: 1 } })).toBe('📬 3 waiting')
  expect(statusLine({ ...base, inbox: { lines: [], notes: [], open: 0, partial: 0 } })).toBe('📬 0 waiting')
  expect(statusLine({ ...base, inbox: null })).toBe('📬 inbox unread')
  expect(statusLine({ ...base, inbox: null, isBusy: true })).toBe('📬 reading…')
  expect(statusLine({ ...base, hub: '', inbox: null })).toBe('📬 hub not found')
})

test('without a hub checkout the pane says so instead of failing, and the lane is unknown', async ($, on) => {
  mock.clock(on)
  const statuses: (string | undefined)[] = []
  on('ui.status', (_, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('session.root', () => ({ value: 'C:/somewhere/garden-api' }))
  on('session.repo', () => ({ value: null }))
  on('fs.exists', () => ({ value: false }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })

  expect(await ui.find({ type: 'Text', text: /Set the "hub" option/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Inbox for HUB/ })).toBeDefined() // no hub.json, so no lane to name
  expect(statuses.pop()).toBe('📬 hub not found')
  await ui.unmount()
})

test('a hub.json that does not parse is reported, not swallowed', async ($, on) => {
  mock.clock(on)
  const statuses: (string | undefined)[] = []
  on('ui.status', (_, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('session.root', () => ({ value: 'C:/broken-hub' }))
  on('session.repo', () => ({ value: null }))
  hubFiles(on, 'C:/broken-hub', ROADMAP, '{ not json')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /hub\.json could not be read/ })).toBeDefined()
  expect(statuses.pop()).toBe('📬 hub not found')
  await ui.unmount()
})

test('inline above the prompt the queue is cut to a few rows with a "+n more" line; docked it is whole', async ($, on) => {
  mock.clock(on)
  const many = Array.from({ length: 8 }, (_, i) => `| 09-0${(i % 9) + 1} | Question ${i + 1} | somewhere |`).join('\n')
  const roadmap = ROADMAP.replace('**Owner-only actions**', many + '\n\n**Owner-only actions**')
  on('session.root', () => ({ value: '/hub' }))
  on('session.repo', () => ({ value: null }))
  hubFiles(on, '/hub', roadmap)
  on('process.run', () => ran(INBOX))

  const inline = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, placement: 'inline' } })
  await inline.press({ key: 'refresh' })
  expect(await ui_find(inline, /11 rulings/)).toBeDefined()
  expect(await ui_find(inline, /\+6 more/)).toBeDefined()
  expect(await ui_find(inline, /^Question 8$/)).toBeUndefined()
  await inline.unmount()

  const dock = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui_find(dock, /\+6 more/)).toBeUndefined()
  expect(await ui_find(dock, /^Question 8$/)).toBeDefined()
  await dock.unmount()
})

function ui_find(ui: { find: (q: { type?: string; text?: RegExp }) => Promise<unknown> }, text: RegExp) {
  return ui.find({ type: 'Text', text })
}

test('sliceNote takes a note from its heading to the next heading', async () => {
  const text = ['# Roadmap', '', '### ▶ Hub — inbox: one', '', 'body one', '', '#### ✅ PICKED UP — kept, a 4th-level heading', '', '### ▶ Hub — inbox: two', 'body two'].join('\n')
  expect(sliceNote(text, 3)).toBe('### ▶ Hub — inbox: one\n\nbody one\n\n#### ✅ PICKED UP — kept, a 4th-level heading')
  expect(sliceNote(text, 9)).toBe('### ▶ Hub — inbox: two\nbody two')
  expect(sliceNote(text, 99)).toBe('')
})

test('pressing a note title opens its text, read from the roadmap at that line, in the note pane', async ($, on) => {
  mock.clock(on)
  const lines = ROADMAP.split('\n')
  while (lines.length < 356) lines.push('')
  lines.push(
    "### ▶ Hub — inbox: clear the worker's three standing specs-check reds",
    '',
    '*Written 2026-09-27 by the worker session.*',
    '',
    'The body of the note.',
    '',
    '## The next heading',
    '',
    'Not part of the note.',
  )
  const roadmap = lines.join('\n')
  expect(roadmap.split('\n')[356]).toMatch(/^### ▶ Hub/) // line 357, as the inbox fixture says
  const filled: string[] = []
  on('session.root', () => ({ value: '/hub' }))
  on('session.repo', () => ({ value: null }))
  hubFiles(on, '/hub', roadmap)
  on('process.run', () => ran(INBOX))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  const opened: string[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const desk = await $.ui.mount({ ...PANE, surface })
    await desk.press({ key: 'refresh' })
    expect((await desk.find({ key: 'note-0' }))?.props.hotkey).toBe('1')
    await desk.press({ key: 'note-0' })
    expect(opened.pop()).toBe('hub-desk-note')

    const pane = await $.ui.mount({ ...PANE, surface, requestId: 'hub-desk-note', props: { ...PANE.props, title: 'Inbox note' } })
    expect(await pane.find({ type: 'Text', text: /roadmap\.md:357/ })).toBeDefined()
    const md = await pane.find({ type: 'Markdown' })
    expect(md?.props.text).toContain('The body of the note.')
    expect(md?.props.text).not.toContain('Not part of the note.')

    await pane.press({ key: 'to-prompt' })
    expect(filled.pop()).toContain('Pick up the inbox note at .claude/context/roadmap.md:357')
    await pane.unmount()
    await desk.unmount()
  }
})
