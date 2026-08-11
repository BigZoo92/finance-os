import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { readCanonicalSkills, reconcileSkills, validatePortableEntryNames } from './sync-skills.mjs'

const skillText = (name, description = `Use for ${name}.`) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`

const makeFixture = async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'finance-os-skills-'))
  const sourceRoot = join(repoRoot, '.agentic', 'source', 'skills')
  const claude = join(repoRoot, '.claude', 'skills')
  const codex = join(repoRoot, '.agents', 'skills')
  await mkdir(join(sourceRoot, 'alpha', 'references'), { recursive: true })
  await mkdir(join(sourceRoot, 'beta'), { recursive: true })
  await writeFile(join(sourceRoot, 'alpha', 'SKILL.md'), skillText('alpha'))
  await writeFile(join(sourceRoot, 'alpha', 'references', 'bytes.bin'), Buffer.from([0, 1, 2, 255]))
  await writeFile(join(sourceRoot, 'beta', 'SKILL.md'), skillText('beta'))
  return { repoRoot, sourceRoot, targets: [claude, codex] }
}

const reconcile = (fixture, write) =>
  reconcileSkills({
    sourceRoot: fixture.sourceRoot,
    targetRoots: fixture.targets,
    allowedTargetRoots: fixture.targets,
    repoRoot: fixture.repoRoot,
    write,
  })

test('sync creates byte-identical Claude and Codex projections and is idempotent', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))

  const first = await reconcile(fixture, true)
  assert.equal(first.skills.length, 2)
  assert.equal(first.targets[0].before.missing.length, 3)
  const claudeSkill = await readFile(join(fixture.targets[0], 'alpha', 'SKILL.md'))
  const codexSkill = await readFile(join(fixture.targets[1], 'alpha', 'SKILL.md'))
  assert.ok(claudeSkill.equals(codexSkill))
  assert.equal(claudeSkill.subarray(0, 4).toString(), '---\n')

  const second = await reconcile(fixture, true)
  for (const target of second.targets) {
    assert.equal(target.before.drifted.length, 0)
    assert.equal(target.before.missing.length, 0)
    assert.equal(target.before.extra.length, 0)
  }
})

test('check derives drift, missing, and extras from source without a manifest', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  await reconcile(fixture, true)

  await writeFile(
    join(fixture.sourceRoot, 'alpha', 'SKILL.md'),
    skillText('alpha', 'Changed canonical description.')
  )
  await rm(join(fixture.targets[0], 'beta', 'SKILL.md'))
  await mkdir(join(fixture.targets[0], 'obsolete'), { recursive: true })
  await writeFile(join(fixture.targets[0], 'obsolete', 'extra.md'), 'extra')

  const checked = await reconcile(fixture, false)
  assert.deepEqual(checked.targets[0].before.drifted, ['alpha/SKILL.md'])
  assert.deepEqual(checked.targets[0].before.missing, ['beta/SKILL.md'])
  assert.deepEqual(checked.targets[0].before.extra, ['obsolete', 'obsolete/extra.md'])
  assert.deepEqual(checked.targets[1].before.drifted, ['alpha/SKILL.md'])

  await reconcile(fixture, true)
  const clean = await reconcile(fixture, false)
  for (const target of clean.targets) {
    assert.equal(target.before.drifted.length, 0)
    assert.equal(target.before.missing.length, 0)
    assert.equal(target.before.extra.length, 0)
  }
})

test('sync removes an extra link without following its target', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  await reconcile(fixture, true)
  const outside = join(fixture.repoRoot, 'outside.txt')
  await writeFile(outside, 'keep')
  try {
    await symlink(outside, join(fixture.targets[0], 'obsolete-link'))
  } catch (error) {
    if (process.platform === 'win32' && error?.code === 'EPERM')
      return t.skip('Symlink privilege unavailable')
    throw error
  }

  const checked = await reconcile(fixture, false)
  assert.deepEqual(checked.targets[0].before.extra, ['obsolete-link'])
  await reconcile(fixture, true)
  assert.equal(await readFile(outside, 'utf8'), 'keep')
})

test('canonical validation requires byte-zero frontmatter, matching name, and a flat physical root', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  await writeFile(
    join(fixture.sourceRoot, 'alpha', 'SKILL.md'),
    `<!-- generated -->\n${skillText('alpha')}`
  )
  await assert.rejects(() => readCanonicalSkills(fixture.sourceRoot), /byte 0/)

  await writeFile(join(fixture.sourceRoot, 'alpha', 'SKILL.md'), skillText('wrong-name'))
  await assert.rejects(() => readCanonicalSkills(fixture.sourceRoot), /equal its directory/)
})

test('canonical validation rejects invalid, duplicated, typed, and oversized YAML scalars', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  const alpha = join(fixture.sourceRoot, 'alpha', 'SKILL.md')

  for (const content of [
    '---\nname: alpha\ndescription: [unterminated\n---\n',
    '---\nname: alpha\nname: wrong\ndescription: duplicate\n---\n',
    '---\nname: alpha\ndescription: 123\n---\n',
    '---\nname: alpha\ndescription: %bad\n---\n',
    '---\nname: alpha\ndescription: .inf\n---\n',
    '---\nname: alpha\ndescription: 0xFF\n---\n',
    '---\nname: alpha\ndescription: bad\u0000value\n---\n',
    '---\nname: alpha\ndescription: "   "\n---\n',
  ]) {
    await writeFile(alpha, content)
    await assert.rejects(() => readCanonicalSkills(fixture.sourceRoot))
  }

  await writeFile(alpha, skillText('alpha', 'x'.repeat(1025)))
  await assert.rejects(() => readCanonicalSkills(fixture.sourceRoot), /at most 1024/)

  await writeFile(alpha, skillText('alpha'))
  const longName = 'a'.repeat(65)
  await mkdir(join(fixture.sourceRoot, longName), { recursive: true })
  await writeFile(join(fixture.sourceRoot, longName, 'SKILL.md'), skillText(longName))
  await assert.rejects(() => readCanonicalSkills(fixture.sourceRoot), /at most 64/)
})

test('canonical entry names remain portable across Linux and Windows', () => {
  assert.doesNotThrow(() =>
    validatePortableEntryNames({ names: ['SKILL.md', 'reference-file.bin'], parent: 'skill' })
  )
  for (const names of [['A.md', 'a.md'], ['CON'], ['COM1.txt'], ['bad?.md'], ['trailing.']]) {
    assert.throws(
      () => validatePortableEntryNames({ names, parent: 'skill' }),
      /not Windows-portable|collide/
    )
  }
})

test('ownership validation rejects targets outside the explicit projection roots', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  const unmanaged = join(fixture.repoRoot, 'other', 'skills')
  await assert.rejects(
    () =>
      reconcileSkills({
        sourceRoot: fixture.sourceRoot,
        targetRoots: [unmanaged],
        allowedTargetRoots: fixture.targets,
        repoRoot: fixture.repoRoot,
        write: true,
      }),
    /unmanaged projection root/
  )
})

test('ownership validation requires an explicit non-empty target allowlist', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  await assert.rejects(
    () =>
      reconcileSkills({
        sourceRoot: fixture.sourceRoot,
        targetRoots: fixture.targets,
        repoRoot: fixture.repoRoot,
        write: true,
      }),
    /allowedTargetRoots is required/
  )
})

test('ownership validation rejects a linked projection root', async t => {
  const fixture = await makeFixture()
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  const linkedRoot = fixture.targets[0]
  const realRoot = join(fixture.repoRoot, 'real-skills')
  await mkdir(realRoot, { recursive: true })
  await mkdir(join(fixture.repoRoot, '.claude'), { recursive: true })
  try {
    await symlink(realRoot, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    if (process.platform === 'win32' && error?.code === 'EPERM')
      return t.skip('Link privilege unavailable')
    throw error
  }
  await assert.rejects(() => reconcile(fixture, false), /symlink or junction/)
})

test('ownership validation rejects a linked projection parent without touching its target', async t => {
  const fixture = await makeFixture()
  const outsideRoot = await mkdtemp(join(tmpdir(), 'finance-os-skills-outside-'))
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  t.after(() => rm(outsideRoot, { recursive: true, force: true }))

  const outsideSkills = join(outsideRoot, 'skills')
  const marker = join(outsideSkills, 'outside-owned.txt')
  await mkdir(outsideSkills, { recursive: true })
  await writeFile(marker, 'keep')
  try {
    await symlink(
      outsideRoot,
      join(fixture.repoRoot, '.claude'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )
  } catch (error) {
    if (process.platform === 'win32' && error?.code === 'EPERM')
      return t.skip('Link privilege unavailable')
    throw error
  }

  await assert.rejects(() => reconcile(fixture, true), /path component/)
  assert.equal(await readFile(marker, 'utf8'), 'keep')
  await assert.rejects(() => readFile(join(outsideSkills, 'alpha', 'SKILL.md')), /ENOENT/)
})

test('all projection roots are preflighted before the first target is changed', async t => {
  const fixture = await makeFixture()
  const outsideRoot = await mkdtemp(join(tmpdir(), 'finance-os-skills-outside-'))
  t.after(() => rm(fixture.repoRoot, { recursive: true, force: true }))
  t.after(() => rm(outsideRoot, { recursive: true, force: true }))

  const firstMarker = join(fixture.targets[0], 'leave-me.txt')
  await mkdir(fixture.targets[0], { recursive: true })
  await writeFile(firstMarker, 'unchanged')
  try {
    await symlink(
      outsideRoot,
      join(fixture.repoRoot, '.agents'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )
  } catch (error) {
    if (process.platform === 'win32' && error?.code === 'EPERM')
      return t.skip('Link privilege unavailable')
    throw error
  }

  await assert.rejects(() => reconcile(fixture, true), /path component/)
  assert.equal(await readFile(firstMarker, 'utf8'), 'unchanged')
  await assert.rejects(() => readFile(join(fixture.targets[0], 'alpha', 'SKILL.md')), /ENOENT/)
})
