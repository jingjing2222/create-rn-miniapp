import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { log } from '@clack/prompts'
import { patchWranglerConfigSource } from './ast.js'
import { runCommand, type CommandSpec } from './commands.js'
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

function parseWranglerAuthValue(source: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`^${escapedKey}\\s*=\\s*"([^"]+)"\\s*$`, 'm'))
  return match?.[1] ?? null
}

function getWranglerConfigCandidates() {
  const homeDir = os.homedir()
  const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config')

  return [
    path.join(homeDir, '.wrangler', 'config', 'default.toml'),
    path.join(xdgConfigHome, '.wrangler', 'config', 'default.toml'),
    path.join(homeDir, 'Library', 'Application Support', '.wrangler', 'config', 'default.toml'),
    ...(process.env.APPDATA
      ? [path.join(process.env.APPDATA, '.wrangler', 'config', 'default.toml')]
      : []),
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
  await runCommand(
    buildWranglerCommand(packageManager, serverRoot, 'Cloudflare Worker deploy', [
      'deploy',
      '--name',
      workerName,
    ]),
  )
}

export function buildCloudflareWorkersDevUrl(workerName: string, accountSubdomain: string) {
  return `https://${workerName}.${accountSubdomain}.workers.dev`
}

export function formatCloudflareManualSetupNote(options: {
  targetRoot: string
  hasBackoffice: boolean
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

  if (resolvedProjectMode === 'create') {
    await deployCloudflareWorker(options.packageManager, serverRoot, workerName)
  }

  const accountSubdomain = await ensureAccountSubdomain({
    authToken: auth.oauthToken,
    accountId,
    prompt: options.prompt,
    appName: options.appName,
  })

  try {
    await ensureWorkerSubdomainEnabled(auth.oauthToken, accountId, workerName)
  } catch {
    return {
      workerName,
      apiBaseUrl: null,
      mode: resolvedProjectMode,
    }
  }

  return {
    workerName,
    apiBaseUrl: buildCloudflareWorkersDevUrl(workerName, accountSubdomain),
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

  if (options.provisionedWorker.apiBaseUrl) {
    await writeCloudflareLocalEnvFiles({
      targetRoot: options.targetRoot,
      hasBackoffice,
      apiBaseUrl: options.provisionedWorker.apiBaseUrl,
    })

    return [
      {
        title: 'Cloudflare API URL 작성 완료',
        body: hasBackoffice
          ? 'frontend/.env.local 과 backoffice/.env.local 에 Cloudflare API URL을 작성했습니다.'
          : 'frontend/.env.local 에 Cloudflare API URL을 작성했습니다.',
      },
    ] satisfies ProvisioningNote[]
  }

  return [
    formatCloudflareManualSetupNote({
      targetRoot: options.targetRoot,
      hasBackoffice,
      workerName: options.provisionedWorker.workerName,
    }),
  ]
}
