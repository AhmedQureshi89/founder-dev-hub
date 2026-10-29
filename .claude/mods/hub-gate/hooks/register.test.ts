import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { GIT_COMMIT_OR_PUSH, isProtected, parseContributors, relativeTo } from './register'

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

/** The owner: the full write set. */
const OWNER = 'sam@example.com'
/** A contributor hub.json lists: held to a contributor's write set. */
const CONTRIBUTOR = 'alex@example.com'

const GREEN = 'hub — specs-check\n\n  ✓ R6   markers\n  ✓ R10h links\n\n  3 passed, 0 failed, 0 skipped\n'
const RED = 'hub — specs-check\n\n  ✓ R6   markers\n  ✗ R10h every relative .md link resolves\n      CLAUDE.md:12 → .claude/nowhere.md\n\n  2 passed, 1 failed, 0 skipped\n'

type Ran = { exitCode: number; stdout: string; stderr: string; isStdoutTruncated: false; isStderrTruncated: false }
const ran = (exitCode: number, stdout: string): Ran => ({ exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

/** The world beneath the mod: a hub at C:/hub holding `hubJson`, a checker that answers `check`, a git identity `who`. */
function world(on: On, check: string, who: string, hubJson = HUB_JSON) {
  const calls: string[][] = []
  on('session.root', () => ({ value: 'C:/hub' }))
  on('session.repo', () => ({ value: null }))
  on('fs.exists', (_, e) => ({ value: e.path.endsWith('specs_check.py') || e.path.endsWith('hub.json') }))
  on('fs.read', (_, e) => ({ value: e.path.endsWith('hub.json') ? hubJson : '' }))
  on('process.run', (_, e) => {
    calls.push([...e.argv])
    if (e.argv[0] === 'git') return { value: ran(0, who + '\n') }
    return { value: ran(check === GREEN ? 0 : 1, check) }
  })
  on('tool.call', () => ({ result: { stdout: 'ran', stderr: '', interrupted: false } }))
  return calls
}

test('the patterns: which commands are gated and which paths are protected', async () => {
  for (const cmd of ['git commit -m "x"', 'git -C C:/hub commit -q -F -', 'git push -u origin main', 'cd x && git add -A && git commit -m y'])
    expect(GIT_COMMIT_OR_PUSH.test(cmd)).toBe(true)
  for (const cmd of ['git status', 'git log --oneline -3', 'git commit-tree', 'gh pr merge 16 --merge', 'echo commit'])
    expect(GIT_COMMIT_OR_PUSH.test(cmd)).toBe(false)

  expect(relativeTo('C:/hub', 'C:\\hub\\CLAUDE.md')).toBe('CLAUDE.md')
  expect(relativeTo('C:/hub', 'C:/hub/.claude/context/roadmap.md')).toBe('.claude/context/roadmap.md')
  expect(relativeTo('C:/hub', 'tools/inbox.py')).toBe('tools/inbox.py')
  expect(relativeTo('C:/hub', 'C:/elsewhere/CLAUDE.md')).toBe(null)

  for (const p of ['CLAUDE.md', '.claude/context/x.md', '.claude/briefs/x-20.md', 'tools/specs_check.py', '.github/workflows/ci.yml', 'drizzle/0014_x.sql', 'shared/schema.ts', 'Dockerfile.azure'])
    expect(isProtected(p)).toBe(true)
  for (const p of ['README.md', 'specs/phase-5/requirements.md', 'src/app.ts', 'tests/x.test.ts', '.claude/settings.local.json'])
    expect(isProtected(p)).toBe(false)
})

test('parseContributors reads hub.json: emails lowercased, the branch prefix defaulted, rows without an email skipped', async () => {
  expect(parseContributors(HUB_JSON)).toEqual([{ email: 'alex@example.com', branchPrefix: 'alex/' }])
  expect(parseContributors(JSON.stringify({ contributors: [{ git_email: 'Pat@Example.com' }, { name: 'no email' }] }))).toEqual([
    { email: 'pat@example.com', branchPrefix: 'contributor/' },
  ])
  expect(parseContributors('{"repos":[]}')).toEqual([])
})

test('a commit is held while specs-check is red, and the reason carries the red lines', async ($, on) => {
  const calls = world(on, RED, OWNER)
  const out = await $.tool.call({ tool: 'Bash', command: 'git commit -m "x"', tool_use_id: 't1' })
  expect(out.deny).toContain('specs-check is red')
  expect(out.deny).toContain('R10h')
  expect(calls.some(c => c.includes('--hub'))).toBe(true)
})

test('a commit runs once specs-check is green; other git commands never run the check', async ($, on) => {
  const calls = world(on, GREEN, OWNER)
  const out = await $.tool.call({ tool: 'Bash', command: 'git commit -m "x"', tool_use_id: 't2' })
  expect(out.deny).toBeUndefined()
  expect(calls.filter(c => c.some(a => a.endsWith('specs_check.py')))).toHaveLength(1)

  await $.tool.call({ tool: 'Bash', command: 'git status --short', tool_use_id: 't3' })
  expect(calls.filter(c => c.some(a => a.endsWith('specs_check.py')))).toHaveLength(1)
})

test('under a contributor’s identity a protected path is refused, naming their branch prefix, and an ordinary one is not', async ($, on) => {
  world(on, GREEN, CONTRIBUTOR)
  const held = await $.tool.call({ tool: 'Edit', file_path: 'C:/hub/CLAUDE.md', old_string: 'a', new_string: 'b', tool_use_id: 't4' })
  expect(held.deny).toContain("CLAUDE.md is outside a contributor's write set")
  expect(held.deny).toContain('commits as alex@example.com')
  expect(held.deny).toContain('on a alex/<id>-… branch by pull request')
  const fine = await $.tool.call({ tool: 'Write', file_path: 'C:/hub/specs/phase-5/specs.md', content: 'x', tool_use_id: 't5' })
  expect(fine.deny).toBeUndefined()
})

test('under the owner’s identity the same protected path is written', async ($, on) => {
  world(on, GREEN, OWNER)
  const out = await $.tool.call({ tool: 'Edit', file_path: 'C:/hub/CLAUDE.md', old_string: 'a', new_string: 'b', tool_use_id: 't6' })
  expect(out.deny).toBeUndefined()
})

test('an identity hub.json does not list is not held: the guard narrows contributors, nothing else', async ($, on) => {
  world(on, GREEN, 'someone@example.org')
  const out = await $.tool.call({ tool: 'Edit', file_path: 'C:/hub/CLAUDE.md', old_string: 'a', new_string: 'b', tool_use_id: 't7' })
  expect(out.deny).toBeUndefined()
})

test('a hub.json that does not parse turns the write-set guard off and says so once', async ($, on) => {
  const statuses: (string | undefined)[] = []
  on('ui.status', (_, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  world(on, GREEN, CONTRIBUTOR, '{ not json')
  const out = await $.tool.call({ tool: 'Edit', file_path: 'C:/hub/CLAUDE.md', old_string: 'a', new_string: 'b', tool_use_id: 't8' })
  expect(out.deny).toBeUndefined()
  expect(statuses.pop()).toMatch(/hub\.json could not be read.*the write-set guard is off/)
})
