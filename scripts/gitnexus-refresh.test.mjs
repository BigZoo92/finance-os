import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import {
  buildAnalyzeArgs,
  CommandExecutionError,
  refreshGitNexus,
  validateForwardedArgs,
} from './gitnexus-refresh.mjs'

const syncScriptSource = String.raw`import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const events = join(root, 'events.log')
appendFileSync(events, 'sync\n')
const history = readFileSync(events, 'utf8')
if (existsSync(join(root, '.post-sync-fail')) && history.includes('analyze ')) process.exit(9)
const generated = join(root, '.claude', 'skills', 'gitnexus')
if (!existsSync(join(root, '.leave-links'))) rmSync(generated, { recursive: true, force: true })
mkdirSync(join(root, '.claude', 'skills'), { recursive: true })
mkdirSync(join(root, '.agents', 'skills'), { recursive: true })
`

const analyzerScriptSource = String.raw`import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
appendFileSync(join(root, 'events.log'), 'analyze ' + JSON.stringify(process.argv.slice(2)) + '\n')
for (const name of ['AGENTS.md', 'CLAUDE.md']) {
  appendFileSync(join(root, name), '\n<!-- gitnexus:start -->\ngenerated\n<!-- gitnexus:end -->\n')
}
const generated = join(root, '.claude', 'skills', 'gitnexus')
mkdirSync(generated, { recursive: true })
writeFileSync(join(generated, 'generated.txt'), 'generated')
if (existsSync(join(root, '.analyze-fail'))) process.exit(7)
`

const makeFixture = async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'finance-os-gitnexus-refresh-'))
  const gitnexusCli = join(repoRoot, 'fake-gitnexus.mjs')
  const syncScript = join(repoRoot, 'fake-sync.mjs')
  const agents = Buffer.from('# Agents\r\n\r\n\r\nkeep  \r\n')
  const claude = Buffer.from('# Claude\n\n\nkeep\t\n')

  await mkdir(join(repoRoot, '.claude', 'skills'), { recursive: true })
  await mkdir(join(repoRoot, '.agents', 'skills'), { recursive: true })
  await mkdir(join(repoRoot, '.gitnexus'), { recursive: true })
  await writeFile(join(repoRoot, '.gitignore'), '.gitnexus/\n')
  await writeFile(join(repoRoot, 'AGENTS.md'), agents)
  await writeFile(join(repoRoot, 'CLAUDE.md'), claude)
  await writeFile(syncScript, syncScriptSource)
  await writeFile(gitnexusCli, analyzerScriptSource)
  const initialized = spawnSync('git', ['init', '--quiet'], { cwd: repoRoot })
  assert.equal(initialized.status, 0)
  return { repoRoot, gitnexusCli, syncScript, agents, claude }
}

const runFixture = (fixture, forwarded = []) =>
  refreshGitNexus({
    repoRoot: fixture.repoRoot,
    gitnexusCli: fixture.gitnexusCli,
    syncScript: fixture.syncScript,
    forwarded,
  })

test('argument policy rejects paths and unknown or generated-skill flags', () => {
  assert.deepEqual(validateForwardedArgs(['--verbose', '--verbose', '--force']), [
    '--verbose',
    '--force',
  ])
  for (const args of [['../other'], ['--skip-git'], ['--skills'], ['--skills=true']]) {
    assert.throws(() => validateForwardedArgs(args), /Unsupported|intentionally disabled/)
  }
})

test('analyze arguments pin the repository, preserve embeddings, and force dirty or explicit full runs', () => {
  const repoRoot = resolve('fixture-repo')
  assert.deepEqual(buildAnalyzeArgs({ forwarded: [], repoRoot, dirty: true, embeddingCount: 0 }), [
    'analyze',
    '--force',
    repoRoot,
  ])
  assert.deepEqual(
    buildAnalyzeArgs({ forwarded: [], repoRoot, dirty: false, embeddingCount: 42 }),
    ['analyze', '--embeddings', repoRoot]
  )
  assert.deepEqual(
    buildAnalyzeArgs({ forwarded: ['--embeddings'], repoRoot, dirty: false, embeddingCount: 0 }),
    ['analyze', '--embeddings', '--force', repoRoot]
  )
})

test('refresh pre-syncs, forces a dirty tree, restores exact instruction bytes, and is idempotent', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  await writeFile(
    join(fixture.repoRoot, '.gitnexus', 'meta.json'),
    JSON.stringify({ stats: { embeddings: 12 } })
  )

  const first = runFixture(fixture, ['--verbose'])
  assert.ok(first.analyzeArgs.includes('--force'))
  assert.ok(first.analyzeArgs.includes('--embeddings'))
  assert.equal(first.analyzeArgs.at(-1), resolve(fixture.repoRoot))
  assert.deepEqual(await readFile(join(fixture.repoRoot, 'AGENTS.md')), fixture.agents)
  assert.deepEqual(await readFile(join(fixture.repoRoot, 'CLAUDE.md')), fixture.claude)
  await assert.rejects(
    () => lstat(join(fixture.repoRoot, '.claude', 'skills', 'gitnexus')),
    /ENOENT/
  )

  runFixture(fixture, ['--verbose'])
  assert.deepEqual(await readFile(join(fixture.repoRoot, 'AGENTS.md')), fixture.agents)
  assert.deepEqual(await readFile(join(fixture.repoRoot, 'CLAUDE.md')), fixture.claude)
  const events = (await readFile(join(fixture.repoRoot, 'events.log'), 'utf8')).trim().split('\n')
  assert.deepEqual(
    events.map(event => event.split(' ', 1)[0]),
    ['sync', 'analyze', 'sync', 'sync', 'analyze', 'sync']
  )
})

test('analyzer failure still restores instruction files and runs the post-sync', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  await writeFile(join(fixture.repoRoot, '.analyze-fail'), '')

  assert.throws(
    () => runFixture(fixture),
    error => error instanceof CommandExecutionError && error.exitCode === 7
  )
  assert.deepEqual(await readFile(join(fixture.repoRoot, 'AGENTS.md')), fixture.agents)
  assert.deepEqual(await readFile(join(fixture.repoRoot, 'CLAUDE.md')), fixture.claude)
  await assert.rejects(
    () => lstat(join(fixture.repoRoot, '.claude', 'skills', 'gitnexus')),
    /ENOENT/
  )
  const events = (await readFile(join(fixture.repoRoot, 'events.log'), 'utf8')).trim().split('\n')
  assert.deepEqual(
    events.map(event => event.split(' ', 1)[0]),
    ['sync', 'analyze', 'sync']
  )
})

test('post-sync failure is reported without masking the analyzer failure', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  await writeFile(join(fixture.repoRoot, '.analyze-fail'), '')
  await writeFile(join(fixture.repoRoot, '.post-sync-fail'), '')

  assert.throws(
    () => runFixture(fixture),
    error =>
      error instanceof AggregateError &&
      error.exitCode === 7 &&
      error.errors.some(item => item.exitCode === 7) &&
      error.errors.some(item => item.exitCode === 9)
  )
  assert.deepEqual(await readFile(join(fixture.repoRoot, 'AGENTS.md')), fixture.agents)
  assert.deepEqual(await readFile(join(fixture.repoRoot, 'CLAUDE.md')), fixture.claude)
})

test('a linked projection child is never exposed to the analyzer', async t => {
  const fixture = await makeFixture()
  const outsideRoot = await mkdtemp(join(tmpdir(), 'finance-os-gitnexus-outside-'))
  const linked = join(fixture.repoRoot, '.claude', 'skills', 'gitnexus')
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  t.after(() => rm(outsideRoot, { recursive: true, force: true }))
  await writeFile(join(outsideRoot, 'outside.txt'), 'keep')
  await writeFile(join(fixture.repoRoot, '.leave-links'), '')
  try {
    await symlink(outsideRoot, linked, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    if (process.platform === 'win32' && error?.code === 'EPERM') {
      return t.skip('Junction privilege unavailable')
    }
    throw error
  }

  assert.throws(() => runFixture(fixture), /must not contain links/)
  assert.equal(await readFile(join(outsideRoot, 'outside.txt'), 'utf8'), 'keep')
  const events = (await readFile(join(fixture.repoRoot, 'events.log'), 'utf8')).trim().split('\n')
  assert.deepEqual(events, ['sync', 'sync'])
  await unlink(linked)
})

test('instruction paths must be physical regular files before any command runs', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  await rm(join(fixture.repoRoot, 'AGENTS.md'))
  await mkdir(join(fixture.repoRoot, 'AGENTS.md'))

  assert.throws(() => runFixture(fixture), /regular file/)
  await assert.rejects(() => readFile(join(fixture.repoRoot, 'events.log')), /ENOENT/)
})
