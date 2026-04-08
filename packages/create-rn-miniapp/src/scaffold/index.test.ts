import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  applyDocsTemplates,
  applyRootTemplates,
  pathExists,
  type WorkspaceName,
} from '../templates/index.js'
import { createTemplateTokens } from './helpers.js'
import {
  buildCreateExecutionOrder,
  buildCreateLifecycleOrder,
  buildRootGitSetupPlan,
  buildRootFinalizePlan,
} from './orders.js'

type MigrationCombo = {
  label: string
  serverProvider: 'supabase' | 'cloudflare' | 'firebase' | null
  withBackoffice: boolean
  withTrpc: boolean
}

const EXPECTED_DOCS_TREE = [
  'ai/Decisions.md',
  'ai/Plan.md',
  'ai/Prompt.md',
  'ai/Status.md',
  'engineering/frontend-policy.md',
  'engineering/repo-contract.md',
  'engineering/workspace-topology.md',
  'index.md',
  'product/기능명세서.md',
]

const EXPECTED_SCRIPTS_TREE = ['verify-frontend-routes.mjs']
const REMOVED_ENGINEERING_DOCS = [
  'appsintoss-granite-api-index.md',
  'appsintoss-granite-full-api-index.md',
  'granite-ssot.md',
  'native-modules-policy.md',
  'tds-react-native-index.md',
  '에이전트전략.md',
  '하네스-실행가이드.md',
]

function toPosixPath(filePath: string) {
  return filePath.split(path.sep).join('/')
}

async function createTempTargetRoot(t: test.TestContext) {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-scaffold-'))
  t.after(async () => {
    await rm(targetRoot, { recursive: true, force: true })
  })
  return targetRoot
}

async function listRelativeFiles(root: string, currentDir = ''): Promise<string[]> {
  const absoluteDir = currentDir ? path.join(root, currentDir) : root
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = currentDir ? path.join(currentDir, entry.name) : entry.name

    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(root, relativePath)))
      continue
    }

    files.push(toPosixPath(relativePath))
  }

  return files
}

async function materializeMigrationWorkspace(targetRoot: string, combo: MigrationCombo) {
  const tokens = createTemplateTokens({
    appName: 'ebook-miniapp',
    displayName: '전자책 미니앱',
    packageManager: 'pnpm',
  })
  const workspaces: WorkspaceName[] = ['frontend']

  await mkdir(path.join(targetRoot, 'frontend'), { recursive: true })

  if (combo.serverProvider) {
    await mkdir(path.join(targetRoot, 'server'), { recursive: true })
    workspaces.push('server')

    if (combo.serverProvider === 'supabase') {
      await mkdir(path.join(targetRoot, 'server', 'supabase'), { recursive: true })
      await writeFile(path.join(targetRoot, 'server', 'supabase', 'config.toml'), '', 'utf8')
    }

    if (combo.serverProvider === 'cloudflare') {
      await writeFile(path.join(targetRoot, 'server', 'wrangler.jsonc'), '{}\n', 'utf8')
    }

    if (combo.serverProvider === 'firebase') {
      await writeFile(path.join(targetRoot, 'server', 'firebase.json'), '{}\n', 'utf8')
    }
  }

  if (combo.withTrpc) {
    await mkdir(path.join(targetRoot, 'packages', 'contracts'), { recursive: true })
    await mkdir(path.join(targetRoot, 'packages', 'app-router'), { recursive: true })
    workspaces.push('packages/contracts', 'packages/app-router')
  }

  if (combo.withBackoffice) {
    await mkdir(path.join(targetRoot, 'backoffice'), { recursive: true })
    workspaces.push('backoffice')
  }

  await applyRootTemplates(targetRoot, tokens, workspaces)
  await applyDocsTemplates(targetRoot, tokens)
}

test('buildRootFinalizePlan keeps pnpm root finalize steps minimal', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildRootFinalizePlan({
    targetRoot,
    packageManager: 'pnpm',
    serverProvider: null,
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    ['루트 pnpm 설치하기', '루트 biome로 코드 정리하기'],
  )
  assert.deepEqual(plan[0], {
    cwd: targetRoot,
    command: 'pnpm',
    args: ['install'],
    label: '루트 pnpm 설치하기',
  })
})

test('migration scaffold combinations generate docs, README onboarding, and only the route verify helper by default', async (t) => {
  const combinations: MigrationCombo[] = [
    {
      label: 'base only',
      serverProvider: null,
      withBackoffice: false,
      withTrpc: false,
    },
    {
      label: 'base + backoffice',
      serverProvider: null,
      withBackoffice: true,
      withTrpc: false,
    },
    {
      label: 'base + server-cloudflare',
      serverProvider: 'cloudflare',
      withBackoffice: false,
      withTrpc: false,
    },
    {
      label: 'base + server-supabase',
      serverProvider: 'supabase',
      withBackoffice: false,
      withTrpc: false,
    },
    {
      label: 'base + server-firebase',
      serverProvider: 'firebase',
      withBackoffice: false,
      withTrpc: false,
    },
    {
      label: 'base + trpc',
      serverProvider: 'cloudflare',
      withBackoffice: false,
      withTrpc: true,
    },
  ]

  for (const combo of combinations) {
    const targetRoot = await createTempTargetRoot(t)
    await materializeMigrationWorkspace(targetRoot, combo)

    assert.equal(await pathExists(path.join(targetRoot, 'AGENTS.md')), true, combo.label)
    assert.equal(await pathExists(path.join(targetRoot, 'README.md')), true, combo.label)
    assert.equal(await pathExists(path.join(targetRoot, 'CLAUDE.md')), true, combo.label)
    assert.equal(
      await pathExists(path.join(targetRoot, '.github', 'copilot-instructions.md')),
      true,
      combo.label,
    )
    assert.deepEqual(
      await listRelativeFiles(path.join(targetRoot, 'docs')),
      EXPECTED_DOCS_TREE,
      combo.label,
    )
    assert.deepEqual(
      await listRelativeFiles(path.join(targetRoot, 'scripts')),
      EXPECTED_SCRIPTS_TREE,
      combo.label,
    )

    const agents = await readFile(path.join(targetRoot, 'AGENTS.md'), 'utf8')
    const readme = await readFile(path.join(targetRoot, 'README.md'), 'utf8')

    assert.doesNotMatch(agents, /\.agents\/skills/)
    assert.doesNotMatch(agents, /\.claude\/skills/)
    assert.match(readme, /## skills 전략/)
    assert.match(readme, /npx skills add/)
    assert.equal(await pathExists(path.join(targetRoot, 'docs', 'skills.md')), false, combo.label)
    assert.equal(await pathExists(path.join(targetRoot, '.agents', 'skills')), false, combo.label)
    assert.equal(await pathExists(path.join(targetRoot, '.claude', 'skills')), false, combo.label)
    assert.equal(
      await pathExists(path.join(targetRoot, '.create-rn-miniapp', 'skills.json')),
      false,
      combo.label,
    )

    for (const removedDoc of REMOVED_ENGINEERING_DOCS) {
      assert.equal(
        await pathExists(path.join(targetRoot, 'docs', 'engineering', removedDoc)),
        false,
        `${combo.label}: ${removedDoc}`,
      )
    }
  }
})

test('add scaffold flow does not re-derive manifest topology from filesystem probes', async () => {
  const resolveSource = await readFile(
    fileURLToPath(new URL('../add/phases/resolve.ts', import.meta.url)),
    'utf8',
  )

  assert.match(resolveSource, /resolveAddServerState\(/)
  assert.doesNotMatch(resolveSource, /function buildAddInitialServerState/)
  assert.doesNotMatch(
    resolveSource,
    /trpc: await pathExists\(path\.join\(targetRoot, 'packages', 'contracts'\)\)/,
  )
  assert.doesNotMatch(
    resolveSource,
    /backoffice: await pathExists\(path\.join\(targetRoot, 'backoffice'\)\)/,
  )
})

test('create scaffold flow reuses the tokens resolved up front instead of recomputing them', async () => {
  const scaffoldSource = await readFile(
    fileURLToPath(new URL('../create/phases/scaffold.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(scaffoldSource, /createTemplateTokens\(/)
})

test('create and add finalize phases delegate remote initialization resolution to server project helper', async () => {
  const createFinalizeSource = await readFile(
    fileURLToPath(new URL('../create/phases/finalize.ts', import.meta.url)),
    'utf8',
  )
  const addFinalizeSource = await readFile(
    fileURLToPath(new URL('../add/phases/finalize.ts', import.meta.url)),
    'utf8',
  )
  const serverProjectSource = await readFile(
    fileURLToPath(new URL('../server/project.ts', import.meta.url)),
    'utf8',
  )

  assert.match(serverProjectSource, /resolveFinalRemoteInitializationState\(/)
  assert.doesNotMatch(createFinalizeSource, /function resolveCreateRemoteInitialization/)
  assert.doesNotMatch(addFinalizeSource, /function resolveAddRemoteInitialization/)
})

test('create and add finalize phases delegate final scaffold state assembly to server project helper', async () => {
  const createFinalizeSource = await readFile(
    fileURLToPath(new URL('../create/phases/finalize.ts', import.meta.url)),
    'utf8',
  )
  const addFinalizeSource = await readFile(
    fileURLToPath(new URL('../add/phases/finalize.ts', import.meta.url)),
    'utf8',
  )

  assert.match(createFinalizeSource, /resolveFinalServerScaffoldState\(/)
  assert.match(addFinalizeSource, /resolveFinalServerScaffoldState\(/)
  assert.doesNotMatch(createFinalizeSource, /buildServerScaffoldState\(\{/)
  assert.doesNotMatch(addFinalizeSource, /buildServerScaffoldState\(\{/)
})

test('skill auto-install captures raw copy logs and reports installed skill summary instead', async () => {
  const patchSource = await readFile(
    fileURLToPath(new URL('../create/phases/patch.ts', import.meta.url)),
    'utf8',
  )

  assert.match(patchSource, /runCommandWithOutput\(installCommand\)/)
  assert.match(patchSource, /listInstalledProjectSkillEntries\(ctx\.targetRoot\)/)
  assert.match(patchSource, /renderInstalledSkillsSummary\(/)
  assert.doesNotMatch(patchSource, /runCommand\(installCommand\)/)
  assert.doesNotMatch(patchSource, /ctx\.options\.selectedSkills\.join\('\\n- '\)/)
})

test('skill auto-install re-syncs root frontend policy files after installation succeeds', async () => {
  const patchSource = await readFile(
    fileURLToPath(new URL('../create/phases/patch.ts', import.meta.url)),
    'utf8',
  )

  assert.match(patchSource, /if \(installedSkills\.didInstall\) \{/)
  assert.match(
    patchSource,
    /syncRootFrontendPolicyFiles\(ctx\.targetRoot, ctx\.options\.packageManager\)/,
  )
})

test('skill auto-install downloads tds-ui llms mirrors after installation succeeds', async () => {
  const patchSource = await readFile(
    fileURLToPath(new URL('../create/phases/patch.ts', import.meta.url)),
    'utf8',
  )

  assert.match(patchSource, /syncInstalledSkillArtifacts/)
  assert.match(patchSource, /await syncInstalledSkillArtifacts\(ctx\.targetRoot, \{/)
})

test('skill auto-install tolerates tds-ui mirror download failures only for locally sourced skills', async () => {
  const patchSource = await readFile(
    fileURLToPath(new URL('../create/phases/patch.ts', import.meta.url)),
    'utf8',
  )

  assert.match(patchSource, /resolveLocalSourceSkillIds\(ctx\.options\.selectedSkills\)/)
  assert.match(patchSource, /allowDownloadFailureSkillIds: localSourceSkillIds/)
})

test('skill auto-install does not silently continue when installation or mirror sync fails', async () => {
  const patchSource = await readFile(
    fileURLToPath(new URL('../create/phases/patch.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(patchSource, /추천 agent skills 자동 설치는 건너뛰었어요\./)
  assert.doesNotMatch(patchSource, /필요하면 나중에 직접 실행해 주세요:/)
  assert.doesNotMatch(patchSource, /renderSkillsAddCommand\(/)
  assert.doesNotMatch(patchSource, /catch \(error\)/)
})

test('create skill auto-install defers summary notes until finalize appends provisioning notes first', async () => {
  const patchSource = await readFile(
    fileURLToPath(new URL('../create/phases/patch.ts', import.meta.url)),
    'utf8',
  )
  const finalizeSource = await readFile(
    fileURLToPath(new URL('../create/phases/finalize.ts', import.meta.url)),
    'utf8',
  )

  assert.doesNotMatch(patchSource, /ctx\.notes\.push\(\.\.\.installedSkills\.notes\)/)
  assert.match(patchSource, /installedSkillNotes: installedSkills\.notes/)
  assert.match(
    finalizeSource,
    /ctx\.notes\.push\([\s\S]*maybeFinalizeSupabaseProvisioning[\s\S]*ctx\.notes\.push\(\.\.\.ctx\.installedSkillNotes\)/,
  )
})

test('create and add finalize phases keep root command progress logs visible', async () => {
  const createFinalizeSource = await readFile(
    fileURLToPath(new URL('../create/phases/finalize.ts', import.meta.url)),
    'utf8',
  )
  const addFinalizeSource = await readFile(
    fileURLToPath(new URL('../add/phases/finalize.ts', import.meta.url)),
    'utf8',
  )

  assert.match(createFinalizeSource, /log\.step\(command\.label\)\s+await runCommand\(command\)/)
  assert.match(addFinalizeSource, /log\.step\(command\.label\)\s+await runCommand\(command\)/)
})

test('buildRootFinalizePlan adds yarn sdk generation after root install', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildRootFinalizePlan({
    targetRoot,
    packageManager: 'yarn',
    serverProvider: null,
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    ['루트 yarn 설치하기', '루트 yarn SDK 만들기', '루트 biome로 코드 정리하기'],
  )
  assert.deepEqual(plan[1], {
    cwd: targetRoot,
    command: 'yarn',
    args: ['dlx', '@yarnpkg/sdks@3.2.3', 'base'],
    label: '루트 yarn SDK 만들기',
  })
})

test('buildRootFinalizePlan keeps npm and bun finalize steps minimal', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const npmPlan = buildRootFinalizePlan({
    targetRoot,
    packageManager: 'npm',
    serverProvider: null,
  })
  const bunPlan = buildRootFinalizePlan({
    targetRoot,
    packageManager: 'bun',
    serverProvider: null,
  })

  assert.deepEqual(
    npmPlan.map((step) => step.label),
    ['루트 npm 설치하기', '루트 biome로 코드 정리하기'],
  )
  assert.deepEqual(npmPlan[0], {
    cwd: targetRoot,
    command: 'npm',
    args: ['install'],
    label: '루트 npm 설치하기',
  })
  assert.deepEqual(
    bunPlan.map((step) => step.label),
    ['루트 bun 설치하기', '루트 biome로 코드 정리하기'],
  )
  assert.deepEqual(bunPlan[0], {
    cwd: targetRoot,
    command: 'bun',
    args: ['install'],
    label: '루트 bun 설치하기',
  })
})

test('buildRootFinalizePlan installs stable Deno before biome when Supabase is selected', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildRootFinalizePlan({
    targetRoot,
    packageManager: 'pnpm',
    serverProvider: 'supabase',
  })

  assert.deepEqual(
    plan.map((step) => step.label),
    ['루트 pnpm 설치하기', 'server Deno stable 버전 맞추기', '루트 biome로 코드 정리하기'],
  )
  assert.deepEqual(plan[1], {
    cwd: targetRoot,
    command: 'pnpm',
    args: ['--dir', 'server', 'run', 'deno:install'],
    label: 'server Deno stable 버전 맞추기',
  })
})

test('buildCreateExecutionOrder runs server scaffold before backoffice scaffold', () => {
  const labels = buildCreateExecutionOrder({
    appName: 'ebook',
    targetRoot: path.join('/tmp', 'ebook'),
    packageManager: 'pnpm',
    serverProvider: 'supabase',
    withBackoffice: true,
  })

  assert.deepEqual(labels, [
    'frontend Granite 만들기',
    'frontend 의존성 설치하기',
    'frontend AppInToss Framework 설치하기',
    'frontend ait 초기화하기',
    'frontend TDS 설치하기',
    'server Supabase 준비하기',
    'server Supabase Edge Function 만들기',
    'backoffice Vite 만들기',
  ])
})

test('buildCreateLifecycleOrder composes phase lifecycle labels from create phase modules', async () => {
  const ordersSource = await readFile(
    fileURLToPath(new URL('./orders.ts', import.meta.url)),
    'utf8',
  )

  assert.match(ordersSource, /listCreateScaffoldLifecycleLabels/)
  assert.match(ordersSource, /listCreateProvisionLifecycleLabels/)
  assert.match(ordersSource, /listCreatePatchLifecycleLabels/)
  assert.match(ordersSource, /listCreateFinalizeLifecycleLabels/)
  assert.doesNotMatch(ordersSource, /labels\.push\('server 워크스페이스 준비하기'/)
  assert.doesNotMatch(ordersSource, /labels\.push\('루트 템플릿 적용하기'/)
})

test('command plan builders derive shared server and backoffice phases from common helpers', async () => {
  const runtimeSource = await readFile(
    fileURLToPath(new URL('../runtime/commands.ts', import.meta.url)),
    'utf8',
  )
  const providersSource = await readFile(
    fileURLToPath(new URL('../providers/index.ts', import.meta.url)),
    'utf8',
  )

  assert.match(runtimeSource, /buildServerCommands\(/)
  assert.match(runtimeSource, /buildBackofficeCommands\(/)
  assert.match(providersSource, /buildPlan\(/)
  assert.doesNotMatch(providersSource, /buildCreatePlan\(/)
  assert.doesNotMatch(providersSource, /buildAddPlan\(/)
})

test('buildCreateLifecycleOrder applies root templates and server patch before firebase provisioning', () => {
  const labels = buildCreateLifecycleOrder({
    appName: 'ebook',
    targetRoot: path.join('/tmp', 'ebook'),
    packageManager: 'yarn',
    serverProvider: 'firebase',
    withBackoffice: true,
  })

  assert.deepEqual(labels, [
    'frontend Granite 만들기',
    'frontend 의존성 설치하기',
    'frontend AppInToss Framework 설치하기',
    'frontend ait 초기화하기',
    'frontend TDS 설치하기',
    'server 워크스페이스 준비하기',
    '루트 템플릿 적용하기',
    'server 워크스페이스 다듬기',
    'server provisioning 하기',
    'backoffice Vite 만들기',
    '루트 workspace manifest 맞추기',
    '루트 git 저장소 만들기',
    '루트 기본 브랜치를 main으로 맞추기',
  ])
})

test('buildCreateLifecycleOrder syncs root workspaces before cloudflare trpc provisioning', () => {
  const labels = buildCreateLifecycleOrder({
    appName: 'ebook',
    targetRoot: path.join('/tmp', 'ebook'),
    packageManager: 'pnpm',
    serverProvider: 'cloudflare',
    withTrpc: true,
    withBackoffice: false,
  })

  assert.deepEqual(labels, [
    'frontend Granite 만들기',
    'frontend 의존성 설치하기',
    'frontend AppInToss Framework 설치하기',
    'frontend ait 초기화하기',
    'frontend TDS 설치하기',
    'server Cloudflare Workers 준비하기',
    'server 워크스페이스 준비하기',
    '루트 템플릿 적용하기',
    'server 워크스페이스 다듬기',
    '루트 workspace manifest 먼저 맞추기',
    '루트 Cloudflare workspace 의존성을 먼저 설치하기',
    'server provisioning 하기',
    '루트 workspace manifest 맞추기',
    '루트 git 저장소 만들기',
    '루트 기본 브랜치를 main으로 맞추기',
  ])
})

test('buildCreateLifecycleOrder ignores trpc-only lifecycle steps for non-cloudflare providers', () => {
  const labels = buildCreateLifecycleOrder({
    appName: 'ebook',
    targetRoot: path.join('/tmp', 'ebook'),
    packageManager: 'pnpm',
    serverProvider: 'firebase',
    withTrpc: true,
    withBackoffice: false,
  })

  assert.doesNotMatch(labels.join('\n'), /루트 workspace manifest 먼저 맞추기/)
  assert.doesNotMatch(labels.join('\n'), /루트 workspace manifest 맞추기/)
})

test('buildCreateLifecycleOrder installs root dependencies before cloudflare provisioning', () => {
  const labels = buildCreateLifecycleOrder({
    appName: 'ebook',
    targetRoot: path.join('/tmp', 'ebook'),
    packageManager: 'yarn',
    serverProvider: 'cloudflare',
    withBackoffice: true,
  })

  assert.deepEqual(labels, [
    'frontend Granite 만들기',
    'frontend 의존성 설치하기',
    'frontend AppInToss Framework 설치하기',
    'frontend ait 초기화하기',
    'frontend TDS 설치하기',
    'server Cloudflare Workers 준비하기',
    'server 워크스페이스 준비하기',
    '루트 템플릿 적용하기',
    'server 워크스페이스 다듬기',
    '루트 Cloudflare workspace 의존성을 먼저 설치하기',
    'server provisioning 하기',
    'backoffice Vite 만들기',
    '루트 workspace manifest 맞추기',
    '루트 git 저장소 만들기',
    '루트 기본 브랜치를 main으로 맞추기',
  ])
})

test('buildRootGitSetupPlan initializes git and switches HEAD to main', () => {
  const targetRoot = path.join('/tmp', 'ebook')
  const plan = buildRootGitSetupPlan({ targetRoot })

  assert.deepEqual(
    plan.map((step) => step.label),
    ['루트 git 저장소 만들기', '루트 기본 브랜치를 main으로 맞추기'],
  )
  assert.deepEqual(plan[0], {
    cwd: targetRoot,
    command: 'git',
    args: ['init'],
    label: '루트 git 저장소 만들기',
  })
  assert.deepEqual(plan[1], {
    cwd: targetRoot,
    command: 'git',
    args: ['symbolic-ref', 'HEAD', 'refs/heads/main'],
    label: '루트 기본 브랜치를 main으로 맞추기',
  })
})

test('buildCreateLifecycleOrder omits root git init when no-git is enabled', () => {
  const labels = buildCreateLifecycleOrder({
    appName: 'ebook',
    targetRoot: path.join('/tmp', 'ebook'),
    packageManager: 'pnpm',
    noGit: true,
    serverProvider: null,
    withBackoffice: false,
  })

  assert.doesNotMatch(labels.join('\n'), /루트 git init/)
})
