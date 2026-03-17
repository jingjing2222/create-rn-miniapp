import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { log } from '@clack/prompts'
import {
  runCommand,
  runCommandWithOutput,
  type CommandOutput,
  type CommandSpec,
} from '../../commands.js'
import type { CliPrompter } from '../../cli.js'
import { getPackageManagerAdapter, type PackageManager } from '../../package-manager.js'
import type { ProvisioningNote, ServerProjectMode } from '../../server-project.js'
import { pathExists } from '../../templates/index.js'

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
  publishableKey: string | null
  dbPassword: string | null
  mode: ServerProjectMode
}

type ProvisionSupabaseProjectOptions = {
  targetRoot: string
  packageManager: PackageManager
  prompt: CliPrompter
  projectMode: ServerProjectMode | null
}

const CREATE_SUPABASE_PROJECT_SENTINEL = '__create_supabase_project__'
const SUPABASE_ACCESS_TOKENS_DASHBOARD_URL = 'https://supabase.com/dashboard/account/tokens'

export function buildCreateSupabaseProjectArgs(projectName: string) {
  return ['projects', 'create', projectName]
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

function createSupabaseServerEnvValues(projectRef: string, dbPassword = '', accessToken = '') {
  return [
    '# Used by server/package.json db:apply and functions:deploy for remote Supabase operations.',
    `SUPABASE_PROJECT_REF=${projectRef}`,
    `SUPABASE_DB_PASSWORD=${dbPassword}`,
    `SUPABASE_ACCESS_TOKEN=${accessToken}`,
    '',
  ].join('\n')
}

function getSupabaseApiSettingsUrl(projectRef: string) {
  return `https://supabase.com/dashboard/project/${projectRef}/settings/api`
}

function getSupabaseDatabaseSettingsUrl(projectRef: string) {
  return `https://supabase.com/dashboard/project/${projectRef}/database/settings`
}

function formatSupabaseSecretGuidance(options: {
  projectRef: string
  hasDbPassword: boolean
  hasAccessToken: boolean
}) {
  const lines: string[] = []

  if (!options.hasAccessToken && !options.hasDbPassword) {
    lines.push(
      'server/.env.local 의 `SUPABASE_ACCESS_TOKEN`과 `SUPABASE_DB_PASSWORD`는 비어 있어요. 아래 URL을 통해 각각 값을 넣어 주세요.',
      SUPABASE_ACCESS_TOKENS_DASHBOARD_URL,
      getSupabaseDatabaseSettingsUrl(options.projectRef),
    )

    return lines
  }

  if (!options.hasAccessToken) {
    lines.push(
      'server/.env.local 의 `SUPABASE_ACCESS_TOKEN`은 비어 있어요. 아래 URL에서 값을 확인한 뒤 넣어 주세요.',
      SUPABASE_ACCESS_TOKENS_DASHBOARD_URL,
    )
  }

  if (!options.hasDbPassword) {
    lines.push(
      'server/.env.local 의 `SUPABASE_DB_PASSWORD`는 비어 있어요. 아래 URL에서 DB password를 확인하거나 재설정한 뒤 넣어 주세요.',
      getSupabaseDatabaseSettingsUrl(options.projectRef),
    )
  }

  return lines
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
  hasDbPassword: boolean
  hasAccessToken?: boolean
}): ProvisioningNote {
  const env = createSupabaseEnvValues(
    options.projectRef,
    '<Supabase Settings > API에서 복사한 Publishable key>',
  )
  const lines = [
    'Supabase publishable key를 자동으로 가져오지 못했습니다. 아래 URL에서 키를 확인한 뒤 직접 넣어주세요.',
    '',
    getSupabaseApiSettingsUrl(options.projectRef),
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

  lines.push(
    '',
    path.join(options.targetRoot, 'server', '.env.local'),
    createSupabaseServerEnvValues(options.projectRef, '<프로젝트 DB password>').trimEnd(),
  )

  const secretGuidance = formatSupabaseSecretGuidance({
    projectRef: options.projectRef,
    hasDbPassword: options.hasDbPassword,
    hasAccessToken: options.hasAccessToken ?? false,
  })

  if (secretGuidance.length > 0) {
    lines.push('', ...secretGuidance)
  }

  return {
    title: 'Supabase 연결 값을 이렇게 넣어 주세요',
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

export async function writeSupabaseServerLocalEnvFile(options: {
  targetRoot: string
  projectRef: string
  dbPassword?: string | null
}) {
  const serverEnvPath = path.join(options.targetRoot, 'server', '.env.local')
  let existingSource = ''

  if (await pathExists(serverEnvPath)) {
    existingSource = await readFile(serverEnvPath, 'utf8')
  }

  const lines = existingSource.length > 0 ? existingSource.split(/\r?\n/) : []
  const nextLines =
    lines.length > 0
      ? [...lines]
      : [
          '# Used by server/package.json db:apply and functions:deploy for remote Supabase operations.',
        ]
  let hasProjectRef = false
  let hasPassword = false
  let hasNonEmptyPassword = false
  let hasAccessToken = false
  let hasNonEmptyAccessToken = false

  for (let index = 0; index < nextLines.length; index += 1) {
    const trimmed = nextLines[index]?.trim() ?? ''

    if (trimmed.startsWith('SUPABASE_PROJECT_REF=')) {
      nextLines[index] = `SUPABASE_PROJECT_REF=${options.projectRef}`
      hasProjectRef = true
      continue
    }

    if (trimmed.startsWith('SUPABASE_DB_PASSWORD=')) {
      hasPassword = true
      hasNonEmptyPassword = trimmed.slice('SUPABASE_DB_PASSWORD='.length).trim().length > 0

      if (!hasNonEmptyPassword && options.dbPassword) {
        nextLines[index] = `SUPABASE_DB_PASSWORD=${options.dbPassword}`
        hasNonEmptyPassword = true
      }

      continue
    }

    if (trimmed.startsWith('SUPABASE_ACCESS_TOKEN=')) {
      hasAccessToken = true
      hasNonEmptyAccessToken = trimmed.slice('SUPABASE_ACCESS_TOKEN='.length).trim().length > 0
    }
  }

  if (!hasProjectRef) {
    nextLines.push(`SUPABASE_PROJECT_REF=${options.projectRef}`)
  }

  if (!hasPassword) {
    nextLines.push(`SUPABASE_DB_PASSWORD=${options.dbPassword ?? ''}`)
    hasNonEmptyPassword = Boolean(options.dbPassword)
  }

  if (!hasAccessToken) {
    nextLines.push('SUPABASE_ACCESS_TOKEN=')
  }

  const normalizedSource = `${nextLines
    .filter((line, index, array) => {
      if (index === array.length - 1) {
        return line.length > 0
      }

      return true
    })
    .join('\n')}\n`

  await mkdir(path.dirname(serverEnvPath), { recursive: true })
  await writeFile(serverEnvPath, normalizedSource, 'utf8')

  return {
    hasDbPassword: hasNonEmptyPassword,
    hasAccessToken: hasNonEmptyAccessToken,
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
    log.step('Supabase에 로그인할게요')
    await runCommand(buildSupabaseCommand(packageManager, cwd, 'Supabase 로그인하기', ['login']))
    return await listSupabaseProjects(packageManager, cwd)
  }
}

async function sleep(delayMs: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

export async function pollForNewSupabaseProject(
  existingProjectRefs: string[],
  options: {
    delaysMs?: number[]
    listProjects?: () => Promise<SupabaseProject[]>
    sleep?: (delayMs: number) => Promise<void>
  } = {},
) {
  const delaysMs = options.delaysMs ?? [1000, 2000, 4000, 5000]
  const listProjects = options.listProjects

  if (!listProjects) {
    throw new Error('Supabase 프로젝트 목록 조회 함수가 필요해요.')
  }

  const wait = options.sleep ?? sleep

  for (const delayMs of delaysMs) {
    await wait(delayMs)

    const projects = await listProjects()
    const matchedProject = projects.find((project) => !existingProjectRefs.includes(project.id))

    if (matchedProject) {
      return matchedProject
    }
  }

  return null
}

async function selectSupabaseProject(
  prompt: CliPrompter,
  projects: SupabaseProject[],
  options?: {
    includeCreateOption?: boolean
    message?: string
  },
) {
  if (projects.length === 0 && !options?.includeCreateOption) {
    throw new Error(
      '지금 바로 연결할 Supabase 프로젝트가 없어요. 새 프로젝트를 먼저 만들어 주세요.',
    )
  }

  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.region ? `${project.name} (${project.region})` : project.name,
  }))
  const selectOptions = options?.includeCreateOption
    ? [
        ...projectOptions,
        {
          value: CREATE_SUPABASE_PROJECT_SENTINEL,
          label: '+ 새 Supabase 프로젝트 만들기',
        },
      ]
    : projectOptions

  const initialValue =
    selectOptions.find((option) => option.value !== CREATE_SUPABASE_PROJECT_SENTINEL)?.value ??
    CREATE_SUPABASE_PROJECT_SENTINEL

  return await prompt.select({
    message: options?.message ?? '사용할 Supabase 프로젝트를 골라 주세요.',
    options: selectOptions,
    initialValue,
  })
}

async function promptSupabaseProjectName(prompt: CliPrompter, targetRoot: string) {
  return await prompt.text({
    message: '새 Supabase 프로젝트 이름을 적어 주세요.',
    placeholder: path.basename(targetRoot),
    initialValue: path.basename(targetRoot),
    validate(value) {
      if (value.trim().length === 0) {
        return '프로젝트 이름은 비워둘 수 없어요.'
      }

      return undefined
    },
  })
}

async function createSupabaseProject(
  packageManager: PackageManager,
  cwd: string,
  prompt: CliPrompter,
) {
  log.step('Supabase 프로젝트를 새로 만들게요')
  const projectName = (await promptSupabaseProjectName(prompt, cwd)).trim()
  await runCommand(
    buildSupabaseCommand(packageManager, cwd, 'Supabase 프로젝트 만들기', [
      ...buildCreateSupabaseProjectArgs(projectName),
    ]),
  )

  return {
    dbPassword: null,
  }
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

async function tryGetSupabasePublishableKey(
  packageManager: PackageManager,
  cwd: string,
  projectRef: string,
) {
  try {
    const apiKeys = await getSupabaseApiKeys(packageManager, cwd, projectRef)
    return resolveSupabaseClientApiKey(apiKeys)
  } catch {
    return null
  }
}

async function linkSupabaseProject(
  packageManager: PackageManager,
  serverRoot: string,
  projectRef: string,
) {
  log.step('server를 Supabase 프로젝트에 연결할게요')
  await runCommand(
    buildSupabaseCommand(packageManager, serverRoot, 'server Supabase link', [
      'link',
      '--project-ref',
      projectRef,
    ]),
  )
}

async function pushSupabaseDatabase(packageManager: PackageManager, serverRoot: string) {
  log.step('server DB 변경을 반영할게요')
  await runCommand(
    buildSupabaseCommand(packageManager, serverRoot, 'server Supabase db push', [
      'db',
      'push',
      '--include-all',
    ]),
  )
}

async function deploySupabaseFunctions(
  packageManager: PackageManager,
  serverRoot: string,
  projectRef: string,
) {
  log.step('server Edge Functions를 배포할게요')
  await runCommand(
    buildSupabaseCommand(packageManager, serverRoot, 'server Supabase Edge Functions 배포', [
      'functions',
      'deploy',
      '--project-ref',
      projectRef,
      '--workdir',
      '.',
      '--yes',
    ]),
  )
}

export async function provisionSupabaseProject(
  options: ProvisionSupabaseProjectOptions,
): Promise<ProvisionedSupabaseProject | null> {
  const serverRoot = path.join(options.targetRoot, 'server')
  const projects = await ensureSupabaseProjects(options.packageManager, options.targetRoot)

  let selectedProjectId: string | null = null
  let resolvedProjectMode = options.projectMode
  let createdProjectDbPassword: string | null = null

  if (resolvedProjectMode === null) {
    const selectedProject = await selectSupabaseProject(options.prompt, projects, {
      includeCreateOption: true,
      message: '사용할 Supabase 프로젝트를 골라 주세요. 새 프로젝트도 바로 만들 수 있어요.',
    })

    if (selectedProject === CREATE_SUPABASE_PROJECT_SENTINEL) {
      resolvedProjectMode = 'create'
    } else {
      resolvedProjectMode = 'existing'
      selectedProjectId = selectedProject
    }
  }

  if (resolvedProjectMode === 'create') {
    const previousProjectIds = new Set(projects.map((project) => project.id))
    const createdProject = await createSupabaseProject(
      options.packageManager,
      options.targetRoot,
      options.prompt,
    )
    createdProjectDbPassword = createdProject.dbPassword

    const createdSupabaseProject = await pollForNewSupabaseProject([...previousProjectIds], {
      listProjects: async () =>
        await ensureSupabaseProjects(options.packageManager, options.targetRoot),
    })

    if (createdSupabaseProject) {
      selectedProjectId = createdSupabaseProject.id
    } else {
      const refreshedProjects = await ensureSupabaseProjects(
        options.packageManager,
        options.targetRoot,
      )
      const newlyCreatedProjects = refreshedProjects.filter(
        (project) => !previousProjectIds.has(project.id),
      )

      if (newlyCreatedProjects.length === 1) {
        selectedProjectId = newlyCreatedProjects[0].id
      } else {
        selectedProjectId = await selectSupabaseProject(options.prompt, refreshedProjects, {
          message: '연결할 Supabase 프로젝트를 골라 주세요.',
        })
      }
    }
  } else if (resolvedProjectMode === 'existing' && !selectedProjectId) {
    selectedProjectId = await selectSupabaseProject(options.prompt, projects)
  }

  if (!selectedProjectId || !resolvedProjectMode) {
    throw new Error('연결할 Supabase 프로젝트를 정하지 못했어요.')
  }

  const publishableKey = await tryGetSupabasePublishableKey(
    options.packageManager,
    options.targetRoot,
    selectedProjectId,
  )

  await linkSupabaseProject(options.packageManager, serverRoot, selectedProjectId)
  await pushSupabaseDatabase(options.packageManager, serverRoot)
  await deploySupabaseFunctions(options.packageManager, serverRoot, selectedProjectId)

  return {
    projectRef: selectedProjectId,
    publishableKey,
    dbPassword: createdProjectDbPassword,
    mode: resolvedProjectMode,
  }
}

export async function finalizeSupabaseProvisioning(options: {
  targetRoot: string
  provisionedProject: ProvisionedSupabaseProject | null
}) {
  if (!options.provisionedProject) {
    return [
      {
        title: 'Supabase 프로젝트 연결은 이번엔 건너뛸게요',
        body: '이번 실행에서는 원격 Supabase 프로젝트 연결을 건너뛰었어요. 필요하면 `--server-project-mode`를 주거나 인터랙티브 모드에서 기존 프로젝트나 새 프로젝트를 골라 주세요.',
      },
    ] satisfies ProvisioningNote[]
  }

  const hasBackoffice = await pathExists(path.join(options.targetRoot, 'backoffice'))
  const serverEnv = await writeSupabaseServerLocalEnvFile({
    targetRoot: options.targetRoot,
    projectRef: options.provisionedProject.projectRef,
    dbPassword: options.provisionedProject.dbPassword,
  })

  if (options.provisionedProject.publishableKey) {
    await writeSupabaseLocalEnvFiles({
      targetRoot: options.targetRoot,
      hasBackoffice,
      projectRef: options.provisionedProject.projectRef,
      publishableKey: options.provisionedProject.publishableKey,
    })

    return [
      {
        title: 'Supabase 연결 값을 적어뒀어요',
        body: [
          hasBackoffice
            ? 'frontend/.env.local 과 backoffice/.env.local 에 Supabase 연결 값을 적어뒀어요.'
            : 'frontend/.env.local 에 Supabase 연결 값을 적어뒀어요.',
          'server/.env.local 에도 필요한 값을 적어뒀어요.',
          ...(serverEnv.hasDbPassword && serverEnv.hasAccessToken
            ? []
            : formatSupabaseSecretGuidance({
                projectRef: options.provisionedProject.projectRef,
                hasDbPassword: serverEnv.hasDbPassword,
                hasAccessToken: serverEnv.hasAccessToken,
              })),
        ].join('\n'),
      },
    ] satisfies ProvisioningNote[]
  }

  return [
    formatSupabaseManualSetupNote({
      targetRoot: options.targetRoot,
      hasBackoffice,
      projectRef: options.provisionedProject.projectRef,
      hasDbPassword: serverEnv.hasDbPassword,
      hasAccessToken: serverEnv.hasAccessToken,
    }),
  ]
}
