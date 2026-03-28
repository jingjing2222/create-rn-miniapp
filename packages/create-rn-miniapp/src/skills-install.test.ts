import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  buildSkillsInstallCommands,
  hasInstalledProjectSkills,
  listInstalledProjectSkillEntries,
  listInstalledProjectSkills,
  normalizeSelectedSkillIds,
  renderInstalledSkillsSummary,
  renderSkillsAddCommand,
  resolveRecommendedSkillIds,
} from './skills/install.js'
import {
  APPS_IN_TOSS_SKILLS_SOURCE_REPO,
  SKILLS_LIST_COMMAND,
  SKILLS_PROJECT_AGENTS,
  SKILLS_SOURCE_REPO,
} from './skills/contract.js'

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
      'docs-search',
      'project-validator',
      'granite-routing',
      'tds-ui',
      'backoffice-react',
      'cloudflare-worker',
      'trpc-boundary',
    ],
  )
})

test('renderSkillsAddCommand produces the standard npx skills command', () => {
  const expectedCommand = [
    ['npx', 'skills', 'add', APPS_IN_TOSS_SKILLS_SOURCE_REPO]
      .concat(['--skill', 'docs-search', '--skill', 'project-validator'])
      .concat(SKILLS_PROJECT_AGENTS.flatMap((agent) => ['--agent', agent]))
      .concat(['--copy'])
      .join(' '),
    ['npx', 'skills', 'add', SKILLS_SOURCE_REPO]
      .concat(['--skill', 'granite-routing', '--skill', 'tds-ui'])
      .concat(SKILLS_PROJECT_AGENTS.flatMap((agent) => ['--agent', agent]))
      .concat(['--copy'])
      .join(' '),
  ].join('\n')

  assert.equal(
    renderSkillsAddCommand(['docs-search', 'project-validator', 'granite-routing', 'tds-ui']),
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
    packageJson.repository?.url
      ?.replace(/^git\+/, '')
      .replace(/^https:\/\/github\.com\//, '')
      .replace(/\.git$/, ''),
  )
  assert.equal(
    packageJson.repository?.url,
    'git+https://github.com/jingjing2222/create-rn-miniapp.git',
  )
  assert.doesNotMatch(
    skillsContractSource,
    new RegExp(escapeRegExp(`export const SKILLS_SOURCE_REPO = '${SKILLS_SOURCE_REPO}'`)),
  )
})

test('renderInstalledSkillsSummary renders discovered project-local skill paths', () => {
  assert.equal(
    renderInstalledSkillsSummary([
      { id: 'tds-ui', skillsRoot: 'skills' },
      { id: 'granite-routing', skillsRoot: '.agents/skills' },
    ]),
    [
      'skills를 설치했어요.',
      '- granite-routing: `.agents/skills/granite-routing`',
      '- tds-ui: `skills/tds-ui`',
      `필요하면 \`${SKILLS_LIST_COMMAND}\`로 다시 확인해 주세요.`,
    ].join('\n'),
  )
})

test('buildSkillsInstallCommands groups selected skills by source repo and uses the local repo source in development', async () => {
  const targetRoot = '/tmp/ebook-miniapp'
  const commands = await buildSkillsInstallCommands({
    packageManager: 'pnpm',
    targetRoot,
    skillIds: ['docs-search', 'project-validator', 'granite-routing', 'tds-ui'],
  })

  assert.deepEqual(commands, [
    {
      cwd: targetRoot,
      command: 'pnpm',
      args: [
        'dlx',
        'skills@1.4.5',
        'add',
        APPS_IN_TOSS_SKILLS_SOURCE_REPO,
        '--skill',
        'docs-search',
        '--skill',
        'project-validator',
        '--agent',
        SKILLS_PROJECT_AGENTS[0],
        '--agent',
        SKILLS_PROJECT_AGENTS[1],
        '--copy',
        '-y',
      ],
      label: '추천 agent skills 설치하기',
    },
    {
      cwd: targetRoot,
      command: 'pnpm',
      args: [
        'dlx',
        'skills@1.4.5',
        'add',
        path.resolve(import.meta.dirname, '../../..'),
        '--skill',
        'granite-routing',
        '--skill',
        'tds-ui',
        '--agent',
        SKILLS_PROJECT_AGENTS[0],
        '--agent',
        SKILLS_PROJECT_AGENTS[1],
        '--copy',
        '-y',
      ],
      label: '추천 agent skills 설치하기',
    },
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
