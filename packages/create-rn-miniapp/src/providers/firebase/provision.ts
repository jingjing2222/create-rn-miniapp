import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
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
import { extractJsonPayload } from '../../providers/supabase/provision.js'
import {
  FIREBASE_DEFAULT_FUNCTION_REGION,
  patchFirebaseFunctionRegion,
  patchFirebaseServerProjectId,
  pathExists,
} from '../../templates/index.js'

type FirebaseProject = {
  projectId: string
  displayName?: string
}

type FirebaseWebApp = {
  appId: string
  displayName?: string
}

type FirebaseWebSdkConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

type GoogleCloudProjectBillingInfo = {
  name?: string
  projectId?: string
  billingAccountName?: string
  billingEnabled?: boolean
}

type GoogleCloudIamPolicyBinding = {
  role?: string
  members?: string[]
}

type GoogleCloudIamPolicy = {
  bindings?: GoogleCloudIamPolicyBinding[]
}

type GoogleCloudFirestoreDatabase = {
  name?: string
  locationId?: string
  type?: string
}

type GoogleCloudCliArchiveSpec = {
  fileName: string
  url: string
}

export type ProvisionedFirebaseProject = {
  projectId: string
  webAppId: string
  config: FirebaseWebSdkConfig | null
  functionRegion: string
  mode: ServerProjectMode
}

type ProvisionFirebaseProjectOptions = {
  targetRoot: string
  packageManager: PackageManager
  prompt: CliPrompter
  projectMode: ServerProjectMode | null
  appName: string
  displayName: string
}

const CREATE_FIREBASE_PROJECT_SENTINEL = '__create_firebase_project__'
const CREATE_FIREBASE_APP_SENTINEL = '__create_firebase_app__'
const FIREBASE_CONSOLE_SETTINGS_URL = (projectId: string) =>
  `https://console.firebase.google.com/project/${projectId}/settings/general/`
const FIREBASE_EXISTING_GCP_PROJECTS_DOC_URL =
  'https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project'
const FIREBASE_PRICING_URL = 'https://firebase.google.com/pricing'
const FIREBASE_FUNCTIONS_BUILD_SERVICE_ACCOUNT_DOC_URL =
  'https://cloud.google.com/functions/docs/troubleshooting#build-service-account'
const CLOUD_BUILD_SERVICE_ACCOUNT_ACCESS_DOC_URL =
  'https://cloud.google.com/build/docs/securing-builds/configure-access-for-cloud-build-service-account'
const GOOGLE_CLOUD_VERIFY_BILLING_URL =
  'https://docs.cloud.google.com/billing/docs/how-to/verify-billing-enabled'
const GOOGLE_CLOUD_INSTALL_URL = 'https://cloud.google.com/sdk/docs/install'
const FIREBASE_BLAZE_RETRY_SENTINEL = '__firebase_blaze_retry__'
const FIREBASE_BLAZE_CANCEL_SENTINEL = '__firebase_blaze_cancel__'
const FIREBASE_REQUIRED_BUILD_SERVICE_ACCOUNT_ROLES = [
  'roles/cloudbuild.builds.builder',
  'roles/run.builder',
] as const
const CLOUD_BUILD_API_SERVICE = 'cloudbuild.googleapis.com'
const FIRESTORE_API_SERVICE = 'firestore.googleapis.com'
const FIREBASE_BUILD_SERVICE_ACCOUNT_CHECK_RETRY_ATTEMPTS = 5
const FIREBASE_BUILD_SERVICE_ACCOUNT_CHECK_RETRY_DELAY_MS = 750
const FIRESTORE_DEFAULT_DATABASE_ID = '(default)'

const GOOGLE_CLOUD_PROJECT_BILLING_URL = (projectId: string) =>
  `https://console.cloud.google.com/billing/linkedaccount?project=${projectId}`
const GOOGLE_CLOUD_SERVICE_ACCOUNTS_URL = (projectId: string) =>
  `https://console.cloud.google.com/iam-admin/serviceaccounts?project=${projectId}`

const LOCAL_GOOGLE_CLOUD_CLI_ROOT = path.join(
  os.homedir(),
  '.create-rn-miniapp',
  'tools',
  'google-cloud-cli',
)
const LOCAL_GOOGLE_CLOUD_CLI_BINARY = path.join(
  LOCAL_GOOGLE_CLOUD_CLI_ROOT,
  'google-cloud-sdk',
  'bin',
  'gcloud',
)

export function buildFirebaseCommand(
  packageManager: PackageManager,
  cwd: string,
  label: string,
  args: string[],
): CommandSpec {
  const adapter = getPackageManagerAdapter(packageManager)

  return {
    cwd,
    ...adapter.dlx('firebase-tools', args),
    label,
  }
}

export function buildFirebaseFunctionsDeployCommand(
  packageManager: PackageManager,
  cwd: string,
  projectId: string,
) {
  return buildFirebaseCommand(packageManager, cwd, 'Firebase Functions 배포', [
    'deploy',
    '--only',
    'functions,firestore:rules,firestore:indexes',
    '--config',
    'firebase.json',
    '--project',
    projectId,
  ])
}

function unwrapFirebaseResult<T>(payload: unknown): T {
  if (payload && typeof payload === 'object') {
    if ('result' in payload) {
      return (payload as { result: T }).result
    }

    if ('results' in payload) {
      return (payload as { results: T }).results
    }
  }

  return payload as T
}

export function resolveGoogleCloudCliArchiveSpec(
  platform = process.platform,
  arch = process.arch,
): GoogleCloudCliArchiveSpec {
  if (platform === 'darwin' && arch === 'arm64') {
    return {
      fileName: 'google-cloud-cli-darwin-arm.tar.gz',
      url: 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-arm.tar.gz',
    }
  }

  if (platform === 'darwin' && arch === 'x64') {
    return {
      fileName: 'google-cloud-cli-darwin-x86_64.tar.gz',
      url: 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-x86_64.tar.gz',
    }
  }

  if (platform === 'linux' && arch === 'x64') {
    return {
      fileName: 'google-cloud-cli-linux-x86_64.tar.gz',
      url: 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz',
    }
  }

  if (platform === 'linux' && arch === 'arm64') {
    return {
      fileName: 'google-cloud-cli-linux-arm.tar.gz',
      url: 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-arm.tar.gz',
    }
  }

  throw new Error(
    [
      `자동 gcloud 설치를 지원하지 않는 환경입니다. (${platform}/${arch})`,
      GOOGLE_CLOUD_INSTALL_URL,
    ].join('\n'),
  )
}

function normalizeFirebaseProjects(payload: unknown) {
  const result = unwrapFirebaseResult<unknown>(payload)
  const projects = Array.isArray(result)
    ? result
    : Array.isArray((result as { results?: unknown[] } | null | undefined)?.results)
      ? ((result as { results: unknown[] }).results ?? [])
      : []

  const normalizedProjects: FirebaseProject[] = []

  for (const project of projects) {
    if (!project || typeof project !== 'object') {
      continue
    }

    const candidate = project as {
      projectId?: string
      displayName?: string
    }

    if (!candidate.projectId) {
      continue
    }

    normalizedProjects.push({
      projectId: candidate.projectId,
      displayName: candidate.displayName,
    })
  }

  return normalizedProjects
}

function normalizeFirebaseWebApps(payload: unknown) {
  const result = unwrapFirebaseResult<unknown>(payload)
  const apps = Array.isArray(result)
    ? result
    : Array.isArray((result as { apps?: unknown[] } | null | undefined)?.apps)
      ? ((result as { apps: unknown[] }).apps ?? [])
      : []

  const normalizedApps: FirebaseWebApp[] = []

  for (const app of apps) {
    if (!app || typeof app !== 'object') {
      continue
    }

    const candidate = app as {
      appId?: string
      displayName?: string
      appDisplayName?: string
    }

    if (!candidate.appId) {
      continue
    }

    normalizedApps.push({
      appId: candidate.appId,
      displayName: candidate.displayName ?? candidate.appDisplayName,
    })
  }

  return normalizedApps
}

function parseFirebaseWebSdkConfigPayload(output: string) {
  const objectMatch = output.match(/\{[\s\S]*\}/)

  if (!objectMatch) {
    throw new Error('Firebase Web SDK 설정 결과를 해석하지 못했습니다.')
  }

  const jsonLike = objectMatch[0]
    .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1')

  return JSON.parse(jsonLike) as Partial<FirebaseWebSdkConfig>
}

function normalizeFirebaseWebSdkConfig(payload: unknown) {
  const candidate =
    payload && typeof payload === 'object' && 'sdkConfig' in payload
      ? (payload as { sdkConfig: unknown }).sdkConfig
      : unwrapFirebaseResult<unknown>(payload)

  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Firebase Web SDK 설정 결과를 해석하지 못했습니다.')
  }

  const config = candidate as Partial<FirebaseWebSdkConfig>

  if (
    !config.apiKey ||
    !config.authDomain ||
    !config.projectId ||
    !config.storageBucket ||
    !config.messagingSenderId ||
    !config.appId
  ) {
    throw new Error('Firebase Web SDK 설정 값이 불완전합니다.')
  }

  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    measurementId: config.measurementId,
  } satisfies FirebaseWebSdkConfig
}

function createFirebaseEnvValues(config: FirebaseWebSdkConfig, functionRegion?: string) {
  return {
    frontend: [
      `MINIAPP_FIREBASE_API_KEY=${config.apiKey}`,
      `MINIAPP_FIREBASE_AUTH_DOMAIN=${config.authDomain}`,
      `MINIAPP_FIREBASE_PROJECT_ID=${config.projectId}`,
      `MINIAPP_FIREBASE_STORAGE_BUCKET=${config.storageBucket}`,
      `MINIAPP_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId}`,
      `MINIAPP_FIREBASE_APP_ID=${config.appId}`,
      `MINIAPP_FIREBASE_MEASUREMENT_ID=${config.measurementId ?? ''}`,
      `MINIAPP_FIREBASE_FUNCTION_REGION=${functionRegion ?? FIREBASE_DEFAULT_FUNCTION_REGION}`,
      '',
    ].join('\n'),
    backoffice: [
      `VITE_FIREBASE_API_KEY=${config.apiKey}`,
      `VITE_FIREBASE_AUTH_DOMAIN=${config.authDomain}`,
      `VITE_FIREBASE_PROJECT_ID=${config.projectId}`,
      `VITE_FIREBASE_STORAGE_BUCKET=${config.storageBucket}`,
      `VITE_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId}`,
      `VITE_FIREBASE_APP_ID=${config.appId}`,
      `VITE_FIREBASE_MEASUREMENT_ID=${config.measurementId ?? ''}`,
      '',
    ].join('\n'),
  }
}

function parseGoogleCloudProjectIamPolicyPayload(output: Pick<CommandOutput, 'stdout' | 'stderr'>) {
  const payload = extractJsonPayload<unknown>(output)

  if (!payload || typeof payload !== 'object') {
    throw new Error('Google Cloud IAM 정책을 해석하지 못했습니다.')
  }

  const candidate = payload as GoogleCloudIamPolicy

  return {
    bindings: Array.isArray(candidate.bindings) ? candidate.bindings : [],
  } satisfies GoogleCloudIamPolicy
}

function parseGoogleCloudFirestoreDatabasePayload(
  output: Pick<CommandOutput, 'stdout' | 'stderr'>,
) {
  const payload = extractJsonPayload<unknown>(output)

  if (!payload || typeof payload !== 'object') {
    throw new Error('Cloud Firestore database 정보를 해석하지 못했습니다.')
  }

  const candidate = payload as GoogleCloudFirestoreDatabase

  return {
    name: candidate.name,
    locationId: candidate.locationId,
    type: candidate.type,
  } satisfies GoogleCloudFirestoreDatabase
}

function createFirebaseServerEnvValues(
  projectId: string,
  functionRegion: string,
  token = '',
  credentials = '',
) {
  return [
    '# Firebase project metadata for this workspace.',
    `FIREBASE_PROJECT_ID=${projectId}`,
    `FIREBASE_FUNCTION_REGION=${functionRegion}`,
    `FIREBASE_TOKEN=${token}`,
    `GOOGLE_APPLICATION_CREDENTIALS=${credentials}`,
    '',
  ].join('\n')
}

function parseGoogleCloudBillingInfoPayload(output: string) {
  const objectMatch = output.match(/\{[\s\S]*\}/)

  if (!objectMatch) {
    throw new Error('Google Cloud billing 상태를 해석하지 못했습니다.')
  }

  return JSON.parse(objectMatch[0]) as GoogleCloudProjectBillingInfo
}

function formatFirebaseProjectLabel(project: FirebaseProject) {
  return project.displayName ? `${project.displayName} (${project.projectId})` : project.projectId
}

function formatFirebaseAppLabel(app: FirebaseWebApp) {
  return app.displayName ? `${app.displayName} (${app.appId})` : app.appId
}

function validateFirebaseProjectId(value: string) {
  const normalized = value.trim()

  if (!/^[a-z0-9-]{6,30}$/.test(normalized)) {
    return 'Firebase projectId는 6-30자의 소문자, 숫자, 하이픈만 사용할 수 있습니다.'
  }

  return undefined
}

export function isFirebaseProjectIdConflictError(message: string) {
  const normalized = message.toLowerCase()

  return (
    normalized.includes('there is already a project with id') ||
    normalized.includes('already exists a project with the id') ||
    (normalized.includes('project with id') &&
      normalized.includes('please try again with a unique project id'))
  )
}

export function isFirebaseProjectAddFirebaseRecoveryError(message: string) {
  const normalized = message.toLowerCase()

  return (
    normalized.includes('creating google cloud platform project') &&
    (normalized.includes('✔ creating google cloud platform project') ||
      normalized.includes('created google cloud platform project')) &&
    normalized.includes('adding firebase resources to google cloud platform project') &&
    (normalized.includes('✖ adding firebase resources to google cloud platform project') ||
      normalized.includes('failed to add firebase resources'))
  )
}

export function isFirebaseAddFirebasePermissionDeniedError(message: string) {
  const normalized = message.toLowerCase()

  return (
    normalized.includes(':addfirebase 403') &&
    normalized.includes('permission_denied') &&
    normalized.includes('the caller does not have permission')
  )
}

export function isFirebaseFunctionsBuildServiceAccountPermissionError(message: string) {
  const normalized = message.toLowerCase()

  return normalized.includes(
    'could not build the function due to a missing permission on the build service account',
  )
}

export function isFirebaseBillingEnabled(info: GoogleCloudProjectBillingInfo) {
  return info.billingEnabled === true
}

export function isGoogleCloudAuthRefreshError(message: string) {
  const normalized = message.toLowerCase()

  return (
    normalized.includes('invalid_grant') ||
    (normalized.includes('please run:') && normalized.includes('gcloud auth login')) ||
    normalized.includes('there was a problem refreshing your current auth tokens') ||
    normalized.includes('gcloud config set account')
  )
}

export function isGoogleCloudServiceDisabledError(message: string, service?: string) {
  const normalized = message.toLowerCase()
  const serviceDisabled =
    normalized.includes('service_disabled') ||
    normalized.includes('it is disabled') ||
    normalized.includes('has not been used in project')

  if (!serviceDisabled) {
    return false
  }

  if (!service) {
    return true
  }

  return normalized.includes(service.toLowerCase())
}

export function isFirebaseFirestoreDatabaseMissingError(message: string) {
  return /does not exist|NOT_FOUND|not found/i.test(message)
}

export function formatFirebaseBlazeUpgradeMessage(options: {
  projectId: string
  billingInfo: GoogleCloudProjectBillingInfo
}) {
  const billingState = options.billingInfo.billingEnabled === true ? 'true' : 'false'
  const billingAccount = options.billingInfo.billingAccountName?.trim().length
    ? options.billingInfo.billingAccountName
    : '(연결된 billing account 없음)'

  return [
    'Firebase Functions(2nd gen) 배포를 계속하려면 Blaze 플랜이 필요합니다.',
    '',
    `현재 프로젝트 \`${options.projectId}\` 는 아직 Blaze가 아닙니다. (\`billingEnabled=${billingState}\`)`,
    `연결된 billing account: ${billingAccount}`,
    '',
    '아래 링크에서 Blaze 플랜으로 올리거나 billing account를 활성화한 뒤 다시 확인하세요.',
    GOOGLE_CLOUD_PROJECT_BILLING_URL(options.projectId),
    FIREBASE_PRICING_URL,
    GOOGLE_CLOUD_VERIFY_BILLING_URL,
  ].join('\n')
}

function extractCloudBuildLogUrl(message: string) {
  return message.match(/https:\/\/console\.cloud\.google\.com\/cloud-build\/builds[^\s)]+/i)?.[0]
}

function trimLogSnippet(source: string, maxLines = 20) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return null
  }

  return lines.slice(-maxLines).join('\n')
}

async function readFirebaseDebugLog(cwd: string) {
  const debugLogPath = path.join(cwd, 'firebase-debug.log')

  if (!(await pathExists(debugLogPath))) {
    return null
  }

  try {
    const content = await readFile(debugLogPath, 'utf8')
    return {
      path: debugLogPath,
      content,
    }
  } catch {
    return {
      path: debugLogPath,
      content: '',
    }
  }
}

async function downloadGoogleCloudCliArchive(archivePath: string, spec: GoogleCloudCliArchiveSpec) {
  const response = await fetch(spec.url)

  if (!response.ok) {
    throw new Error(`gcloud CLI 다운로드에 실패했습니다. (${response.status})`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(archivePath, buffer)
}

async function installGoogleCloudCli(cwd: string) {
  const spec = resolveGoogleCloudCliArchiveSpec()
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-gcloud-'))
  const archivePath = path.join(tempDir, spec.fileName)

  try {
    log.step('gcloud CLI 자동 설치')
    await mkdir(LOCAL_GOOGLE_CLOUD_CLI_ROOT, { recursive: true })
    await rm(path.join(LOCAL_GOOGLE_CLOUD_CLI_ROOT, 'google-cloud-sdk'), {
      recursive: true,
      force: true,
    })
    await downloadGoogleCloudCliArchive(archivePath, spec)
    await runCommand({
      cwd,
      command: 'tar',
      args: ['-xzf', archivePath, '-C', LOCAL_GOOGLE_CLOUD_CLI_ROOT],
      label: 'gcloud CLI 압축 해제',
    })
    await runCommandWithOutput({
      cwd,
      command: LOCAL_GOOGLE_CLOUD_CLI_BINARY,
      args: ['--version'],
      label: 'gcloud CLI 검증',
    })

    return LOCAL_GOOGLE_CLOUD_CLI_BINARY
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function ensureGcloudCliInstalled(cwd: string) {
  try {
    await runCommandWithOutput({
      cwd,
      command: 'gcloud',
      args: ['--version'],
      label: 'gcloud CLI 확인',
    })
    return 'gcloud'
  } catch {
    if (await pathExists(LOCAL_GOOGLE_CLOUD_CLI_BINARY)) {
      await runCommandWithOutput({
        cwd,
        command: LOCAL_GOOGLE_CLOUD_CLI_BINARY,
        args: ['--version'],
        label: '로컬 gcloud CLI 확인',
      })
      return LOCAL_GOOGLE_CLOUD_CLI_BINARY
    }

    return await installGoogleCloudCli(cwd)
  }
}

async function describeGoogleCloudProjectBillingInfo(
  cwd: string,
  projectId: string,
  gcloudCommand: string,
) {
  const output = await runCommandWithOutput({
    cwd,
    command: gcloudCommand,
    args: ['billing', 'projects', 'describe', projectId, '--format=json'],
    label: 'Google Cloud billing 상태 확인',
  })

  return parseGoogleCloudBillingInfoPayload(`${output.stdout}\n${output.stderr}`)
}

function parseGoogleCloudDefaultBuildServiceAccount(
  output: Pick<CommandOutput, 'stdout' | 'stderr'>,
) {
  const combined = `${output.stdout}\n${output.stderr}`
  const emailMatch = combined.match(/[A-Za-z0-9-]+@[A-Za-z0-9.-]+/)

  if (!emailMatch) {
    throw new Error('Cloud Build 기본 service account를 해석하지 못했습니다.')
  }

  return emailMatch[0]
}

async function getGoogleCloudProjectIamPolicy(
  cwd: string,
  projectId: string,
  gcloudCommand: string,
) {
  const output = await runCommandWithOutput({
    cwd,
    command: gcloudCommand,
    args: ['projects', 'get-iam-policy', projectId, '--format=json'],
    label: 'Google Cloud IAM 권한 확인',
  })

  return parseGoogleCloudProjectIamPolicyPayload(output)
}

async function getGoogleCloudDefaultBuildServiceAccount(
  cwd: string,
  projectId: string,
  gcloudCommand: string,
) {
  const output = await runCommandWithOutput({
    cwd,
    command: gcloudCommand,
    args: ['builds', 'get-default-service-account', '--project', projectId],
    label: 'Cloud Build 기본 service account 확인',
  })

  return parseGoogleCloudDefaultBuildServiceAccount(output)
}

async function ensureGoogleCloudServiceAccountExists(
  cwd: string,
  projectId: string,
  serviceAccountEmail: string,
  gcloudCommand: string,
) {
  try {
    await runCommandWithOutput({
      cwd,
      command: gcloudCommand,
      args: [
        'iam',
        'service-accounts',
        'describe',
        serviceAccountEmail,
        '--project',
        projectId,
        '--format=json',
      ],
      label: 'Cloud Build service account 존재 확인',
    })

    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (isGoogleCloudAuthRefreshError(message)) {
      throw error
    }

    if (/does not exist|NOT_FOUND|not found/i.test(message)) {
      return false
    }

    throw error
  }
}

async function enableGoogleCloudServices(
  cwd: string,
  projectId: string,
  services: string[],
  gcloudCommand: string,
) {
  if (services.length === 0) {
    return
  }

  log.step(`Google Cloud API 활성화 (${services.join(', ')})`)
  await runCommandWithOutput({
    cwd,
    command: gcloudCommand,
    args: ['services', 'enable', ...services, '--project', projectId],
    label: `Google Cloud API 활성화 (${services.join(', ')})`,
  })
}

async function describeGoogleCloudFirestoreDatabase(
  cwd: string,
  projectId: string,
  gcloudCommand: string,
) {
  const output = await runCommandWithOutput({
    cwd,
    command: gcloudCommand,
    args: [
      'firestore',
      'databases',
      'describe',
      '--project',
      projectId,
      '--database',
      FIRESTORE_DEFAULT_DATABASE_ID,
      '--format=json',
    ],
    label: 'Cloud Firestore 기본 database 확인',
  })

  return parseGoogleCloudFirestoreDatabasePayload(output)
}

async function createGoogleCloudFirestoreDatabase(
  cwd: string,
  projectId: string,
  location: string,
  gcloudCommand: string,
) {
  log.step('Cloud Firestore 기본 database 준비')
  await runCommandWithOutput({
    cwd,
    command: gcloudCommand,
    args: [
      'firestore',
      'databases',
      'create',
      '--project',
      projectId,
      '--database',
      FIRESTORE_DEFAULT_DATABASE_ID,
      '--location',
      location,
      '--type',
      'firestore-native',
    ],
    label: 'Cloud Firestore 기본 database 생성',
  })
}

async function addGoogleCloudProjectIamBinding(
  cwd: string,
  projectId: string,
  member: string,
  role: string,
  gcloudCommand: string,
) {
  log.step('Firebase Functions build IAM 권한 보정')
  await runCommandWithOutput({
    cwd,
    command: gcloudCommand,
    args: ['projects', 'add-iam-policy-binding', projectId, '--member', member, '--role', role],
    label: `Google Cloud IAM 권한 추가 (${role})`,
  })
}

async function ensureGcloudAuth(cwd: string, gcloudCommand: string) {
  log.step('gcloud 로그인')
  await runCommand({
    cwd,
    command: gcloudCommand,
    args: ['auth', 'login'],
    label: 'gcloud 로그인',
  })
}

export async function ensureFirebaseProjectIsOnBlazePlan(options: {
  cwd: string
  projectId: string
  prompt: CliPrompter
  ensureGcloudInstalled?: (cwd: string) => Promise<string>
  describeBillingInfo?: (cwd: string, projectId: string) => Promise<GoogleCloudProjectBillingInfo>
  ensureGcloudAuth?: (cwd: string, gcloudCommand: string) => Promise<void>
  logMessage?: (message: string) => void
}) {
  const gcloudCommand = await (options.ensureGcloudInstalled ?? ensureGcloudCliInstalled)(
    options.cwd,
  )

  const describeBillingInfo =
    options.describeBillingInfo ??
    (async (cwd: string, projectId: string) =>
      await describeGoogleCloudProjectBillingInfo(cwd, projectId, gcloudCommand))
  const ensureAuth = options.ensureGcloudAuth ?? ensureGcloudAuth
  const logMessage = options.logMessage ?? ((message: string) => log.message(message))

  while (true) {
    let billingInfo: GoogleCloudProjectBillingInfo

    try {
      billingInfo = await describeBillingInfo(options.cwd, options.projectId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (!isGoogleCloudAuthRefreshError(message)) {
        throw error
      }

      await ensureAuth(options.cwd, gcloudCommand)
      continue
    }

    if (isFirebaseBillingEnabled(billingInfo)) {
      return billingInfo
    }

    logMessage(
      formatFirebaseBlazeUpgradeMessage({
        projectId: options.projectId,
        billingInfo,
      }),
    )

    const nextStep = await options.prompt.select({
      message: 'Blaze 플랜으로 변경한 뒤 다시 확인할까요?',
      options: [
        { label: '네, 다시 확인', value: FIREBASE_BLAZE_RETRY_SENTINEL },
        { label: '아니오, 중단', value: FIREBASE_BLAZE_CANCEL_SENTINEL },
      ],
      initialValue: FIREBASE_BLAZE_RETRY_SENTINEL,
    })

    if (nextStep === FIREBASE_BLAZE_RETRY_SENTINEL) {
      continue
    }

    throw new Error('Firebase Functions 배포 전 Blaze 플랜이 필요합니다.')
  }
}

function hasGoogleCloudIamBinding(policy: GoogleCloudIamPolicy, member: string, role: string) {
  return (
    policy.bindings?.some(
      (binding) => binding.role === role && binding.members?.includes(member) === true,
    ) ?? false
  )
}

export async function ensureFirebaseBuildServiceAccountPermissions(options: {
  cwd: string
  projectId: string
  ensureGcloudInstalled?: (cwd: string) => Promise<string>
  ensureGcloudAuth?: (cwd: string, gcloudCommand: string) => Promise<void>
  getDefaultBuildServiceAccount?: (cwd: string, projectId: string) => Promise<string>
  ensureBuildServiceAccountExists?: (
    cwd: string,
    projectId: string,
    serviceAccountEmail: string,
  ) => Promise<boolean>
  enableGoogleCloudServices?: (cwd: string, projectId: string, services: string[]) => Promise<void>
  getProjectIamPolicy?: (cwd: string, projectId: string) => Promise<GoogleCloudIamPolicy>
  addProjectIamBinding?: (
    cwd: string,
    projectId: string,
    member: string,
    role: string,
  ) => Promise<void>
  logMessage?: (message: string) => void
  wait?: (ms: number) => Promise<void>
}) {
  const gcloudCommand = await (options.ensureGcloudInstalled ?? ensureGcloudCliInstalled)(
    options.cwd,
  )
  const ensureAuth = options.ensureGcloudAuth ?? ensureGcloudAuth
  const logMessage = options.logMessage ?? ((message: string) => log.message(message))
  const wait =
    options.wait ??
    (async (ms: number) => {
      await new Promise((resolve) => setTimeout(resolve, ms))
    })
  const getDefaultBuildServiceAccount =
    options.getDefaultBuildServiceAccount ??
    (async (cwd: string, projectId: string) =>
      await getGoogleCloudDefaultBuildServiceAccount(cwd, projectId, gcloudCommand))
  const ensureBuildServiceAccountExists =
    options.ensureBuildServiceAccountExists ??
    (async (cwd: string, projectId: string, serviceAccountEmail: string) =>
      await ensureGoogleCloudServiceAccountExists(
        cwd,
        projectId,
        serviceAccountEmail,
        gcloudCommand,
      ))
  const enableServices =
    options.enableGoogleCloudServices ??
    (async (cwd: string, projectId: string, services: string[]) =>
      await enableGoogleCloudServices(cwd, projectId, services, gcloudCommand))
  const getProjectIamPolicy =
    options.getProjectIamPolicy ??
    (async (cwd: string, projectId: string) =>
      await getGoogleCloudProjectIamPolicy(cwd, projectId, gcloudCommand))
  const addProjectIamBinding =
    options.addProjectIamBinding ??
    (async (cwd: string, projectId: string, member: string, role: string) =>
      await addGoogleCloudProjectIamBinding(cwd, projectId, member, role, gcloudCommand))

  while (true) {
    let buildServiceAccountEmail: string | null = null
    let policy: GoogleCloudIamPolicy | null = null

    try {
      for (
        let attempt = 1;
        attempt <= FIREBASE_BUILD_SERVICE_ACCOUNT_CHECK_RETRY_ATTEMPTS;
        attempt += 1
      ) {
        logMessage(
          `Cloud Build 기본 service account를 확인하는 중이에요. (${attempt}/${FIREBASE_BUILD_SERVICE_ACCOUNT_CHECK_RETRY_ATTEMPTS})`,
        )
        buildServiceAccountEmail = await getDefaultBuildServiceAccount(
          options.cwd,
          options.projectId,
        )

        const buildServiceAccountExists = await ensureBuildServiceAccountExists(
          options.cwd,
          options.projectId,
          buildServiceAccountEmail,
        )

        if (buildServiceAccountExists) {
          break
        }

        if (attempt < FIREBASE_BUILD_SERVICE_ACCOUNT_CHECK_RETRY_ATTEMPTS) {
          await wait(FIREBASE_BUILD_SERVICE_ACCOUNT_CHECK_RETRY_DELAY_MS)
          continue
        }

        throw new Error(
          [
            `Cloud Build 기본 service account \`${buildServiceAccountEmail}\` 가 존재하지 않습니다.`,
            '이 계정이 막 만들어지는 중이면 잠깐 뒤에 다시 확인해 보는 게 좋아요.',
            '계속 보이지 않으면 이 계정이 삭제된 상태일 수 있어서 복구하거나 Cloud Build 기본 service account 설정을 다시 확인해야 해요.',
            '참고 문서: https://cloud.google.com/build/docs/cloud-build-service-account-updates',
          ].join('\n'),
        )
      }

      policy = await getProjectIamPolicy(options.cwd, options.projectId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (isGoogleCloudServiceDisabledError(message, CLOUD_BUILD_API_SERVICE)) {
        await enableServices(options.cwd, options.projectId, [CLOUD_BUILD_API_SERVICE])
        continue
      }

      if (!isGoogleCloudAuthRefreshError(message)) {
        throw error
      }

      await ensureAuth(options.cwd, gcloudCommand)
      continue
    }

    if (!buildServiceAccountEmail || !policy) {
      throw new Error('Cloud Build 기본 service account 확인 결과를 정리하지 못했어요.')
    }

    const buildServiceAccountMember = `serviceAccount:${buildServiceAccountEmail}`
    const missingRoles = FIREBASE_REQUIRED_BUILD_SERVICE_ACCOUNT_ROLES.filter(
      (role) => !hasGoogleCloudIamBinding(policy, buildServiceAccountMember, role),
    )

    if (missingRoles.length === 0) {
      return
    }

    try {
      for (const role of missingRoles) {
        await addProjectIamBinding(options.cwd, options.projectId, buildServiceAccountMember, role)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (!isGoogleCloudAuthRefreshError(message)) {
        throw error
      }

      await ensureAuth(options.cwd, gcloudCommand)
    }
  }
}

export function formatFirebaseAddFirebaseFailureMessage(options: {
  projectId: string
  cwd: string
  rawMessage: string
  debugLogContent?: string
}) {
  const debugLogPath = path.join(options.cwd, 'firebase-debug.log')

  if (
    options.debugLogContent &&
    isFirebaseAddFirebasePermissionDeniedError(options.debugLogContent)
  ) {
    return [
      'Firebase 리소스를 붙이는 중에 실패했어요.',
      '',
      `Google Cloud 프로젝트 \`${options.projectId}\` 는 생성됐지만 Firebase를 붙이는 API가 \`403 PERMISSION_DENIED\` 로 거절됐습니다.`,
      '보통은 지금 로그인한 계정에 해당 프로젝트에서 Firebase를 활성화할 권한이 없거나, Firebase Terms of Service를 아직 수락하지 않은 경우예요.',
      '',
      '이렇게 확인해 주세요',
      '- https://console.firebase.google.com/ 에 로그인해서 Firebase Terms of Service를 먼저 수락해 주세요.',
      `- 프로젝트 \`${options.projectId}\` 의 IAM에서 지금 계정에 Owner 또는 Editor 권한이 있는지 확인해 주세요.`,
      `- 권한 정리 뒤에 \`yarn dlx firebase-tools projects:addfirebase ${options.projectId}\` 로 다시 시도해 주세요.`,
      `- 자세한 원본 로그: ${debugLogPath}`,
      `- 참고 문서: ${FIREBASE_EXISTING_GCP_PROJECTS_DOC_URL}`,
    ].join('\n')
  }

  return `${options.rawMessage}\n상세 로그: ${debugLogPath}`
}

export function formatFirebaseFunctionsDeployFailureMessage(options: {
  projectId: string
  cwd: string
  rawMessage: string
  debugLogContent?: string
}) {
  const debugLogPath = path.join(options.cwd, 'firebase-debug.log')
  const combinedMessage = `${options.rawMessage}\n${options.debugLogContent ?? ''}`
  const rawOutputSnippet = trimLogSnippet(options.rawMessage, 12)
  const debugLogSnippet = options.debugLogContent
    ? trimLogSnippet(options.debugLogContent, 20)
    : null

  if (isFirebaseFunctionsBuildServiceAccountPermissionError(combinedMessage)) {
    const cloudBuildLogUrl = extractCloudBuildLogUrl(combinedMessage)

    return [
      'Firebase Functions를 배포하는 중에 실패했어요.',
      '',
      `프로젝트 \`${options.projectId}\` 의 함수 소스 업로드와 사전 build는 끝났지만, 원격 Cloud Build에서 build service account 권한 부족으로 이미지 빌드가 중단됐습니다.`,
      '이건 로컬 Yarn/PnP 문제가 아니라 Google Cloud IAM 또는 조직 정책 문제예요.',
      '',
      '이렇게 진행해 주세요',
      '- custom build service account를 쓰거나, default Compute Engine service account에 `roles/cloudbuild.builds.builder` 를 부여해 주세요.',
      `- Cloud Functions 문제 해결 가이드: ${FIREBASE_FUNCTIONS_BUILD_SERVICE_ACCOUNT_DOC_URL}`,
      `- Cloud Build service account 권한 가이드: ${CLOUD_BUILD_SERVICE_ACCOUNT_ACCESS_DOC_URL}`,
      ...(cloudBuildLogUrl ? [`- Cloud Build 로그: ${cloudBuildLogUrl}`] : []),
      `- 자세한 원본 로그: ${debugLogPath}`,
      '- 권한을 정리한 뒤 server/package.json의 deploy 스크립트로 다시 시도해 주세요.',
      ...(rawOutputSnippet ? ['', '원본 CLI 출력', rawOutputSnippet] : []),
      ...(debugLogSnippet ? ['', 'firebase-debug.log tail', debugLogSnippet] : []),
    ].join('\n')
  }

  return [
    options.rawMessage,
    `상세 로그: ${debugLogPath}`,
    ...(debugLogSnippet ? ['', 'firebase-debug.log tail', debugLogSnippet] : []),
  ].join('\n')
}

async function listFirebaseProjects(packageManager: PackageManager, cwd: string) {
  const output = await runCommandWithOutput(
    buildFirebaseCommand(packageManager, cwd, 'Firebase 프로젝트 목록 조회', [
      'projects:list',
      '--json',
    ]),
  )

  return normalizeFirebaseProjects(extractJsonPayload<unknown>(output))
}

async function ensureFirebaseProjects(packageManager: PackageManager, cwd: string) {
  try {
    return await listFirebaseProjects(packageManager, cwd)
  } catch {
    log.step('Firebase에 로그인할게요')
    await runCommand(buildFirebaseCommand(packageManager, cwd, 'Firebase 로그인하기', ['login']))
    return await listFirebaseProjects(packageManager, cwd)
  }
}

async function addFirebaseToExistingGoogleCloudProject(
  packageManager: PackageManager,
  cwd: string,
  projectId: string,
) {
  log.step('기존 Google Cloud 프로젝트에 Firebase를 연결할게요')

  try {
    await runCommandWithOutput(
      buildFirebaseCommand(packageManager, cwd, 'Firebase 리소스 연결', [
        'projects:addfirebase',
        projectId,
      ]),
    )
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error)
    const debugLog = await readFirebaseDebugLog(cwd)

    throw new Error(
      formatFirebaseAddFirebaseFailureMessage({
        projectId,
        cwd,
        rawMessage,
        debugLogContent: debugLog?.content,
      }),
    )
  }
}

export async function ensureFirebaseFirestoreReady(options: {
  cwd: string
  projectId: string
  databaseLocation: string
  ensureGcloudInstalled?: (cwd: string) => Promise<string>
  ensureGcloudAuth?: (cwd: string, gcloudCommand: string) => Promise<void>
  describeFirestoreDatabase?: (
    cwd: string,
    projectId: string,
  ) => Promise<GoogleCloudFirestoreDatabase>
  enableGoogleCloudServices?: (cwd: string, projectId: string, services: string[]) => Promise<void>
  createFirestoreDatabase?: (cwd: string, projectId: string, location: string) => Promise<void>
}) {
  const gcloudCommand = await (options.ensureGcloudInstalled ?? ensureGcloudCliInstalled)(
    options.cwd,
  )
  const ensureAuth = options.ensureGcloudAuth ?? ensureGcloudAuth
  const describeFirestoreDatabase =
    options.describeFirestoreDatabase ??
    (async (cwd: string, projectId: string) =>
      await describeGoogleCloudFirestoreDatabase(cwd, projectId, gcloudCommand))
  const enableServices =
    options.enableGoogleCloudServices ??
    (async (cwd: string, projectId: string, services: string[]) =>
      await enableGoogleCloudServices(cwd, projectId, services, gcloudCommand))
  const createFirestoreDatabase =
    options.createFirestoreDatabase ??
    (async (cwd: string, projectId: string, location: string) =>
      await createGoogleCloudFirestoreDatabase(cwd, projectId, location, gcloudCommand))

  while (true) {
    let shouldCreateDatabase = false

    try {
      await describeFirestoreDatabase(options.cwd, options.projectId)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (isGoogleCloudServiceDisabledError(message, FIRESTORE_API_SERVICE)) {
        await enableServices(options.cwd, options.projectId, [FIRESTORE_API_SERVICE])
        continue
      }

      if (isGoogleCloudAuthRefreshError(message)) {
        await ensureAuth(options.cwd, gcloudCommand)
        continue
      }

      if (!isFirebaseFirestoreDatabaseMissingError(message)) {
        throw error
      }

      shouldCreateDatabase = true
    }

    if (!shouldCreateDatabase) {
      return
    }

    try {
      await createFirestoreDatabase(options.cwd, options.projectId, options.databaseLocation)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (isGoogleCloudServiceDisabledError(message, FIRESTORE_API_SERVICE)) {
        await enableServices(options.cwd, options.projectId, [FIRESTORE_API_SERVICE])
        continue
      }

      if (isGoogleCloudAuthRefreshError(message)) {
        await ensureAuth(options.cwd, gcloudCommand)
        continue
      }

      if (/already exists|ALREADY_EXISTS/i.test(message)) {
        return
      }

      throw error
    }
  }
}

async function selectFirebaseProject(
  prompt: CliPrompter,
  projects: FirebaseProject[],
  options?: {
    includeCreateOption?: boolean
    message?: string
  },
) {
  if (projects.length === 0 && !options?.includeCreateOption) {
    throw new Error(
      '지금 바로 쓸 수 있는 Firebase 프로젝트가 없어요. 새 프로젝트를 먼저 만들어 주세요.',
    )
  }

  const projectOptions = projects.map((project) => ({
    value: project.projectId,
    label: formatFirebaseProjectLabel(project),
  }))
  const selectOptions = options?.includeCreateOption
    ? [
        ...projectOptions,
        {
          value: CREATE_FIREBASE_PROJECT_SENTINEL,
          label: '+ 새 Firebase 프로젝트 만들기',
        },
      ]
    : projectOptions

  return await prompt.select({
    message: options?.message ?? '사용할 Firebase 프로젝트를 골라 주세요.',
    options: selectOptions,
    initialValue: selectOptions[0]?.value,
  })
}

async function createFirebaseProject(
  packageManager: PackageManager,
  cwd: string,
  prompt: CliPrompter,
  appName: string,
  displayName: string,
) {
  let initialValue = appName

  while (true) {
    const projectId = (
      await prompt.text({
        message: '새 Firebase 프로젝트 ID를 입력해 주세요.',
        initialValue,
        validate: validateFirebaseProjectId,
      })
    ).trim()

    log.step('Firebase 프로젝트를 새로 만들게요')

    try {
      await runCommandWithOutput(
        buildFirebaseCommand(packageManager, cwd, 'Firebase 새 프로젝트 생성', [
          'projects:create',
          projectId,
          '--display-name',
          displayName,
        ]),
      )

      return projectId
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (isFirebaseProjectAddFirebaseRecoveryError(message)) {
        log.message(
          'Google Cloud 프로젝트는 만들어졌고 Firebase 리소스 연결만 실패했어요. 기존 프로젝트에 Firebase를 다시 연결해 볼게요.',
        )
        await addFirebaseToExistingGoogleCloudProject(packageManager, cwd, projectId)
        return projectId
      }

      if (!isFirebaseProjectIdConflictError(message)) {
        throw error
      }

      const existingFirebaseProjects = await listFirebaseProjects(packageManager, cwd).catch(
        () => [],
      )
      const isAlreadyFirebaseProject = existingFirebaseProjects.some(
        (project) => project.projectId === projectId,
      )

      if (!isAlreadyFirebaseProject) {
        log.message(
          '같은 projectId의 Google Cloud 프로젝트가 이미 있어서 Firebase 리소스 연결 복구를 시도할게요.',
        )

        try {
          await addFirebaseToExistingGoogleCloudProject(packageManager, cwd, projectId)
          return projectId
        } catch {
          // Fall through to the normal duplicate-id prompt flow.
        }
      }

      log.message(`이미 있는 Firebase 프로젝트 ID예요: ${projectId}`)
      log.message('다른 projectId를 입력해 주세요.')
      initialValue = `${projectId}-app`
    }
  }
}

async function listFirebaseWebApps(packageManager: PackageManager, cwd: string, projectId: string) {
  const output = await runCommandWithOutput(
    buildFirebaseCommand(packageManager, cwd, 'Firebase Web App 목록 조회', [
      'apps:list',
      'WEB',
      '--project',
      projectId,
      '--json',
    ]),
  )

  return normalizeFirebaseWebApps(extractJsonPayload<unknown>(output))
}

async function selectFirebaseWebApp(
  prompt: CliPrompter,
  apps: FirebaseWebApp[],
  options?: {
    includeCreateOption?: boolean
    message?: string
  },
) {
  if (apps.length === 0 && !options?.includeCreateOption) {
    throw new Error(
      '지금 바로 쓸 수 있는 Firebase Web App이 없어요. 새 Web App을 먼저 만들어 주세요.',
    )
  }

  const appOptions = apps.map((app) => ({
    value: app.appId,
    label: formatFirebaseAppLabel(app),
  }))
  const selectOptions = options?.includeCreateOption
    ? [
        ...appOptions,
        {
          value: CREATE_FIREBASE_APP_SENTINEL,
          label: '+ 새 Firebase Web App 만들기',
        },
      ]
    : appOptions

  return await prompt.select({
    message: options?.message ?? '사용할 Firebase Web App을 골라 주세요.',
    options: selectOptions,
    initialValue: selectOptions[0]?.value,
  })
}

async function createFirebaseWebApp(
  packageManager: PackageManager,
  cwd: string,
  projectId: string,
  displayName: string,
) {
  log.step('Firebase Web App을 만들게요')
  await runCommand(
    buildFirebaseCommand(packageManager, cwd, 'Firebase Web App 생성', [
      'apps:create',
      'WEB',
      displayName,
      '--project',
      projectId,
      '--json',
    ]),
  )
}

async function getFirebaseWebSdkConfig(
  packageManager: PackageManager,
  cwd: string,
  projectId: string,
  appId: string,
) {
  const output = await runCommandWithOutput(
    buildFirebaseCommand(packageManager, cwd, 'Firebase Web SDK 설정 조회', [
      'apps:sdkconfig',
      'WEB',
      appId,
      '--project',
      projectId,
    ]),
  )

  try {
    return normalizeFirebaseWebSdkConfig(extractJsonPayload<unknown>(output))
  } catch {
    return normalizeFirebaseWebSdkConfig(
      parseFirebaseWebSdkConfigPayload(`${output.stdout}\n${output.stderr}`),
    )
  }
}

async function selectFirebaseFunctionRegion(prompt: CliPrompter) {
  return await prompt.select({
    message: '배포할 Firebase Functions region을 골라 주세요.',
    options: [
      {
        value: FIREBASE_DEFAULT_FUNCTION_REGION,
        label: `${FIREBASE_DEFAULT_FUNCTION_REGION} (기본값)`,
      },
      { value: 'asia-southeast1', label: 'asia-southeast1' },
      { value: 'us-central1', label: 'us-central1' },
      { value: 'europe-west1', label: 'europe-west1' },
    ],
    initialValue: FIREBASE_DEFAULT_FUNCTION_REGION,
  })
}

async function installFirebaseFunctionsDependencies(
  packageManager: PackageManager,
  functionsRoot: string,
) {
  const adapter = getPackageManagerAdapter(packageManager)

  log.step('server/functions 의존성을 설치할게요')
  await runCommand({
    cwd: functionsRoot,
    ...adapter.install(),
    label: 'server/functions 의존성 설치하기',
  })
}

async function deployFirebaseFunctions(
  packageManager: PackageManager,
  serverRoot: string,
  projectId: string,
) {
  log.step('Firebase Functions를 배포할게요')
  try {
    await runCommand(buildFirebaseFunctionsDeployCommand(packageManager, serverRoot, projectId))
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error)
    const debugLog = await readFirebaseDebugLog(serverRoot)

    throw new Error(
      formatFirebaseFunctionsDeployFailureMessage({
        projectId,
        cwd: serverRoot,
        rawMessage,
        debugLogContent: debugLog?.content,
      }),
    )
  }
}

export async function writeFirebaseLocalEnvFiles(options: {
  targetRoot: string
  hasBackoffice: boolean
  functionRegion: string
  config: FirebaseWebSdkConfig
}) {
  const env = createFirebaseEnvValues(options.config, options.functionRegion)
  const frontendEnvPath = path.join(options.targetRoot, 'frontend', '.env.local')

  await mkdir(path.dirname(frontendEnvPath), { recursive: true })
  await writeFile(frontendEnvPath, env.frontend, 'utf8')

  if (options.hasBackoffice) {
    const backofficeEnvPath = path.join(options.targetRoot, 'backoffice', '.env.local')
    await mkdir(path.dirname(backofficeEnvPath), { recursive: true })
    await writeFile(backofficeEnvPath, env.backoffice, 'utf8')
  }
}

export async function writeFirebaseServerLocalEnvFile(options: {
  targetRoot: string
  projectId: string
  functionRegion: string
}) {
  const serverEnvPath = path.join(options.targetRoot, 'server', '.env.local')
  let existingSource = ''

  if (await pathExists(serverEnvPath)) {
    existingSource = await readFile(serverEnvPath, 'utf8')
  }

  const lines = existingSource.length > 0 ? existingSource.split(/\r?\n/) : []
  const nextLines =
    lines.length > 0 ? [...lines] : ['# Firebase project metadata for this workspace.']
  let hasProjectId = false
  let hasFunctionRegion = false
  let hasToken = false
  let hasConfiguredToken = false
  let hasCredentials = false
  let hasConfiguredCredentials = false

  for (let index = 0; index < nextLines.length; index += 1) {
    const trimmed = nextLines[index]?.trim() ?? ''

    if (trimmed.startsWith('FIREBASE_PROJECT_ID=')) {
      nextLines[index] = `FIREBASE_PROJECT_ID=${options.projectId}`
      hasProjectId = true
      continue
    }

    if (trimmed.startsWith('FIREBASE_FUNCTION_REGION=')) {
      nextLines[index] = `FIREBASE_FUNCTION_REGION=${options.functionRegion}`
      hasFunctionRegion = true
      continue
    }

    if (trimmed.startsWith('FIREBASE_TOKEN=')) {
      hasToken = true
      hasConfiguredToken = trimmed.slice('FIREBASE_TOKEN='.length).trim().length > 0
      continue
    }

    if (trimmed.startsWith('GOOGLE_APPLICATION_CREDENTIALS=')) {
      hasCredentials = true
      hasConfiguredCredentials =
        trimmed.slice('GOOGLE_APPLICATION_CREDENTIALS='.length).trim().length > 0
    }
  }

  if (!hasProjectId) {
    nextLines.push(`FIREBASE_PROJECT_ID=${options.projectId}`)
  }

  if (!hasFunctionRegion) {
    nextLines.push(`FIREBASE_FUNCTION_REGION=${options.functionRegion}`)
  }

  if (!hasToken) {
    nextLines.push('FIREBASE_TOKEN=')
  }

  if (!hasCredentials) {
    nextLines.push('GOOGLE_APPLICATION_CREDENTIALS=')
  }

  await mkdir(path.dirname(serverEnvPath), { recursive: true })
  await writeFile(
    serverEnvPath,
    `${nextLines.filter((line, index, array) => index !== array.length - 1 || line.length > 0).join('\n')}\n`,
    'utf8',
  )

  return {
    hasConfiguredToken,
    hasConfiguredCredentials,
  }
}

function createFirebaseDeployAuthLines(options: {
  packageManager: PackageManager
  projectId: string
  hasConfiguredToken: boolean
  hasConfiguredCredentials: boolean
}) {
  const missingKeys = [
    options.hasConfiguredToken ? null : '`FIREBASE_TOKEN`',
    options.hasConfiguredCredentials ? null : '`GOOGLE_APPLICATION_CREDENTIALS`',
  ].filter((value): value is string => value !== null)

  if (missingKeys.length === 0) {
    return [] satisfies string[]
  }

  const loginCommand = getPackageManagerAdapter(options.packageManager).dlxCommand(
    'firebase-tools',
    ['login:ci'],
  )
  const summary =
    missingKeys.length === 2
      ? `server/.env.local 의 ${missingKeys[0]}과 ${missingKeys[1]}는 비어 있어요.`
      : `server/.env.local 의 ${missingKeys[0]}은 비어 있어요.`
  const lines = ['## Firebase deploy auth', '', summary, '아래 값을 넣어 주세요.', '']

  if (!options.hasConfiguredToken) {
    lines.push(`- \`FIREBASE_TOKEN\`: \`${loginCommand}\``)
  }

  if (!options.hasConfiguredCredentials) {
    lines.push(
      `- \`GOOGLE_APPLICATION_CREDENTIALS\`: ${GOOGLE_CLOUD_SERVICE_ACCOUNTS_URL(options.projectId)}`,
    )
  }

  lines.push('- 발급 화면 예시는 `server/README.md`에 넣어뒀어요.')

  return lines
}

export function formatFirebaseManualSetupNote(options: {
  targetRoot: string
  packageManager: PackageManager
  hasBackoffice: boolean
  projectId: string
  functionRegion: string
  hasConfiguredToken: boolean
  hasConfiguredCredentials: boolean
}) {
  const env = createFirebaseEnvValues(
    {
      apiKey: '<Firebase Web API key>',
      authDomain: '<project-id>.firebaseapp.com',
      projectId: options.projectId,
      storageBucket: '<project-id>.firebasestorage.app',
      messagingSenderId: '<messagingSenderId>',
      appId: '<appId>',
    },
    options.functionRegion,
  )

  const lines = [
    'Firebase Web SDK 설정을 자동으로 가져오지 못했어요. 아래 URL에서 앱 설정을 확인한 뒤 직접 넣어 주세요.',
    '',
    FIREBASE_CONSOLE_SETTINGS_URL(options.projectId),
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
    createFirebaseServerEnvValues(
      options.projectId,
      options.functionRegion,
      options.hasConfiguredToken ? '<기존 값 유지>' : '',
      options.hasConfiguredCredentials ? '<기존 값 유지>' : '',
    ).trimEnd(),
    '',
    ...createFirebaseDeployAuthLines({
      packageManager: options.packageManager,
      projectId: options.projectId,
      hasConfiguredToken: options.hasConfiguredToken,
      hasConfiguredCredentials: options.hasConfiguredCredentials,
    }),
  )

  return {
    title: 'Firebase 연결 값을 이렇게 넣어 주세요',
    body: lines.join('\n'),
  } satisfies ProvisioningNote
}

export async function provisionFirebaseProject(
  options: ProvisionFirebaseProjectOptions,
): Promise<ProvisionedFirebaseProject | null> {
  const serverRoot = path.join(options.targetRoot, 'server')
  const functionsRoot = path.join(serverRoot, 'functions')
  const projects = await ensureFirebaseProjects(options.packageManager, options.targetRoot)

  let selectedProjectId: string | null = null
  let resolvedProjectMode = options.projectMode

  if (resolvedProjectMode === null) {
    const selectedProject = await selectFirebaseProject(options.prompt, projects, {
      includeCreateOption: true,
      message: '사용할 Firebase 프로젝트를 골라 주세요. 새 프로젝트도 바로 만들 수 있어요.',
    })

    if (selectedProject === CREATE_FIREBASE_PROJECT_SENTINEL) {
      resolvedProjectMode = 'create'
    } else {
      resolvedProjectMode = 'existing'
      selectedProjectId = selectedProject
    }
  }

  if (resolvedProjectMode === 'create') {
    selectedProjectId = await createFirebaseProject(
      options.packageManager,
      options.targetRoot,
      options.prompt,
      options.appName,
      options.displayName,
    )
  } else if (resolvedProjectMode === 'existing' && !selectedProjectId) {
    selectedProjectId = await selectFirebaseProject(options.prompt, projects)
  }

  if (!selectedProjectId || !resolvedProjectMode) {
    throw new Error('연결할 Firebase 프로젝트를 정하지 못했어요.')
  }

  await ensureFirebaseProjectIsOnBlazePlan({
    cwd: options.targetRoot,
    projectId: selectedProjectId,
    prompt: options.prompt,
  })
  await ensureFirebaseBuildServiceAccountPermissions({
    cwd: options.targetRoot,
    projectId: selectedProjectId,
  })

  const existingApps = await listFirebaseWebApps(
    options.packageManager,
    options.targetRoot,
    selectedProjectId,
  )
  let selectedAppId: string | null = null
  const selectedApp = await selectFirebaseWebApp(options.prompt, existingApps, {
    includeCreateOption: true,
    message: '사용할 Firebase Web App을 골라 주세요. 새 Web App도 바로 만들 수 있어요.',
  })

  if (selectedApp === CREATE_FIREBASE_APP_SENTINEL) {
    await createFirebaseWebApp(
      options.packageManager,
      options.targetRoot,
      selectedProjectId,
      options.displayName,
    )
    const refreshedApps = await listFirebaseWebApps(
      options.packageManager,
      options.targetRoot,
      selectedProjectId,
    )
    const previousAppIds = new Set(existingApps.map((app) => app.appId))
    const nextApp = refreshedApps.find((app) => !previousAppIds.has(app.appId))

    if (nextApp) {
      selectedAppId = nextApp.appId
    } else {
      selectedAppId = await selectFirebaseWebApp(options.prompt, refreshedApps)
    }
  } else {
    selectedAppId = selectedApp
  }

  if (!selectedAppId) {
    throw new Error('연결할 Firebase Web App을 정하지 못했어요.')
  }

  const functionRegion = await selectFirebaseFunctionRegion(options.prompt)

  await ensureFirebaseFirestoreReady({
    cwd: options.targetRoot,
    projectId: selectedProjectId,
    databaseLocation: functionRegion,
  })

  await patchFirebaseServerProjectId(options.targetRoot, selectedProjectId)
  await patchFirebaseFunctionRegion(options.targetRoot, functionRegion)
  await installFirebaseFunctionsDependencies(options.packageManager, functionsRoot)
  await deployFirebaseFunctions(options.packageManager, serverRoot, selectedProjectId)

  let config: FirebaseWebSdkConfig | null = null

  try {
    config = await getFirebaseWebSdkConfig(
      options.packageManager,
      options.targetRoot,
      selectedProjectId,
      selectedAppId,
    )
  } catch {
    config = null
  }

  return {
    projectId: selectedProjectId,
    webAppId: selectedAppId,
    config,
    functionRegion,
    mode: resolvedProjectMode,
  }
}

export async function finalizeFirebaseProvisioning(options: {
  targetRoot: string
  packageManager: PackageManager
  provisionedProject: ProvisionedFirebaseProject | null
}) {
  if (!options.provisionedProject) {
    return [
      {
        title: 'Firebase 프로젝트 연결은 이번엔 건너뛸게요',
        body: '이번 실행에서는 원격 Firebase 프로젝트 연결을 건너뛰었어요. 필요하면 `--server-project-mode`를 주거나 인터랙티브 모드에서 기존 프로젝트나 새 프로젝트를 골라 주세요.',
      },
    ] satisfies ProvisioningNote[]
  }

  const hasBackoffice = await pathExists(path.join(options.targetRoot, 'backoffice'))
  const serverEnv = await writeFirebaseServerLocalEnvFile({
    targetRoot: options.targetRoot,
    projectId: options.provisionedProject.projectId,
    functionRegion: options.provisionedProject.functionRegion,
  })

  if (options.provisionedProject.config) {
    await writeFirebaseLocalEnvFiles({
      targetRoot: options.targetRoot,
      hasBackoffice,
      functionRegion: options.provisionedProject.functionRegion,
      config: options.provisionedProject.config,
    })

    return [
      {
        title: 'Firebase 연결 값을 적어뒀어요',
        body: [
          hasBackoffice
            ? 'frontend/.env.local 과 backoffice/.env.local 에 Firebase Web SDK 연결 값을 적어뒀어요.'
            : 'frontend/.env.local 에 Firebase Web SDK 연결 값을 적어뒀어요.',
          'server/.env.local 에는 Firebase project 메타데이터를 적어뒀어요.',
          '',
          ...createFirebaseDeployAuthLines({
            packageManager: options.packageManager,
            projectId: options.provisionedProject.projectId,
            hasConfiguredToken: serverEnv.hasConfiguredToken,
            hasConfiguredCredentials: serverEnv.hasConfiguredCredentials,
          }),
        ].join('\n'),
      },
    ] satisfies ProvisioningNote[]
  }

  return [
    formatFirebaseManualSetupNote({
      targetRoot: options.targetRoot,
      packageManager: options.packageManager,
      hasBackoffice,
      projectId: options.provisionedProject.projectId,
      functionRegion: options.provisionedProject.functionRegion,
      hasConfiguredToken: serverEnv.hasConfiguredToken,
      hasConfiguredCredentials: serverEnv.hasConfiguredCredentials,
    }),
  ]
}
