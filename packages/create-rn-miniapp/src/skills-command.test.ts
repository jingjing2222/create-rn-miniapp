import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { getTestPackageManagerField } from './test-support/package-manager.js'
import { copyDirectory } from './templates/index.js'
import {
  diffSkillsWorkspace,
  parseSkillsCommandArgs,
  syncSkillsWorkspace,
  upgradeSkillsWorkspace,
} from './skills-command.js'

async function createTempWorkspace(t: test.TestContext) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-skills-command-'))
  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })
  return targetRoot
}

async function writeWorkspaceFixture(targetRoot: string) {
  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })
  await writeFile(
    path.join(targetRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'ebook-miniapp',
        private: true,
        packageManager: getTestPackageManagerField('pnpm'),
      },
      null,
      2,
    ),
    'utf8',
  )
  await writeFile(
    path.join(targetRoot, 'frontend', 'granite.config.ts'),
    [
      "import { appsInToss } from '@apps-in-toss/framework/plugins'",
      "import { defineConfig } from '@granite-js/react-native/config'",
      '',
      'export default defineConfig({',
      '  appName: "ebook-miniapp",',
      '  plugins: [',
      '    appsInToss({',
      '      brand: {',
      '        displayName: "전자책 미니앱",',
      '      },',
      '    }),',
      '  ],',
      '})',
      '',
    ].join('\n'),
    'utf8',
  )
}

test('parseSkillsCommandArgs parses sync and upgrade options', async () => {
  const syncArgs = await parseSkillsCommandArgs(['sync', '--root-dir', '/tmp/miniapp'])
  const upgradeArgs = await parseSkillsCommandArgs([
    'upgrade',
    '--root-dir',
    '/tmp/miniapp',
    '--to',
    'latest',
  ])

  assert.deepEqual(syncArgs, {
    command: 'sync',
    rootDir: '/tmp/miniapp',
    to: undefined,
  })
  assert.deepEqual(upgradeArgs, {
    command: 'upgrade',
    rootDir: '/tmp/miniapp',
    to: 'latest',
  })
})

test('syncSkillsWorkspace bootstraps manual extras from an existing managed skill snapshot', async (t) => {
  const targetRoot = await createTempWorkspace(t)
  const backofficeSkillSource = fileURLToPath(
    new URL('../../agent-skills/backoffice-react', import.meta.url),
  )

  await writeWorkspaceFixture(targetRoot)
  await mkdir(path.join(targetRoot, '.agents', 'skills'), { recursive: true })
  await copyDirectory(
    backofficeSkillSource,
    path.join(targetRoot, '.agents', 'skills', 'backoffice-react'),
  )
  await mkdir(path.join(targetRoot, '.agents', 'skills', 'custom-playbook'), { recursive: true })
  await writeFile(
    path.join(targetRoot, '.agents', 'skills', 'custom-playbook', 'SKILL.md'),
    '# Custom\n',
    'utf8',
  )

  await syncSkillsWorkspace(targetRoot)

  const manifest = JSON.parse(
    await readFile(path.join(targetRoot, '.create-rn-miniapp', 'skills.json'), 'utf8'),
  ) as {
    manualExtraSkills: string[]
    resolvedSkills: Array<{ id: string; mode: string }>
  }
  const skillsDoc = await readFile(path.join(targetRoot, 'docs', 'skills.md'), 'utf8')

  assert.deepEqual(manifest.manualExtraSkills, ['backoffice-react'])
  assert.ok(
    manifest.resolvedSkills.some(
      (entry) => entry.id === 'backoffice-react' && entry.mode === 'manual',
    ),
  )
  assert.match(skillsDoc, /`backoffice-react` \(manual\)/)
  assert.equal(
    await readFile(
      path.join(targetRoot, '.agents', 'skills', 'custom-playbook', 'SKILL.md'),
      'utf8',
    ),
    '# Custom\n',
  )
})

test('diffSkillsWorkspace reports pending changes without mutating the workspace', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await writeWorkspaceFixture(targetRoot)
  await syncSkillsWorkspace(targetRoot)

  const mirrorSkillPath = path.join(targetRoot, '.claude', 'skills', 'tds-ui', 'SKILL.md')
  const before = await readFile(mirrorSkillPath, 'utf8')
  await writeFile(mirrorSkillPath, `${before}\n# drift\n`, 'utf8')

  const diff = await diffSkillsWorkspace(targetRoot)

  assert.equal(diff.hasChanges, true)
  assert.match(diff.report, /\.claude\/skills\/tds-ui\/SKILL\.md/)
  assert.match(await readFile(mirrorSkillPath, 'utf8'), /# drift/)
})

test('upgradeSkillsWorkspace fails when the manifest references a removed manual skill id', async (t) => {
  const targetRoot = await createTempWorkspace(t)

  await writeWorkspaceFixture(targetRoot)
  await mkdir(path.join(targetRoot, '.create-rn-miniapp'), { recursive: true })
  await writeFile(
    path.join(targetRoot, '.create-rn-miniapp', 'skills.json'),
    JSON.stringify(
      {
        schema: 1,
        generatorPackage: 'create-miniapp',
        generatorVersion: '0.0.0-test',
        catalogPackage: '@create-rn-miniapp/agent-skills',
        catalogVersion: '0.0.0-test',
        manualExtraSkills: ['removed-manual-skill'],
        resolvedSkills: [],
        customSkillPolicy: 'preserve-unmanaged-siblings',
      },
      null,
      2,
    ),
    'utf8',
  )

  await assert.rejects(
    () => upgradeSkillsWorkspace(targetRoot, 'latest'),
    /manual skill id.*removed-manual-skill/i,
  )
})
