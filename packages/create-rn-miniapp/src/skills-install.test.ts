import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  buildSkillsInstallCommand,
  hasInstalledProjectSkills,
  listInstalledProjectSkillEntries,
  listInstalledProjectSkills,
  normalizeSelectedSkillIds,
  renderInstalledSkillsSummary,
  renderSkillsAddCommand,
  resolveRecommendedSkillIds,
} from './skills/install.js'
import { SKILLS_LIST_COMMAND, SKILLS_SOURCE_REPO } from './skills/contract.js'

function escapeRegExp(source: string) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('normalizeSelectedSkillIds keeps known ids and removes duplicates', () => {
  assert.deepEqual(normalizeSelectedSkillIds(['tds-ui', 'cloudflare-worker', 'tds-ui']), [
    'tds-ui',
    'cloudflare-worker',
  ])
})

test('resolveRecommendedSkillIds returns a flat recommended list for the current topology', () => {
  assert.deepEqual(
    resolveRecommendedSkillIds({
      serverProvider: 'cloudflare',
      hasBackoffice: true,
      hasTrpc: true,
    }),
    [
      'miniapp-capabilities',
      'granite-routing',
      'tds-ui',
      'backoffice-react',
      'cloudflare-worker',
      'trpc-boundary',
    ],
  )
})

test('renderSkillsAddCommand produces the standard npx skills command', () => {
  const expectedCommand = ['npx', 'skills', 'add', SKILLS_SOURCE_REPO]
    .concat(['--skill', 'miniapp-capabilities', '--skill', 'granite-routing', '--skill', 'tds-ui'])
    .concat(['--copy'])
    .join(' ')

  assert.equal(
    renderSkillsAddCommand(['miniapp-capabilities', 'granite-routing', 'tds-ui']),
    expectedCommand,
  )
})

test('skills source repo slug is derived from the published package repository', async () => {
  const packageJson = JSON.parse(
    await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as {
    repository?: { url?: string }
  }
  const skillsContractSource = await readFile(
    fileURLToPath(new URL('./skills/contract.ts', import.meta.url)),
    'utf8',
  )

  assert.equal(
    SKILLS_SOURCE_REPO,
    packageJson.repository?.url?.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, ''),
  )
  assert.equal(packageJson.repository?.url, 'https://github.com/jingjing2222/create-rn-miniapp.git')
  assert.doesNotMatch(
    skillsContractSource,
    new RegExp(escapeRegExp(`export const SKILLS_SOURCE_REPO = '${SKILLS_SOURCE_REPO}'`)),
  )
})

test('renderInstalledSkillsSummary renders discovered project-local skill paths', () => {
  assert.equal(
    renderInstalledSkillsSummary([
      { id: 'tds-ui', skillsRoot: 'skills' },
      { id: 'miniapp-capabilities', skillsRoot: '.agents/skills' },
    ]),
    [
      'project-local skills를 설치했어요.',
      '- miniapp-capabilities: `.agents/skills/miniapp-capabilities`',
      '- tds-ui: `skills/tds-ui`',
      `필요하면 \`${SKILLS_LIST_COMMAND}\`로 다시 확인해 주세요.`,
    ].join('\n'),
  )
})

test('buildSkillsInstallCommand uses the package manager dlx adapter and local repo source in development', async () => {
  const targetRoot = '/tmp/ebook-miniapp'
  const command = await buildSkillsInstallCommand({
    packageManager: 'pnpm',
    targetRoot,
    skillIds: ['miniapp-capabilities', 'tds-ui'],
  })

  assert.ok(command)
  assert.equal(command.cwd, targetRoot)
  assert.equal(command.command, 'pnpm')
  assert.deepEqual(command.args, [
    'dlx',
    'skills@1.4.5',
    'add',
    path.resolve(import.meta.dirname, '../../..'),
    '--skill',
    'miniapp-capabilities',
    '--skill',
    'tds-ui',
    '--copy',
    '-y',
  ])
})

test('project-local skill detection derives installed skills from the standard project skill directories', async (t) => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skills-install-'))

  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })

  await mkdir(path.join(targetRoot, '.agents', 'skills'), { recursive: true })
  await mkdir(path.join(targetRoot, '.claude', 'skills'), { recursive: true })
  await mkdir(path.join(targetRoot, 'skills', 'tds-ui'), { recursive: true })
  await writeFile(path.join(targetRoot, '.agents', 'skills', 'README.md'), 'not a skill\n', 'utf8')
  await writeFile(path.join(targetRoot, '.claude', 'skills', 'notes.txt'), 'mirror note\n', 'utf8')
  await writeFile(path.join(targetRoot, 'skills', 'tds-ui', 'SKILL.md'), '# TDS\n', 'utf8')

  assert.equal(await hasInstalledProjectSkills(targetRoot), true)
  assert.deepEqual(await listInstalledProjectSkills(targetRoot), ['tds-ui'])
  assert.deepEqual(await listInstalledProjectSkillEntries(targetRoot), [
    { id: 'tds-ui', skillsRoot: 'skills' },
  ])
})
