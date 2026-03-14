import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { log } from '@clack/prompts'
import {
  runCommand,
  runCommandWithOutput,
  type CommandOutput,
  type CommandSpec,
} from './commands.js'
import type { CliPrompter } from './cli.js'
import { getPackageManagerAdapter, type PackageManager } from './package-manager.js'
import type { ProvisioningNote, ServerProjectMode } from './server-project.js'
import { pathExists } from './templates.js'

type SupabaseProject = {
  id: string
  name: string
  region?: string
}

type SupabaseApiKey = {
  name?: string
  api_key?: string
}

export type ProvisionedSupabaseProject = {
  projectRef: string
  publishableKey: string
  mode: ServerProjectMode
}

type ProvisionSupabaseProjectOptions = {
  targetRoot: string
  packageManager: PackageManager
  prompt: CliPrompter
  projectMode: ServerProjectMode | null
}

function buildSupabaseCommand(
  packageManager: PackageManager,
  cwd: string,
  label: string,
  args: string[],
): CommandSpec {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    cwd,
    ...adapter.dlx('supabase', args),
    label,
  }
}

function createSupabaseEnvValues(projectRef: string, publishableKey: string) {
  const supabaseUrl = `https://${projectRef}.supabase.co`

  return {
    frontend: [
      `MINIAPP_SUPABASE_URL=${supabaseUrl}`,
      `MINIAPP_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
      '',
    ].join('\n'),
    backoffice: [
      `VITE_SUPABASE_URL=${supabaseUrl}`,
      `VITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
      '',
    ].join('\n'),
  }
}

function stripAnsi(value: string) {
  let result = ''

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index)

    if (codePoint === 0x1b && value[index + 1] === '[') {
      index += 2

      while (index < value.length) {
        const controlTerminator = value.charCodeAt(index)

        if (controlTerminator >= 0x40 && controlTerminator <= 0x7e) {
          break
        }

        index += 1
      }

      continue
    }

    result += value[index]
  }

  return result
}

export function extractJsonPayload<T>(output: Pick<CommandOutput, 'stdout' | 'stderr'>) {
  const lines = `${output.stdout}\n${output.stderr}`
    .split(/\r?\n/)
    .map((line) => stripAnsi(line).trimEnd())
    .filter((line) => line.trim().length > 0)

  for (let start = 0; start < lines.length; start += 1) {
    const trimmed = lines[start]?.trimStart()

    if (!trimmed || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) {
      continue
    }

    for (let end = lines.length; end > start; end -= 1) {
      const candidate = lines.slice(start, end).join('\n').trim()

      try {
        return JSON.parse(candidate) as T
      } catch {}
    }
  }

  throw new Error('JSON 결과를 해석하지 못했습니다.')
}

export function resolveSupabaseClientApiKey(apiKeys: SupabaseApiKey[]) {
  const publishableKey =
    apiKeys.find((key) => key.name?.toLowerCase() === 'publishable')?.api_key ??
    apiKeys.find((key) => key.api_key?.startsWith('sb_publishable_'))?.api_key

  if (publishableKey) {
    return publishableKey
  }

  const anonKey = apiKeys.find((key) => key.name?.toLowerCase() === 'anon')?.api_key

  if (anonKey) {
    return anonKey
  }

  throw new Error('Supabase 클라이언트용 publishable key를 찾지 못했습니다.')
}

export function formatSupabaseManualSetupNote(options: {
  targetRoot: string
  hasBackoffice: boolean
  projectRef: string
  publishableKey: string
}): ProvisioningNote {
  const env = createSupabaseEnvValues(options.projectRef, options.publishableKey)
  const lines = [
    '기존 Supabase 프로젝트를 선택했으니 아래 값을 직접 넣어주세요.',
    '',
    path.join(options.targetRoot, 'frontend', '.env.local'),
    env.frontend.trimEnd(),
  ]

  if (options.hasBackoffice) {
    lines.push(
      '',
      path.join(options.targetRoot, 'backoffice', '.env.local'),
      env.backoffice.trimEnd(),
    )
  }

  return {
    title: 'Supabase 환경 변수 안내',
    body: lines.join('\n'),
  }
}

export async function writeSupabaseLocalEnvFiles(options: {
  targetRoot: string
  hasBackoffice: boolean
  projectRef: string
  publishableKey: string
}) {
  const env = createSupabaseEnvValues(options.projectRef, options.publishableKey)
  const frontendEnvPath = path.join(options.targetRoot, 'frontend', '.env.local')

  await mkdir(path.dirname(frontendEnvPath), { recursive: true })
  await writeFile(frontendEnvPath, env.frontend, 'utf8')

  if (options.hasBackoffice) {
    const backofficeEnvPath = path.join(options.targetRoot, 'backoffice', '.env.local')
    await mkdir(path.dirname(backofficeEnvPath), { recursive: true })
    await writeFile(backofficeEnvPath, env.backoffice, 'utf8')
  }
}

async function listSupabaseProjects(packageManager: PackageManager, cwd: string) {
  const output = await runCommandWithOutput(
    buildSupabaseCommand(packageManager, cwd, 'Supabase 프로젝트 목록 조회', [
      'projects',
      'list',
      '--output',
      'json',
    ]),
  )

  return extractJsonPayload<SupabaseProject[]>(output)
}

async function ensureSupabaseProjects(packageManager: PackageManager, cwd: string) {
  try {
    return await listSupabaseProjects(packageManager, cwd)
  } catch {
    log.step('Supabase 로그인')
    await runCommand(buildSupabaseCommand(packageManager, cwd, 'Supabase 로그인', ['login']))
    return await listSupabaseProjects(packageManager, cwd)
  }
}

async function selectSupabaseProject(prompt: CliPrompter, projects: SupabaseProject[]) {
  if (projects.length === 0) {
    throw new Error('사용 가능한 Supabase 프로젝트가 없습니다. 먼저 새 프로젝트를 만들어주세요.')
  }

  return await prompt.select({
    message: '사용할 Supabase 프로젝트를 선택하세요.',
    options: projects.map((project) => ({
      value: project.id,
      label: project.region ? `${project.name} (${project.region})` : project.name,
    })),
    initialValue: projects[0]?.id,
  })
}

async function createSupabaseProject(packageManager: PackageManager, cwd: string) {
  log.step('Supabase 새 프로젝트 생성')
  await runCommand(
    buildSupabaseCommand(packageManager, cwd, 'Supabase 새 프로젝트 생성', ['projects', 'create']),
  )
}

async function getSupabaseApiKeys(packageManager: PackageManager, cwd: string, projectRef: string) {
  const output = await runCommandWithOutput(
    buildSupabaseCommand(packageManager, cwd, 'Supabase API key 조회', [
      'projects',
      'api-keys',
      '--project-ref',
      projectRef,
      '--output',
      'json',
    ]),
  )

  return extractJsonPayload<SupabaseApiKey[]>(output)
}

async function linkSupabaseProject(
  packageManager: PackageManager,
  serverRoot: string,
  projectRef: string,
) {
  log.step('server Supabase 연결')
  await runCommand(
    buildSupabaseCommand(packageManager, serverRoot, 'server Supabase link', [
      'link',
      '--project-ref',
      projectRef,
    ]),
  )
}

async function pushSupabaseDatabase(packageManager: PackageManager, serverRoot: string) {
  log.step('server Supabase db push')
  await runCommand(
    buildSupabaseCommand(packageManager, serverRoot, 'server Supabase db push', [
      'db',
      'push',
      '--include-all',
    ]),
  )
}

export async function provisionSupabaseProject(
  options: ProvisionSupabaseProjectOptions,
): Promise<ProvisionedSupabaseProject | null> {
  if (options.projectMode === null) {
    return null
  }

  const serverRoot = path.join(options.targetRoot, 'server')
  const projects = await ensureSupabaseProjects(options.packageManager, options.targetRoot)

  let selectedProjectId: string

  if (options.projectMode === 'create') {
    await createSupabaseProject(options.packageManager, options.targetRoot)
    const refreshedProjects = await ensureSupabaseProjects(
      options.packageManager,
      options.targetRoot,
    )
    selectedProjectId = await selectSupabaseProject(options.prompt, refreshedProjects)
  } else {
    selectedProjectId = await selectSupabaseProject(options.prompt, projects)
  }

  const apiKeys = await getSupabaseApiKeys(
    options.packageManager,
    options.targetRoot,
    selectedProjectId,
  )
  const publishableKey = resolveSupabaseClientApiKey(apiKeys)

  await linkSupabaseProject(options.packageManager, serverRoot, selectedProjectId)
  await pushSupabaseDatabase(options.packageManager, serverRoot)

  return {
    projectRef: selectedProjectId,
    publishableKey,
    mode: options.projectMode,
  }
}

export async function finalizeSupabaseProvisioning(options: {
  targetRoot: string
  provisionedProject: ProvisionedSupabaseProject | null
}) {
  if (!options.provisionedProject) {
    return [
      {
        title: 'Supabase 프로젝트 연결 건너뜀',
        body: '현재 실행에서는 원격 Supabase 프로젝트 연결을 건너뛰었습니다. 필요하면 `--server-project-mode`를 지정하거나 인터랙티브 모드에서 기존/새 프로젝트를 선택하세요.',
      },
    ] satisfies ProvisioningNote[]
  }

  const hasBackoffice = await pathExists(path.join(options.targetRoot, 'backoffice'))

  if (options.provisionedProject.mode === 'create') {
    await writeSupabaseLocalEnvFiles({
      targetRoot: options.targetRoot,
      hasBackoffice,
      projectRef: options.provisionedProject.projectRef,
      publishableKey: options.provisionedProject.publishableKey,
    })

    return [
      {
        title: 'Supabase 환경 변수 작성 완료',
        body: hasBackoffice
          ? 'frontend/.env.local 과 backoffice/.env.local 에 Supabase 연결 값을 작성했습니다.'
          : 'frontend/.env.local 에 Supabase 연결 값을 작성했습니다.',
      },
    ] satisfies ProvisioningNote[]
  }

  return [
    formatSupabaseManualSetupNote({
      targetRoot: options.targetRoot,
      hasBackoffice,
      projectRef: options.provisionedProject.projectRef,
      publishableKey: options.provisionedProject.publishableKey,
    }),
  ]
}
