import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { log } from '@clack/prompts'
import { patchWranglerConfigSource } from './ast.js'
import { runCommand, runCommandWithOutput, type CommandSpec } from './commands.js'
import type { CliPrompter } from './cli.js'
import { getPackageManagerAdapter, type PackageManager } from './package-manager.js'
import type { ProvisioningNote, ServerProjectMode } from './server-project.js'
import { pathExists } from './templates.js'

type WranglerAuth = {
  oauthToken: string
  expirationTime: string | null
}

type CloudflareAccount = {
  id: string
  name: string
}

type CloudflareWorkerScript = {
  id?: string
  tag?: string
}

type CloudflareSubdomainResult = {
  enabled?: boolean
  previews_enabled?: boolean
  subdomain?: string
}

export type ProvisionedCloudflareWorker = {
  accountId: string
  workerName: string
  apiBaseUrl: string | null
  mode: ServerProjectMode
}

type ProvisionCloudflareWorkerOptions = {
  targetRoot: string
  packageManager: PackageManager
  prompt: CliPrompter
  projectMode: ServerProjectMode | null
  appName: string
}

const CREATE_CLOUDFLARE_WORKER_SENTINEL = '__create_cloudflare_worker__'
const CLOUDFLARE_VERIFY_EMAIL_URL =
  'https://developers.cloudflare.com/fundamentals/setup/account/verify-email-address/'

type CloudflareApiEnvelope<T> = {
  success: boolean
  errors?: Array<{
    message?: string
  }>
  result: T
}

const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4'

function buildWranglerCommand(
  packageManager: PackageManager,
  cwd: string,
  label: string,
  args: string[],
): CommandSpec {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    cwd,
    ...adapter.dlx('wrangler', args),
    label,
  }
}

function createCloudflareEnvValues(apiBaseUrl: string) {
  return {
    frontend: [`MINIAPP_API_BASE_URL=${apiBaseUrl}`, ''].join('\n'),
    backoffice: [`VITE_API_BASE_URL=${apiBaseUrl}`, ''].join('\n'),
  }
}

function createCloudflareServerEnvValues(options: {
  accountId: string
  workerName: string
  apiBaseUrl: string | null
  apiToken?: string
}) {
  return [
    '# Cloudflare Worker metadata for this workspace.',
    `CLOUDFLARE_ACCOUNT_ID=${options.accountId}`,
    `CLOUDFLARE_WORKER_NAME=${options.workerName}`,
    `CLOUDFLARE_API_BASE_URL=${options.apiBaseUrl ?? ''}`,
    `CLOUDFLARE_API_TOKEN=${options.apiToken ?? ''}`,
    '',
  ].join('\n')
}

function hasConfiguredCloudflareApiToken(source: string) {
  const tokenLine = source.match(/^CLOUDFLARE_API_TOKEN=(.*)$/m)?.[1]?.trim() ?? ''
  return tokenLine.length > 0
}

function parseWranglerAuthValue(source: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`^${escapedKey}\\s*=\\s*"([^"]+)"\\s*$`, 'm'))
  return match?.[1] ?? null
}

export function getWranglerConfigCandidates(options?: {
  homeDir?: string
  xdgConfigHome?: string
  appData?: string
}) {
  const homeDir = options?.homeDir ?? os.homedir()
  const xdgConfigHome =
    options?.xdgConfigHome ?? process.env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config')
  const appData = options?.appData ?? process.env.APPDATA

  return [
    path.join(homeDir, '.wrangler', 'config', 'default.toml'),
    path.join(xdgConfigHome, '.wrangler', 'config', 'default.toml'),
    path.join(homeDir, 'Library', 'Application Support', '.wrangler', 'config', 'default.toml'),
    path.join(homeDir, 'Library', 'Preferences', '.wrangler', 'config', 'default.toml'),
    ...(appData ? [path.join(appData, '.wrangler', 'config', 'default.toml')] : []),
  ]
}

async function readWranglerAuthToken() {
  for (const configPath of getWranglerConfigCandidates()) {
    if (!(await pathExists(configPath))) {
      continue
    }

    const source = await readFile(configPath, 'utf8')
    const oauthToken = parseWranglerAuthValue(source, 'oauth_token')

    if (!oauthToken) {
      continue
    }

    return {
      oauthToken,
      expirationTime: parseWranglerAuthValue(source, 'expiration_time'),
    } satisfies WranglerAuth
  }

  return null
}

function isWranglerAuthExpired(auth: WranglerAuth) {
  if (!auth.expirationTime) {
    return false
  }

  return Date.parse(auth.expirationTime) <= Date.now()
}

async function ensureWranglerAuth(packageManager: PackageManager, cwd: string) {
  const existingAuth = await readWranglerAuthToken()

  if (existingAuth && !isWranglerAuthExpired(existingAuth)) {
    return existingAuth
  }

  log.step('Cloudflare Wrangler 로그인')
  await runCommand(
    buildWranglerCommand(packageManager, cwd, 'Cloudflare Wrangler 로그인', [
      'login',
      '--scopes',
      'account:read',
      'user:read',
      'workers:write',
      'workers_scripts:write',
    ]),
  )

  const nextAuth = await readWranglerAuthToken()

  if (!nextAuth) {
    throw new Error('`wrangler login` 후 인증 토큰을 찾지 못했습니다.')
  }

  return nextAuth
}

async function requestCloudflareApi<T>(
  authToken: string,
  pathname: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${CLOUDFLARE_API_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json()) as CloudflareApiEnvelope<T>

  if (!response.ok || !payload.success) {
    const errorMessage =
      payload.errors?.map((error) => error.message).find(Boolean) ??
      `Cloudflare API 요청에 실패했습니다. (${response.status})`
    throw new Error(errorMessage)
  }

  return payload.result
}

async function listCloudflareAccounts(authToken: string) {
  return await requestCloudflareApi<CloudflareAccount[]>(authToken, '/accounts')
}

async function listCloudflareWorkers(authToken: string, accountId: string) {
  const scripts = await requestCloudflareApi<CloudflareWorkerScript[]>(
    authToken,
    `/accounts/${accountId}/workers/scripts`,
  )

  return scripts
    .map((script) => script.id ?? script.tag ?? null)
    .filter((scriptName): scriptName is string => Boolean(scriptName))
}

async function getAccountSubdomain(authToken: string, accountId: string) {
  return await requestCloudflareApi<CloudflareSubdomainResult>(
    authToken,
    `/accounts/${accountId}/workers/subdomain`,
  )
}

async function createAccountSubdomain(authToken: string, accountId: string, subdomain: string) {
  await requestCloudflareApi<CloudflareSubdomainResult>(
    authToken,
    `/accounts/${accountId}/workers/subdomain`,
    {
      method: 'PUT',
      body: JSON.stringify({
        subdomain,
      }),
    },
  )

  return subdomain
}

async function ensureAccountSubdomain(options: {
  authToken: string
  accountId: string
  prompt: CliPrompter
  appName: string
}) {
  const existing = await getAccountSubdomain(options.authToken, options.accountId)

  if (existing.subdomain && existing.subdomain.trim().length > 0) {
    return existing.subdomain.trim()
  }

  const nextSubdomain = await options.prompt.text({
    message: 'Cloudflare account workers.dev 서브도메인을 입력하세요.',
    initialValue: options.appName,
    validate(value) {
      return value.trim().length === 0 ? 'workers.dev 서브도메인을 입력하세요.' : undefined
    },
  })

  return await createAccountSubdomain(options.authToken, options.accountId, nextSubdomain.trim())
}

async function ensureWorkerSubdomainEnabled(
  authToken: string,
  accountId: string,
  workerName: string,
) {
  await requestCloudflareApi<CloudflareSubdomainResult>(
    authToken,
    `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
    {
      method: 'POST',
      body: JSON.stringify({
        enabled: true,
        previews_enabled: true,
      }),
    },
  )
}

async function selectCloudflareAccount(prompt: CliPrompter, accounts: CloudflareAccount[]) {
  if (accounts.length === 0) {
    throw new Error('사용 가능한 Cloudflare account가 없습니다.')
  }

  return await prompt.select({
    message: '사용할 Cloudflare account를 선택하세요.',
    options: accounts.map((account) => ({
      value: account.id,
      label: `${account.name} (${account.id})`,
    })),
    initialValue: accounts[0]?.id,
  })
}

async function selectCloudflareWorker(
  prompt: CliPrompter,
  workerNames: string[],
  options?: {
    includeCreateOption?: boolean
    message?: string
  },
) {
  if (workerNames.length === 0 && !options?.includeCreateOption) {
    throw new Error('사용 가능한 Cloudflare Worker가 없습니다. 새 Worker를 먼저 배포하세요.')
  }

  const workerOptions = workerNames.map((workerName) => ({
    value: workerName,
    label: workerName,
  }))
  const selectOptions = options?.includeCreateOption
    ? [
        ...workerOptions,
        {
          value: CREATE_CLOUDFLARE_WORKER_SENTINEL,
          label: '+ 새 Cloudflare Worker 생성',
        },
      ]
    : workerOptions

  const initialValue =
    selectOptions.find((option) => option.value !== CREATE_CLOUDFLARE_WORKER_SENTINEL)?.value ??
    CREATE_CLOUDFLARE_WORKER_SENTINEL

  return await prompt.select({
    message: options?.message ?? '사용할 Cloudflare Worker를 선택하세요.',
    options: selectOptions,
    initialValue,
  })
}

async function patchWranglerWorkerName(serverRoot: string, workerName: string) {
  const wranglerConfigPath = path.join(serverRoot, 'wrangler.jsonc')

  if (!(await pathExists(wranglerConfigPath))) {
    return
  }

  const source = await readFile(wranglerConfigPath, 'utf8')
  const next = patchWranglerConfigSource(source, {
    name: workerName,
  })

  await writeFile(wranglerConfigPath, next, 'utf8')
}

async function deployCloudflareWorker(
  packageManager: PackageManager,
  serverRoot: string,
  workerName: string,
) {
  log.step('Cloudflare Worker 배포')

  try {
    const output = await runCommandWithOutput(
      buildWranglerCommand(packageManager, serverRoot, 'Cloudflare Worker deploy', [
        'deploy',
        '--name',
        workerName,
      ]),
    )

    if (output.stdout.trim().length > 0) {
      process.stdout.write(output.stdout)
    }

    if (output.stderr.trim().length > 0) {
      process.stderr.write(output.stderr)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(formatCloudflareDeployFailureMessage(message))
  }
}

function isCloudflareWorkersDevOnboardingError(message: string) {
  return (
    message.includes('register a workers.dev subdomain') ||
    message.includes('/workers/onboarding') ||
    message.includes('workers.dev 서브도메인 등록이 필요')
  )
}

export function formatCloudflareDeployFailureMessage(message: string) {
  if (message.includes('[code: 10034]') || message.includes('verify your email address')) {
    return [
      'Cloudflare 계정 이메일 인증이 필요해서 Worker 배포를 계속할 수 없습니다.',
      '',
      '아래 문서에 따라 이메일 인증을 마친 뒤 다시 실행하세요.',
      CLOUDFLARE_VERIFY_EMAIL_URL,
    ].join('\n')
  }

  if (isCloudflareWorkersDevOnboardingError(message)) {
    const onboardingUrlMatch = message.match(
      /https:\/\/dash\.cloudflare\.com\/\S*\/workers\/onboarding/,
    )
    const onboardingUrl =
      onboardingUrlMatch?.[0] ?? 'https://dash.cloudflare.com/?to=/:account/workers/onboarding'

    return [
      'Cloudflare account의 workers.dev 서브도메인 등록이 필요해서 Worker 배포를 계속할 수 없습니다.',
      '',
      '아래 URL에서 workers.dev onboarding을 마친 뒤 다시 실행하세요.',
      onboardingUrl,
    ].join('\n')
  }

  return message
}

export function buildCloudflareWorkersDevUrl(workerName: string, accountSubdomain: string) {
  return `https://${workerName}.${accountSubdomain}.workers.dev`
}

export function buildCloudflareProvisionExecutionOrder(projectMode: ServerProjectMode) {
  return projectMode === 'create'
    ? (['ensure-account-subdomain', 'deploy-worker', 'enable-worker-subdomain'] as const)
    : (['ensure-account-subdomain', 'enable-worker-subdomain'] as const)
}

export function canRecoverCloudflareDeployFailure(options: {
  message: string
  accountSubdomain: string | null
  workerName: string
  workerNames: string[]
}) {
  return (
    isCloudflareWorkersDevOnboardingError(options.message) &&
    Boolean(options.accountSubdomain) &&
    options.workerNames.includes(options.workerName)
  )
}

export function formatCloudflareManualSetupNote(options: {
  targetRoot: string
  hasBackoffice: boolean
  accountId: string
  workerName: string
}): ProvisioningNote {
  const lines = [
    `Cloudflare Worker \`${options.workerName}\`의 배포 URL을 확인한 뒤 아래 파일에 직접 넣어주세요.`,
    '',
    path.join(options.targetRoot, 'frontend', '.env.local'),
    'MINIAPP_API_BASE_URL=<배포된 Worker URL>',
  ]

  if (options.hasBackoffice) {
    lines.push(
      '',
      path.join(options.targetRoot, 'backoffice', '.env.local'),
      'VITE_API_BASE_URL=<배포된 Worker URL>',
    )
  }

  lines.push(
    '',
    path.join(options.targetRoot, 'server', '.env.local'),
    createCloudflareServerEnvValues({
      accountId: options.accountId,
      workerName: options.workerName,
      apiBaseUrl: null,
      apiToken: '<optional api token>',
    }).trimEnd(),
    '',
    'server/.env.local 은 현재 Cloudflare Worker 메타데이터를 기록합니다.',
    'server/package.json 의 deploy 는 wrangler.jsonc 기준으로 원격 Worker를 다시 배포합니다.',
    'server/.env.local 의 CLOUDFLARE_API_TOKEN 은 비어 있으니, 필요하면 직접 채워 넣으세요.',
  )

  return {
    title: 'Cloudflare API URL 안내',
    body: lines.join('\n'),
  }
}

export async function writeCloudflareLocalEnvFiles(options: {
  targetRoot: string
  hasBackoffice: boolean
  apiBaseUrl: string
}) {
  const env = createCloudflareEnvValues(options.apiBaseUrl)
  const frontendEnvPath = path.join(options.targetRoot, 'frontend', '.env.local')

  await mkdir(path.dirname(frontendEnvPath), { recursive: true })
  await writeFile(frontendEnvPath, env.frontend, 'utf8')

  if (options.hasBackoffice) {
    const backofficeEnvPath = path.join(options.targetRoot, 'backoffice', '.env.local')
    await mkdir(path.dirname(backofficeEnvPath), { recursive: true })
    await writeFile(backofficeEnvPath, env.backoffice, 'utf8')
  }
}

export async function writeCloudflareServerLocalEnvFile(options: {
  targetRoot: string
  accountId: string
  workerName: string
  apiBaseUrl: string | null
}) {
  const serverEnvPath = path.join(options.targetRoot, 'server', '.env.local')
  let existingSource = ''

  if (await pathExists(serverEnvPath)) {
    existingSource = await readFile(serverEnvPath, 'utf8')
  }

  const lines = existingSource.length > 0 ? existingSource.split(/\r?\n/) : []
  const nextLines =
    lines.length > 0 ? [...lines] : ['# Cloudflare Worker metadata for this workspace.']

  let hasAccountId = false
  let hasWorkerName = false
  let hasApiBaseUrl = false
  let hasApiToken = false

  for (let index = 0; index < nextLines.length; index += 1) {
    const trimmed = nextLines[index]?.trim() ?? ''

    if (trimmed.startsWith('CLOUDFLARE_ACCOUNT_ID=')) {
      nextLines[index] = `CLOUDFLARE_ACCOUNT_ID=${options.accountId}`
      hasAccountId = true
      continue
    }

    if (trimmed.startsWith('CLOUDFLARE_WORKER_NAME=')) {
      nextLines[index] = `CLOUDFLARE_WORKER_NAME=${options.workerName}`
      hasWorkerName = true
      continue
    }

    if (trimmed.startsWith('CLOUDFLARE_API_BASE_URL=')) {
      nextLines[index] = `CLOUDFLARE_API_BASE_URL=${options.apiBaseUrl ?? ''}`
      hasApiBaseUrl = true
      continue
    }

    if (trimmed.startsWith('CLOUDFLARE_API_TOKEN=')) {
      hasApiToken = true
    }
  }

  if (!hasAccountId) {
    nextLines.push(`CLOUDFLARE_ACCOUNT_ID=${options.accountId}`)
  }

  if (!hasWorkerName) {
    nextLines.push(`CLOUDFLARE_WORKER_NAME=${options.workerName}`)
  }

  if (!hasApiBaseUrl) {
    nextLines.push(`CLOUDFLARE_API_BASE_URL=${options.apiBaseUrl ?? ''}`)
  }

  if (!hasApiToken) {
    nextLines.push('CLOUDFLARE_API_TOKEN=')
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
}

export async function provisionCloudflareWorker(
  options: ProvisionCloudflareWorkerOptions,
): Promise<ProvisionedCloudflareWorker | null> {
  const serverRoot = path.join(options.targetRoot, 'server')
  const auth = await ensureWranglerAuth(options.packageManager, options.targetRoot)
  const accounts = await listCloudflareAccounts(auth.oauthToken)
  const accountId = await selectCloudflareAccount(options.prompt, accounts)
  const existingWorkerNames = await listCloudflareWorkers(auth.oauthToken, accountId)

  let resolvedProjectMode = options.projectMode
  let workerName: string | null = null

  if (resolvedProjectMode === null) {
    const selectedWorker = await selectCloudflareWorker(options.prompt, existingWorkerNames, {
      includeCreateOption: true,
      message: '사용할 Cloudflare Worker를 선택하세요. 새 Worker 생성도 바로 할 수 있습니다.',
    })

    if (selectedWorker === CREATE_CLOUDFLARE_WORKER_SENTINEL) {
      resolvedProjectMode = 'create'
    } else {
      resolvedProjectMode = 'existing'
      workerName = selectedWorker
    }
  }

  if (resolvedProjectMode === 'existing' && !workerName) {
    workerName = await selectCloudflareWorker(options.prompt, existingWorkerNames)
  }

  if (resolvedProjectMode === 'create') {
    workerName = (
      await options.prompt.text({
        message: '배포할 Cloudflare Worker 이름을 입력하세요.',
        initialValue: options.appName,
        validate(value) {
          return value.trim().length === 0 ? 'Cloudflare Worker 이름을 입력하세요.' : undefined
        },
      })
    ).trim()
  }

  if (!workerName || !resolvedProjectMode) {
    throw new Error('연결할 Cloudflare Worker를 결정하지 못했습니다.')
  }

  await patchWranglerWorkerName(serverRoot, workerName)

  const executionOrder = buildCloudflareProvisionExecutionOrder(resolvedProjectMode)
  let accountSubdomain: string | null = null

  for (const step of executionOrder) {
    if (step === 'ensure-account-subdomain') {
      accountSubdomain = await ensureAccountSubdomain({
        authToken: auth.oauthToken,
        accountId,
        prompt: options.prompt,
        appName: options.appName,
      })
      continue
    }

    if (step === 'deploy-worker') {
      try {
        await deployCloudflareWorker(options.packageManager, serverRoot, workerName)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        try {
          const currentWorkerNames = await listCloudflareWorkers(auth.oauthToken, accountId)

          if (
            canRecoverCloudflareDeployFailure({
              message,
              accountSubdomain,
              workerName,
              workerNames: currentWorkerNames,
            })
          ) {
            log.message(
              'Cloudflare deploy가 workers.dev onboarding을 잘못 감지했지만 account subdomain과 업로드된 Worker를 확인해서 계속 진행합니다.',
            )
            continue
          }
        } catch {
          // Fall through to the original deploy error when post-checks cannot be completed.
        }

        throw error
      }
      continue
    }

    try {
      await ensureWorkerSubdomainEnabled(auth.oauthToken, accountId, workerName)
    } catch {
      return {
        accountId,
        workerName,
        apiBaseUrl: null,
        mode: resolvedProjectMode,
      }
    }
  }

  return {
    accountId,
    workerName,
    apiBaseUrl: accountSubdomain
      ? buildCloudflareWorkersDevUrl(workerName, accountSubdomain)
      : null,
    mode: resolvedProjectMode,
  }
}

export async function finalizeCloudflareProvisioning(options: {
  targetRoot: string
  provisionedWorker: ProvisionedCloudflareWorker | null
}) {
  if (!options.provisionedWorker) {
    return [
      {
        title: 'Cloudflare Worker 연결 건너뜀',
        body: '현재 실행에서는 원격 Cloudflare Worker 연결을 건너뛰었습니다. 필요하면 `--server-project-mode`를 지정하거나 인터랙티브 모드에서 기존/새 Worker를 선택하세요.',
      },
    ] satisfies ProvisioningNote[]
  }

  const hasBackoffice = await pathExists(path.join(options.targetRoot, 'backoffice'))
  await writeCloudflareServerLocalEnvFile({
    targetRoot: options.targetRoot,
    accountId: options.provisionedWorker.accountId,
    workerName: options.provisionedWorker.workerName,
    apiBaseUrl: options.provisionedWorker.apiBaseUrl,
  })
  const serverEnvSource = await readFile(
    path.join(options.targetRoot, 'server', '.env.local'),
    'utf8',
  )
  const hasApiToken = hasConfiguredCloudflareApiToken(serverEnvSource)

  if (options.provisionedWorker.apiBaseUrl) {
    await writeCloudflareLocalEnvFiles({
      targetRoot: options.targetRoot,
      hasBackoffice,
      apiBaseUrl: options.provisionedWorker.apiBaseUrl,
    })

    return [
      {
        title: 'Cloudflare API URL 작성 완료',
        body: [
          hasBackoffice
            ? 'frontend/.env.local 과 backoffice/.env.local 에 Cloudflare API URL을 작성했습니다.'
            : 'frontend/.env.local 에 Cloudflare API URL을 작성했습니다.',
          'server/.env.local 에 Cloudflare Worker 메타데이터를 작성했습니다.',
          'server/package.json 의 deploy 로 원격 Worker를 다시 배포할 수 있습니다.',
          ...(!hasApiToken
            ? [
                'server/.env.local 의 CLOUDFLARE_API_TOKEN 은 비어 있으니, 필요하면 직접 채워 넣으세요.',
              ]
            : []),
        ].join('\n'),
      },
    ] satisfies ProvisioningNote[]
  }

  return [
    formatCloudflareManualSetupNote({
      targetRoot: options.targetRoot,
      hasBackoffice,
      accountId: options.provisionedWorker.accountId,
      workerName: options.provisionedWorker.workerName,
    }),
  ]
}
