import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { stripVTControlCharacters } from 'node:util'
import { log } from '@clack/prompts'
import Cloudflare from 'cloudflare'
import envPaths from 'env-paths'
import { parse } from 'jsonc-parser'
import { parse as parseToml } from 'smol-toml'
import type { CommandSpec } from '../../runtime/command-spec.js'
import { WRANGLER_CLI } from '../../runtime/external-tooling.js'
import {
  createCloudflareVitestWranglerConfigSource,
  patchWranglerConfigSource,
} from '../../patching/jsonc.js'
import { runCommand, runCommandWithOutput, type CommandOutput } from '../../runtime/commands.js'
import type { CliPrompter } from '../../cli/index.js'
import { getPackageManagerAdapter, type PackageManager } from '../../runtime/package-manager.js'
import type { ProvisioningNote, ServerProjectMode } from '../../server/project.js'
import { pathExists } from '../../templates/filesystem.js'
import { promptShouldInitializeExistingRemoteContent } from '../shared.js'
import dedent, { dedentWithTrailingNewline } from '../../runtime/dedent.js'

type WranglerAuth = {
  oauthToken: string
  expirationTime: string | null
}

type CloudflareAccount = {
  id: string
  name: string
}

type WranglerD1Binding = {
  binding?: string
  database_id?: string
  database_name?: string
}

type WranglerR2Binding = {
  binding?: string
  bucket_name?: string
}

type CloudflareSubdomainResult = {
  subdomain?: string
}

export type ProvisionedCloudflareWorker = {
  accountId: string
  workerName: string
  apiBaseUrl: string | null
  d1DatabaseId: string
  d1DatabaseName: string
  r2BucketName: string
  mode: ServerProjectMode
  didInitializeRemoteContent: boolean
}

type ProvisionCloudflareWorkerOptions = {
  targetRoot: string
  packageManager: PackageManager
  prompt: CliPrompter
  projectMode: ServerProjectMode | null
  appName: string
}

const CREATE_CLOUDFLARE_WORKER_SENTINEL = '__create_cloudflare_worker__'
const CREATE_CLOUDFLARE_D1_DATABASE_SENTINEL = '__create_cloudflare_d1_database__'
const CREATE_CLOUDFLARE_R2_BUCKET_SENTINEL = '__create_cloudflare_r2_bucket__'
const CLOUDFLARE_R2_RETRY_SENTINEL = '__retry_cloudflare_r2_enable__'
const CLOUDFLARE_R2_CANCEL_SENTINEL = '__cancel_cloudflare_r2_enable__'
const CLOUDFLARE_VERIFY_EMAIL_URL =
  'https://developers.cloudflare.com/fundamentals/setup/account/verify-email-address/'
const CLOUDFLARE_API_TOKENS_DASHBOARD_URL = 'https://dash.cloudflare.com/profile/api-tokens'
const CLOUDFLARE_CREATE_TOKEN_DOC_URL =
  'https://developers.cloudflare.com/fundamentals/api/get-started/create-token/'
const CLOUDFLARE_WORKERS_AUTH_DOC_URL =
  'https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/wrangler-legacy/authentication/'
const CLOUDFLARE_D1_BINDING_NAME = 'DB'
const CLOUDFLARE_R2_BINDING_NAME = 'STORAGE'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createCloudflareClient(authToken: string) {
  return new Cloudflare({
    apiToken: authToken,
  })
}

function buildWranglerCommand(
  packageManager: PackageManager,
  cwd: string,
  label: string,
  args: string[],
): CommandSpec {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    cwd,
    ...adapter.dlx(WRANGLER_CLI, args),
    label,
  }
}

export function buildCloudflareDeployCommand(packageManager: PackageManager): CommandSpec {
  if (packageManager === 'pnpm') {
    return {
      cwd: '.',
      command: 'pnpm',
      args: ['--dir', '.', 'run', 'deploy'],
      label: 'Cloudflare Worker deploy',
    }
  }

  const adapter = getPackageManagerAdapter(packageManager)

  return {
    cwd: '.',
    ...adapter.runScriptInDirectory('.', 'deploy'),
    label: 'Cloudflare Worker deploy',
  }
}

export function buildWranglerLoginArgs() {
  return ['login']
}

export function isCloudflareAuthenticationErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('authentication error') ||
    normalized.includes('invalid access token') ||
    normalized.includes('not authorized') ||
    normalized.includes('unauthorized')
  )
}

export function isCloudflareR2DisabledErrorMessage(message: string) {
  return message.includes('Please enable R2 through the Cloudflare Dashboard.')
}

function buildCloudflareR2OverviewUrl(accountId: string) {
  return `https://dash.cloudflare.com/${accountId}/r2/overview`
}

export function formatCloudflareR2EnableMessage(accountId: string) {
  return dedent`
    Cloudflare account에서 R2를 먼저 켜야 이 흐름을 계속할 수 있어요.
    아래 URL에서 R2를 켠 뒤, 같은 화면에서 다시 확인해 주세요.
    ${buildCloudflareR2OverviewUrl(accountId)}
  `
}

function createCloudflareEnvValues(apiBaseUrl: string) {
  return {
    frontend: dedentWithTrailingNewline`
  MINIAPP_API_BASE_URL=${apiBaseUrl}
`,
    backoffice: dedentWithTrailingNewline`
  VITE_API_BASE_URL=${apiBaseUrl}
`,
  }
}

function createCloudflareServerEnvValues(options: {
  accountId: string
  workerName: string
  d1DatabaseId: string
  d1DatabaseName: string
  r2BucketName: string
  apiToken?: string
}) {
  return dedentWithTrailingNewline`
  # Cloudflare Worker metadata for this workspace.
  CLOUDFLARE_ACCOUNT_ID=${options.accountId}
  CLOUDFLARE_WORKER_NAME=${options.workerName}
  CLOUDFLARE_D1_DATABASE_ID=${options.d1DatabaseId}
  CLOUDFLARE_D1_DATABASE_NAME=${options.d1DatabaseName}
  CLOUDFLARE_R2_BUCKET_NAME=${options.r2BucketName}
  CLOUDFLARE_API_TOKEN=${options.apiToken ?? ''}
`
}

function buildCloudflareApiTokenGuideLines() {
  return [
    '## Cloudflare API token',
    '브라우저 로그인 없이 다시 배포하거나 CI에서 쓸 때만 필요해요.',
    'Cloudflare Dashboard > My Profile > API Tokens 에서 토큰을 만들어 주세요.',
    '가장 빠른 방법은 `Edit Cloudflare Workers` 템플릿으로 시작하는 거예요.',
    '권한은 최소한 `Account > Workers Scripts > Write`, `Account > D1 > Write`, `Account > Workers R2 Storage > Write`를 포함해 주세요.',
    '토큰을 만들고 한 번만 보여주는 secret을 복사해서 `server/.env.local`의 `CLOUDFLARE_API_TOKEN=` 뒤에 붙여 넣으면 돼요.',
    CLOUDFLARE_API_TOKENS_DASHBOARD_URL,
    CLOUDFLARE_CREATE_TOKEN_DOC_URL,
    CLOUDFLARE_WORKERS_AUTH_DOC_URL,
  ]
}

function renderOptionalMarkdownLines(lines: string[]) {
  if (lines.length === 0) {
    return ''
  }

  return dedent`

    ${lines.join('\n')}
  `
}

function hasConfiguredCloudflareApiToken(source: string) {
  const tokenLine = source.match(/^CLOUDFLARE_API_TOKEN=(.*)$/m)?.[1]?.trim() ?? ''
  return tokenLine.length > 0
}

export function parseWranglerAuthSource(source: string): WranglerAuth | null {
  const parsed = parseToml(source)
  const oauthToken = typeof parsed.oauth_token === 'string' ? parsed.oauth_token : null

  if (!oauthToken) {
    return null
  }

  return {
    oauthToken,
    expirationTime: typeof parsed.expiration_time === 'string' ? parsed.expiration_time : null,
  }
}

export function parseWranglerAuthTokenOutput(output: Pick<CommandOutput, 'stdout' | 'stderr'>) {
  const source = stripVTControlCharacters(output.stdout).trim()

  if (!source) {
    return null
  }

  const payload = JSON.parse(source) as {
    token?: unknown
    expiration_time?: unknown
  }

  if (typeof payload.token !== 'string' || payload.token.length === 0) {
    return null
  }

  return {
    oauthToken: payload.token,
    expirationTime: typeof payload.expiration_time === 'string' ? payload.expiration_time : null,
  } satisfies WranglerAuth
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

  const legacyCandidates = [
    path.join(homeDir, '.wrangler', 'config', 'default.toml'),
    path.join(xdgConfigHome, '.wrangler', 'config', 'default.toml'),
    path.join(homeDir, 'Library', 'Application Support', '.wrangler', 'config', 'default.toml'),
    path.join(homeDir, 'Library', 'Preferences', '.wrangler', 'config', 'default.toml'),
    ...(appData ? [path.join(appData, '.wrangler', 'config', 'default.toml')] : []),
  ]

  if (options) {
    return legacyCandidates
  }

  const runtimePaths = envPaths('.wrangler', { suffix: '' })
  const runtimeCandidates = [
    path.join(runtimePaths.config, 'config', 'default.toml'),
    path.join(runtimePaths.data, 'config', 'default.toml'),
    ...legacyCandidates,
  ]

  return [...new Set(runtimeCandidates)]
}

async function readWranglerAuthToken(packageManager?: PackageManager, cwd?: string) {
  if (packageManager && cwd) {
    try {
      const output = await runCommandWithOutput(
        buildWranglerCommand(packageManager, cwd, 'Cloudflare Wrangler 인증 토큰 확인', [
          'auth',
          'token',
          '--json',
        ]),
      )
      const auth = parseWranglerAuthTokenOutput(output)

      if (auth) {
        return auth
      }
    } catch {}
  }

  for (const configPath of getWranglerConfigCandidates()) {
    if (!(await pathExists(configPath))) {
      continue
    }

    const source = await readFile(configPath, 'utf8')
    const auth = parseWranglerAuthSource(source)

    if (!auth) {
      continue
    }

    return auth
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
  const existingAuth = await readWranglerAuthToken(packageManager, cwd)

  if (existingAuth && !isWranglerAuthExpired(existingAuth)) {
    return existingAuth
  }

  return await refreshWranglerAuth(packageManager, cwd)
}

async function refreshWranglerAuth(packageManager: PackageManager, cwd: string) {
  log.step('Cloudflare Wrangler에 로그인할게요')
  await runCommand(
    buildWranglerCommand(
      packageManager,
      cwd,
      'Cloudflare Wrangler 로그인',
      buildWranglerLoginArgs(),
    ),
  )

  const nextAuth = await readWranglerAuthToken(packageManager, cwd)

  if (!nextAuth) {
    throw new Error('`wrangler login` 뒤에 인증 토큰을 찾지 못했어요.')
  }

  return nextAuth
}

async function listCloudflareAccounts(authToken: string) {
  const accounts: CloudflareAccount[] = []

  for await (const account of createCloudflareClient(authToken).accounts.list()) {
    if (account.id && account.name) {
      accounts.push({
        id: account.id,
        name: account.name,
      })
    }
  }

  return accounts
}

async function listCloudflareWorkers(authToken: string, accountId: string) {
  const workerNames: string[] = []

  for await (const script of createCloudflareClient(authToken).workers.scripts.list({
    account_id: accountId,
  })) {
    if (script.id) {
      workerNames.push(script.id)
    }
  }

  return workerNames
}

async function listCloudflareD1Databases(authToken: string, accountId: string) {
  const databases: Array<{ id: string; name: string }> = []

  for await (const database of createCloudflareClient(authToken).d1.database.list({
    account_id: accountId,
  })) {
    if (database.uuid && database.name) {
      databases.push({
        id: database.uuid,
        name: database.name,
      })
    }
  }

  return databases
}

async function listCloudflareR2Buckets(authToken: string, accountId: string) {
  const result = await createCloudflareClient(authToken).r2.buckets.list({
    account_id: accountId,
  })

  return (result.buckets ?? [])
    .map((bucket) => bucket.name?.trim() ?? null)
    .filter((bucketName): bucketName is string => Boolean(bucketName))
}

async function getAccountSubdomain(authToken: string, accountId: string) {
  return (await createCloudflareClient(authToken).workers.subdomains.get({
    account_id: accountId,
  })) satisfies CloudflareSubdomainResult
}

async function createAccountSubdomain(authToken: string, accountId: string, subdomain: string) {
  await createCloudflareClient(authToken).workers.subdomains.update({
    account_id: accountId,
    subdomain,
  })

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
    message: 'Cloudflare account workers.dev 서브도메인을 입력해 주세요.',
    initialValue: options.appName,
    validate(value) {
      return value.trim().length === 0 ? 'workers.dev 서브도메인을 입력해 주세요.' : undefined
    },
  })

  return await createAccountSubdomain(options.authToken, options.accountId, nextSubdomain.trim())
}

async function ensureWorkerSubdomainEnabled(
  authToken: string,
  accountId: string,
  workerName: string,
) {
  await createCloudflareClient(authToken).workers.scripts.subdomain.create(workerName, {
    account_id: accountId,
    enabled: true,
    previews_enabled: true,
  })
}

async function selectCloudflareAccount(prompt: CliPrompter, accounts: CloudflareAccount[]) {
  if (accounts.length === 0) {
    throw new Error('지금 바로 쓸 수 있는 Cloudflare account가 없어요.')
  }

  return await prompt.select({
    message: '사용할 Cloudflare account를 골라 주세요.',
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
    throw new Error(
      '지금 바로 쓸 수 있는 Cloudflare Worker가 없어요. 새 Worker를 먼저 만들어 주세요.',
    )
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
          label: '+ 새 Cloudflare Worker 만들기',
        },
      ]
    : workerOptions

  const initialValue =
    selectOptions.find((option) => option.value !== CREATE_CLOUDFLARE_WORKER_SENTINEL)?.value ??
    CREATE_CLOUDFLARE_WORKER_SENTINEL

  return await prompt.select({
    message: options?.message ?? '사용할 Cloudflare Worker를 골라 주세요.',
    options: selectOptions,
    initialValue,
  })
}

async function selectCloudflareD1Database(
  prompt: CliPrompter,
  databases: Array<{ id: string; name: string }>,
  options?: {
    includeCreateOption?: boolean
    message?: string
  },
) {
  if (databases.length === 0 && !options?.includeCreateOption) {
    throw new Error(
      '지금 바로 쓸 수 있는 Cloudflare D1 database가 없어요. 새 database를 먼저 만들어 주세요.',
    )
  }

  const databaseOptions = databases.map((database) => ({
    value: database.id,
    label: `${database.name} (${database.id})`,
  }))
  const selectOptions = options?.includeCreateOption
    ? [
        ...databaseOptions,
        {
          value: CREATE_CLOUDFLARE_D1_DATABASE_SENTINEL,
          label: '+ 새 Cloudflare D1 database 만들기',
        },
      ]
    : databaseOptions
  const initialValue =
    selectOptions.find((option) => option.value !== CREATE_CLOUDFLARE_D1_DATABASE_SENTINEL)
      ?.value ?? CREATE_CLOUDFLARE_D1_DATABASE_SENTINEL

  return await prompt.select({
    message: options?.message ?? '사용할 Cloudflare D1 database를 골라 주세요.',
    options: selectOptions,
    initialValue,
  })
}

async function selectCloudflareR2Bucket(
  prompt: CliPrompter,
  bucketNames: string[],
  options?: {
    includeCreateOption?: boolean
    message?: string
  },
) {
  if (bucketNames.length === 0 && !options?.includeCreateOption) {
    throw new Error(
      '지금 바로 쓸 수 있는 Cloudflare R2 bucket이 없어요. 새 bucket을 먼저 만들어 주세요.',
    )
  }

  const bucketOptions = bucketNames.map((bucketName) => ({
    value: bucketName,
    label: bucketName,
  }))
  const selectOptions = options?.includeCreateOption
    ? [
        ...bucketOptions,
        {
          value: CREATE_CLOUDFLARE_R2_BUCKET_SENTINEL,
          label: '+ 새 Cloudflare R2 bucket 만들기',
        },
      ]
    : bucketOptions
  const initialValue =
    selectOptions.find((option) => option.value !== CREATE_CLOUDFLARE_R2_BUCKET_SENTINEL)?.value ??
    CREATE_CLOUDFLARE_R2_BUCKET_SENTINEL

  return await prompt.select({
    message: options?.message ?? '사용할 Cloudflare R2 bucket을 골라 주세요.',
    options: selectOptions,
    initialValue,
  })
}

async function readWranglerConfig(serverRoot: string) {
  const wranglerConfigPath = path.join(serverRoot, 'wrangler.jsonc')

  if (!(await pathExists(wranglerConfigPath))) {
    return null
  }

  const source = await readFile(wranglerConfigPath, 'utf8')
  const parsed = parse(source, [], { allowTrailingComma: true })

  return isRecord(parsed) ? parsed : null
}

function findWranglerD1Binding(config: Record<string, unknown>, binding: string) {
  const databases = Array.isArray(config.d1_databases)
    ? config.d1_databases.filter((entry): entry is WranglerD1Binding => isRecord(entry))
    : []

  return databases.find((database) => database.binding === binding) ?? null
}

function findWranglerR2Binding(config: Record<string, unknown>, binding: string) {
  const buckets = Array.isArray(config.r2_buckets)
    ? config.r2_buckets.filter((entry): entry is WranglerR2Binding => isRecord(entry))
    : []

  return buckets.find((bucket) => bucket.binding === binding) ?? null
}

async function patchWranglerCloudflareBindings(
  serverRoot: string,
  patch: {
    workerName?: string
    accountId?: string
    d1Database?: {
      id: string
      name: string
    }
    r2BucketName?: string
  },
) {
  const wranglerConfigPath = path.join(serverRoot, 'wrangler.jsonc')
  const wranglerVitestConfigPath = path.join(serverRoot, 'wrangler.vitest.jsonc')

  if (!(await pathExists(wranglerConfigPath))) {
    return
  }

  const source = await readFile(wranglerConfigPath, 'utf8')
  const next = patchWranglerConfigSource(source, {
    ...(patch.workerName ? { name: patch.workerName } : {}),
    ...(patch.accountId ? { accountId: patch.accountId } : {}),
    ...(patch.d1Database
      ? {
          d1Database: {
            binding: CLOUDFLARE_D1_BINDING_NAME,
            databaseId: patch.d1Database.id,
            databaseName: patch.d1Database.name,
            remote: true,
          },
        }
      : {}),
    ...(patch.r2BucketName
      ? {
          r2Bucket: {
            binding: CLOUDFLARE_R2_BINDING_NAME,
            bucketName: patch.r2BucketName,
            remote: true,
          },
        }
      : {}),
  })

  await writeFile(wranglerConfigPath, next, 'utf8')

  if (await pathExists(wranglerVitestConfigPath)) {
    await writeFile(
      wranglerVitestConfigPath,
      createCloudflareVitestWranglerConfigSource(next),
      'utf8',
    )
  }
}

async function createCloudflareD1Database(
  packageManager: PackageManager,
  serverRoot: string,
  databaseName: string,
) {
  log.step('Cloudflare D1 database를 만들게요')
  await runCommand(
    buildWranglerCommand(packageManager, serverRoot, 'Cloudflare D1 database 생성', [
      'd1',
      'create',
      databaseName,
      '--binding',
      CLOUDFLARE_D1_BINDING_NAME,
      '--update-config',
      '--use-remote',
    ]),
  )

  const config = await readWranglerConfig(serverRoot)
  const binding = config ? findWranglerD1Binding(config, CLOUDFLARE_D1_BINDING_NAME) : null

  if (!binding?.database_id || !binding.database_name) {
    throw new Error('Cloudflare D1 binding을 wrangler.jsonc 에서 확인하지 못했습니다.')
  }

  return {
    id: binding.database_id,
    name: binding.database_name,
  }
}

async function createCloudflareR2Bucket(
  packageManager: PackageManager,
  serverRoot: string,
  bucketName: string,
) {
  log.step('Cloudflare R2 bucket을 만들게요')
  await runCommand(
    buildWranglerCommand(packageManager, serverRoot, 'Cloudflare R2 bucket 생성', [
      'r2',
      'bucket',
      'create',
      bucketName,
      '--binding',
      CLOUDFLARE_R2_BINDING_NAME,
      '--update-config',
      '--use-remote',
    ]),
  )

  const config = await readWranglerConfig(serverRoot)
  const binding = config ? findWranglerR2Binding(config, CLOUDFLARE_R2_BINDING_NAME) : null

  if (!binding?.bucket_name) {
    throw new Error('Cloudflare R2 binding을 wrangler.jsonc 에서 확인하지 못했습니다.')
  }

  return binding.bucket_name
}

async function withCloudflareR2EnableRetry<T>(
  prompt: CliPrompter,
  accountId: string,
  operation: () => Promise<T>,
) {
  while (true) {
    try {
      return await operation()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (!isCloudflareR2DisabledErrorMessage(message)) {
        throw error
      }

      log.message(formatCloudflareR2EnableMessage(accountId))

      const nextStep = await prompt.select({
        message: 'Cloudflare R2를 켠 뒤 다시 확인할까요?',
        options: [
          { label: '네, 다시 확인할게요', value: CLOUDFLARE_R2_RETRY_SENTINEL },
          { label: '아니요, 여기서 멈출게요', value: CLOUDFLARE_R2_CANCEL_SENTINEL },
        ],
        initialValue: CLOUDFLARE_R2_RETRY_SENTINEL,
      })

      if (nextStep === CLOUDFLARE_R2_RETRY_SENTINEL) {
        continue
      }

      throw new Error(formatCloudflareR2EnableMessage(accountId))
    }
  }
}

async function deployCloudflareWorker(packageManager: PackageManager, serverRoot: string) {
  log.step('Cloudflare Worker를 배포할게요')

  try {
    const output = await runCommandWithOutput({
      ...buildCloudflareDeployCommand(packageManager),
      cwd: serverRoot,
    })

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
    return dedent`
      Cloudflare 계정 이메일 인증이 필요해서 Worker 배포를 계속할 수 없어요.
      
      아래 문서를 보고 이메일 인증을 마친 뒤 다시 실행해 주세요.
      ${CLOUDFLARE_VERIFY_EMAIL_URL}
    `
  }

  if (isCloudflareWorkersDevOnboardingError(message)) {
    const onboardingUrlMatch = message.match(
      /https:\/\/dash\.cloudflare\.com\/\S*\/workers\/onboarding/,
    )
    const onboardingUrl =
      onboardingUrlMatch?.[0] ?? 'https://dash.cloudflare.com/?to=/:account/workers/onboarding'

    return dedent`
      Cloudflare account의 workers.dev 서브도메인 등록이 필요해서 Worker 배포를 계속할 수 없어요.
      
      아래 URL에서 workers.dev onboarding을 마친 뒤 다시 실행해 주세요.
      ${onboardingUrl}
    `
  }

  return message
}

export function buildCloudflareWorkersDevUrl(workerName: string, accountSubdomain: string) {
  return `https://${workerName}.${accountSubdomain}.workers.dev`
}

export function buildCloudflareProvisionExecutionOrder(
  projectMode: ServerProjectMode,
  shouldInitializeExistingRemoteContent = false,
) {
  if (projectMode === 'existing' && !shouldInitializeExistingRemoteContent) {
    return [] as const
  }

  return projectMode === 'create'
    ? (['ensure-account-subdomain', 'deploy-worker', 'enable-worker-subdomain'] as const)
    : (['ensure-account-subdomain', 'deploy-worker', 'enable-worker-subdomain'] as const)
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
  d1DatabaseId: string
  d1DatabaseName: string
  r2BucketName: string
  didInitializeRemoteContent?: boolean
}): ProvisioningNote {
  const skippedInitializationBlock =
    options.didInitializeRemoteContent === false
      ? dedent`

          기존 Cloudflare Worker를 골라서 원격 초기화는 자동으로 건너뛰었어요.
        `
      : ''
  const clientEnvGuidance = options.hasBackoffice
    ? 'frontend/.env.local 과 backoffice/.env.local placeholder는 자동으로 만들었어요.'
    : 'frontend/.env.local placeholder는 자동으로 만들었어요.'
  const tokenGuideBlock = renderOptionalMarkdownLines(buildCloudflareApiTokenGuideLines())
  const serverEnv = createCloudflareServerEnvValues({
    accountId: options.accountId,
    workerName: options.workerName,
    d1DatabaseId: options.d1DatabaseId,
    d1DatabaseName: options.d1DatabaseName,
    r2BucketName: options.r2BucketName,
    apiToken: '<optional api token>',
  }).trimEnd()

  return {
    title: 'Cloudflare Worker URL만 채워 주세요',
    body: dedent`
      ${clientEnvGuidance}
      Cloudflare Worker \`${options.workerName}\`의 배포 URL만 해당 파일의 빈 값에 채워 주세요.${skippedInitializationBlock}

      ${path.join(options.targetRoot, 'server', '.env.local')}
      ${serverEnv}

      server/.env.local 에는 Cloudflare Worker, D1, R2 메타데이터를 적어둬요.
      server/package.json 의 deploy 는 server/.env.local 의 auth 값을 읽고 wrangler.jsonc 기준으로 원격 Worker를 다시 배포해요.${tokenGuideBlock}
    `,
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
  d1DatabaseId: string
  d1DatabaseName: string
  r2BucketName: string
}) {
  const serverEnvPath = path.join(options.targetRoot, 'server', '.env.local')
  const removeLineSentinel = '__remove_cloudflare_server_api_base_url__'
  let existingSource = ''

  if (await pathExists(serverEnvPath)) {
    existingSource = await readFile(serverEnvPath, 'utf8')
  }

  const lines = existingSource.length > 0 ? existingSource.split(/\r?\n/) : []
  const nextLines =
    lines.length > 0 ? [...lines] : ['# Cloudflare Worker metadata for this workspace.']

  let hasAccountId = false
  let hasWorkerName = false
  let hasD1DatabaseId = false
  let hasD1DatabaseName = false
  let hasR2BucketName = false
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
      nextLines[index] = removeLineSentinel
      continue
    }

    if (trimmed.startsWith('CLOUDFLARE_D1_DATABASE_ID=')) {
      nextLines[index] = `CLOUDFLARE_D1_DATABASE_ID=${options.d1DatabaseId}`
      hasD1DatabaseId = true
      continue
    }

    if (trimmed.startsWith('CLOUDFLARE_D1_DATABASE_NAME=')) {
      nextLines[index] = `CLOUDFLARE_D1_DATABASE_NAME=${options.d1DatabaseName}`
      hasD1DatabaseName = true
      continue
    }

    if (trimmed.startsWith('CLOUDFLARE_R2_BUCKET_NAME=')) {
      nextLines[index] = `CLOUDFLARE_R2_BUCKET_NAME=${options.r2BucketName}`
      hasR2BucketName = true
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

  if (!hasD1DatabaseId) {
    nextLines.push(`CLOUDFLARE_D1_DATABASE_ID=${options.d1DatabaseId}`)
  }

  if (!hasD1DatabaseName) {
    nextLines.push(`CLOUDFLARE_D1_DATABASE_NAME=${options.d1DatabaseName}`)
  }

  if (!hasR2BucketName) {
    nextLines.push(`CLOUDFLARE_R2_BUCKET_NAME=${options.r2BucketName}`)
  }

  if (!hasApiToken) {
    nextLines.push('CLOUDFLARE_API_TOKEN=')
  }

  const normalizedSource = `${nextLines
    .filter((line, index, array) => {
      if (line === removeLineSentinel) {
        return false
      }

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
  let auth = await ensureWranglerAuth(options.packageManager, options.targetRoot)
  const withAuthRetry = async <T>(operation: (authToken: string) => Promise<T>) => {
    try {
      return await operation(auth.oauthToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (!isCloudflareAuthenticationErrorMessage(message)) {
        throw error
      }

      auth = await refreshWranglerAuth(options.packageManager, options.targetRoot)
      return await operation(auth.oauthToken)
    }
  }

  const accounts = await withAuthRetry((authToken) => listCloudflareAccounts(authToken))
  const accountId = await selectCloudflareAccount(options.prompt, accounts)
  const existingWorkerNames = await withAuthRetry((authToken) =>
    listCloudflareWorkers(authToken, accountId),
  )

  let resolvedProjectMode = options.projectMode
  let workerName: string | null = null
  let shouldInitializeExistingRemoteContent = false

  if (resolvedProjectMode === null) {
    const selectedWorker = await selectCloudflareWorker(options.prompt, existingWorkerNames, {
      includeCreateOption: true,
      message: '사용할 Cloudflare Worker를 골라 주세요. 새 Worker도 바로 만들 수 있어요.',
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
        message: '배포할 Cloudflare Worker 이름을 입력해 주세요.',
        initialValue: options.appName,
        validate(value) {
          return value.trim().length === 0 ? 'Cloudflare Worker 이름을 입력해 주세요.' : undefined
        },
      })
    ).trim()
  }

  if (!workerName || !resolvedProjectMode) {
    throw new Error('연결할 Cloudflare Worker를 정하지 못했어요.')
  }

  if (resolvedProjectMode === 'existing') {
    shouldInitializeExistingRemoteContent = await promptShouldInitializeExistingRemoteContent(
      options.prompt,
      '이 Cloudflare Worker의 원격에 있는 내용을 초기화할까요?',
    )
  }

  const allowRemoteInitialization =
    resolvedProjectMode === 'create' || shouldInitializeExistingRemoteContent

  const existingD1Databases = await withAuthRetry((authToken) =>
    listCloudflareD1Databases(authToken, accountId),
  )
  const selectedD1Database = await selectCloudflareD1Database(options.prompt, existingD1Databases, {
    includeCreateOption: allowRemoteInitialization,
    message: allowRemoteInitialization
      ? '사용할 Cloudflare D1 database를 골라 주세요. 새 database도 바로 만들 수 있어요.'
      : '사용할 Cloudflare D1 database를 골라 주세요.',
  })
  const d1Database =
    selectedD1Database === CREATE_CLOUDFLARE_D1_DATABASE_SENTINEL
      ? await createCloudflareD1Database(
          options.packageManager,
          serverRoot,
          (
            await options.prompt.text({
              message: '생성할 Cloudflare D1 database 이름을 입력해 주세요.',
              initialValue: `${options.appName}-db`,
              validate(value) {
                return value.trim().length === 0
                  ? 'Cloudflare D1 database 이름을 입력해 주세요.'
                  : undefined
              },
            })
          ).trim(),
        )
      : (existingD1Databases.find((database) => database.id === selectedD1Database) ?? null)

  if (!d1Database) {
    throw new Error('연결할 Cloudflare D1 database를 정하지 못했어요.')
  }

  const existingR2Buckets = await withCloudflareR2EnableRetry(options.prompt, accountId, () =>
    withAuthRetry((authToken) => listCloudflareR2Buckets(authToken, accountId)),
  )
  const selectedR2Bucket = await selectCloudflareR2Bucket(options.prompt, existingR2Buckets, {
    includeCreateOption: allowRemoteInitialization,
    message: allowRemoteInitialization
      ? '사용할 Cloudflare R2 bucket을 골라 주세요. 새 bucket도 바로 만들 수 있어요.'
      : '사용할 Cloudflare R2 bucket을 골라 주세요.',
  })
  const r2BucketName =
    selectedR2Bucket === CREATE_CLOUDFLARE_R2_BUCKET_SENTINEL
      ? await withCloudflareR2EnableRetry(
          options.prompt,
          accountId,
          async () =>
            await createCloudflareR2Bucket(
              options.packageManager,
              serverRoot,
              (
                await options.prompt.text({
                  message: '생성할 Cloudflare R2 bucket 이름을 입력해 주세요.',
                  initialValue: `${options.appName}-storage`,
                  validate(value) {
                    return value.trim().length === 0
                      ? 'Cloudflare R2 bucket 이름을 입력해 주세요.'
                      : undefined
                  },
                })
              ).trim(),
            ),
        )
      : selectedR2Bucket

  if (!r2BucketName) {
    throw new Error('연결할 Cloudflare R2 bucket을 정하지 못했어요.')
  }

  await patchWranglerCloudflareBindings(serverRoot, {
    workerName,
    accountId,
    d1Database,
    r2BucketName,
  })

  const executionOrder = buildCloudflareProvisionExecutionOrder(
    resolvedProjectMode,
    shouldInitializeExistingRemoteContent,
  )
  let accountSubdomain: string | null = null

  for (const step of executionOrder) {
    if (step === 'ensure-account-subdomain') {
      accountSubdomain = await withAuthRetry((authToken) =>
        ensureAccountSubdomain({
          authToken,
          accountId,
          prompt: options.prompt,
          appName: options.appName,
        }),
      )
      continue
    }

    if (step === 'deploy-worker') {
      try {
        await deployCloudflareWorker(options.packageManager, serverRoot)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        try {
          const currentWorkerNames = await withAuthRetry((authToken) =>
            listCloudflareWorkers(authToken, accountId),
          )

          if (
            canRecoverCloudflareDeployFailure({
              message,
              accountSubdomain,
              workerName,
              workerNames: currentWorkerNames,
            })
          ) {
            log.message(
              'Cloudflare deploy가 workers.dev onboarding을 잘못 감지했지만, account subdomain과 업로드된 Worker를 확인해서 그대로 이어갈게요.',
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
      await withAuthRetry((authToken) =>
        ensureWorkerSubdomainEnabled(authToken, accountId, workerName),
      )
    } catch {
      return {
        accountId,
        workerName,
        apiBaseUrl: null,
        d1DatabaseId: d1Database.id,
        d1DatabaseName: d1Database.name,
        r2BucketName,
        mode: resolvedProjectMode,
        didInitializeRemoteContent: allowRemoteInitialization,
      }
    }
  }

  return {
    accountId,
    workerName,
    apiBaseUrl: accountSubdomain
      ? buildCloudflareWorkersDevUrl(workerName, accountSubdomain)
      : null,
    d1DatabaseId: d1Database.id,
    d1DatabaseName: d1Database.name,
    r2BucketName,
    mode: resolvedProjectMode,
    didInitializeRemoteContent: allowRemoteInitialization,
  }
}

export async function finalizeCloudflareProvisioning(options: {
  targetRoot: string
  provisionedWorker: ProvisionedCloudflareWorker | null
}) {
  if (!options.provisionedWorker) {
    return [
      {
        title: 'Cloudflare Worker 연결은 이번엔 건너뛸게요',
        body: '이번 실행에서는 원격 Cloudflare Worker 연결을 건너뛰었어요. 필요하면 `--server-project-mode`를 주거나 인터랙티브 모드에서 기존 Worker나 새 Worker를 골라 주세요.',
      },
    ] satisfies ProvisioningNote[]
  }

  const hasBackoffice = await pathExists(path.join(options.targetRoot, 'backoffice'))
  await writeCloudflareServerLocalEnvFile({
    targetRoot: options.targetRoot,
    accountId: options.provisionedWorker.accountId,
    workerName: options.provisionedWorker.workerName,
    d1DatabaseId: options.provisionedWorker.d1DatabaseId,
    d1DatabaseName: options.provisionedWorker.d1DatabaseName,
    r2BucketName: options.provisionedWorker.r2BucketName,
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
        title: 'Cloudflare API URL을 적어뒀어요',
        body: dedent`
          ${
            hasBackoffice
              ? 'frontend/.env.local 과 backoffice/.env.local 에 Cloudflare API URL을 적어뒀어요.'
              : 'frontend/.env.local 에 Cloudflare API URL을 적어뒀어요.'
          }
          server/.env.local 에는 Cloudflare Worker, D1, R2 메타데이터를 적어뒀어요.
          ${
            options.provisionedWorker.didInitializeRemoteContent
              ? 'server/package.json 의 deploy 로 원격 Worker를 다시 배포할 수 있어요.'
              : '기존 Cloudflare Worker를 골라서 원격 초기화는 자동으로 건너뛰었어요.'
          }
          Cloudflare D1 binding은 ${CLOUDFLARE_D1_BINDING_NAME}, R2 binding은 ${CLOUDFLARE_R2_BINDING_NAME} 을 써요.
          ${renderOptionalMarkdownLines(!hasApiToken ? buildCloudflareApiTokenGuideLines() : [])}
        `,
      },
    ] satisfies ProvisioningNote[]
  }

  return [
    formatCloudflareManualSetupNote({
      targetRoot: options.targetRoot,
      hasBackoffice,
      accountId: options.provisionedWorker.accountId,
      workerName: options.provisionedWorker.workerName,
      d1DatabaseId: options.provisionedWorker.d1DatabaseId,
      d1DatabaseName: options.provisionedWorker.d1DatabaseName,
      r2BucketName: options.provisionedWorker.r2BucketName,
      didInitializeRemoteContent: options.provisionedWorker.didInitializeRemoteContent,
    }),
  ]
}
