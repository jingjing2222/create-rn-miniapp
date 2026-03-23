import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { minVersion } from 'semver'
import { renderProcessEnvLoaderScriptLines } from '../server/env-loader-script.js'
import { WRANGLER_CLI } from '../runtime/external-tooling.js'
import { getPackageManagerAdapter, type PackageManager } from '../runtime/package-manager.js'
import {
  getProviderClientContract,
  PROVIDER_CLIENT_CONTRACTS,
  resolveProviderClientLinkFiles,
} from '../server/client-contract.js'
import {
  SERVER_SCAFFOLD_STATE_DIR,
  SERVER_SCAFFOLD_STATE_RELATIVE_PATH,
  type ServerScaffoldState,
} from '../server/project.js'
import {
  createCloudflareServerScriptCatalog,
  createFirebaseServerScriptCatalog,
  createServerScriptRecord,
  createSupabaseServerScriptCatalog,
  renderServerRemoteOpsCommands,
  renderServerReadmeScriptLines,
  type ServerScriptCatalogEntry,
} from '../server/script-catalog.js'
import { renderServerReadmeCliVersionsSection } from '../server/readme-cli-versions.js'
import {
  pathExists,
  removePathIfExists,
  resolveTemplatesPackageRoot,
  writeWorkspaceNpmrc,
} from '../templates/filesystem.js'
import {
  applyServerPackageTemplate,
  applyWorkspaceProjectTemplate,
  FIREBASE_DEFAULT_FUNCTION_REGION,
  SUPABASE_DEFAULT_FUNCTION_NAME,
} from '../templates/server.js'
import {
  TRPC_SERVER_README_API_SSOT_LINES,
  TRPC_SERVER_README_OPERATION_NOTE,
  TRPC_SERVER_README_WORKSPACE_LINES,
} from '../templates/trpc.js'
import type { TemplateTokens } from '../templates/types.js'
import { createCloudflareVitestWranglerConfigSource, patchWranglerConfigSource } from './jsonc.js'
import {
  normalizeVitestTestScript,
  patchPackageJsonFile,
  prefixTrpcWorkspaceBuild,
  readPackageJson,
  removeToolingFiles,
  removeWorkspaceArtifacts,
  toolingDependencyNames,
  type PackageJson,
  type WorkspacePatchOptions,
  writeTextFile,
} from './shared.js'
import {
  APP_ROUTER_WORKSPACE_DEPENDENCY,
  CONTRACTS_WORKSPACE_DEPENDENCY,
  renderCloudflareServerIndexSource,
  renderCloudflareServerTrpcContextSource,
  TRPC_SERVER_VERSION,
} from './trpc.js'
import {
  CLOUDFLARE_TOKEN_GUIDE_ASSET_CANDIDATES,
  FIREBASE_LOGIN_CI_GUIDE_ASSET_CANDIDATES,
  FIREBASE_SERVICE_ACCOUNT_GUIDE_ASSET_CANDIDATES,
  SUPABASE_ACCESS_TOKEN_GUIDE_ASSET_CANDIDATES,
} from '../server/guide-assets.js'
import dedent, { dedentWithTrailingNewline } from '../runtime/dedent.js'

const CLOUDFLARE_SERVER_LOCAL_FILES = [
  '.gitignore',
  '.prettierrc',
  '.editorconfig',
  '.vscode',
  'AGENTS.md',
] as const

const WRANGLER_PACKAGE_NAME = 'wrangler'
const CLOUDFLARE_API_TOKENS_DASHBOARD_URL = 'https://dash.cloudflare.com/profile/api-tokens'
const CLOUDFLARE_CREATE_TOKEN_DOC_URL =
  'https://developers.cloudflare.com/fundamentals/api/get-started/create-token/'
const CLOUDFLARE_WORKERS_AUTH_DOC_URL =
  'https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/wrangler-legacy/authentication/'
const CLOUDFLARE_ROOT_GITIGNORE_ENTRY = 'server/worker-configuration.d.ts'
const CLOUDFLARE_ROOT_BIOME_IGNORE_ENTRY = '**/server/worker-configuration.d.ts'
const CLOUDFLARE_D1_BINDING_NAME = 'DB'
const CLOUDFLARE_R2_BINDING_NAME = 'STORAGE'
const FIREBASE_ROOT_GITIGNORE_ENTRY = 'server/functions/lib/'
const FIREBASE_ROOT_BIOME_IGNORE_ENTRY = '**/server/functions/lib/**'
const FIREBASE_YARN_PACKAGE_EXTENSION_KEY = '"@apphosting/build@*"'
const FIREBASE_YARN_PACKAGE_EXTENSION_BLOCK = dedent`
    "@apphosting/build@*":
      dependencies:
        yaml: "^2.4.1"
`
const SUPABASE_ACCESS_TOKENS_DASHBOARD_URL = 'https://supabase.com/dashboard/account/tokens'
const SUPABASE_MANAGEMENT_API_DOC_URL = 'https://supabase.com/docs/reference/api/introduction'
const SERVER_GUIDE_ASSET_TARGET_DIR = 'assets'
const FIREBASE_CLI_DOC_URL = 'https://firebase.google.com/docs/cli'
const FIREBASE_ADMIN_SETUP_URL = 'https://firebase.google.com/docs/admin/setup'
const GOOGLE_CLOUD_SERVICE_ACCOUNTS_CONSOLE_URL =
  'https://console.cloud.google.com/iam-admin/serviceaccounts'
const SERVER_SCAFFOLD_READ_ONLY_SCRIPTS = [
  'scripts/check-env.mjs',
  'scripts/check-client-links.mjs',
  'scripts/print-next-commands.mjs',
] as const

async function copyGuideAssets(
  serverRoot: string,
  sourcePathOverrides: readonly (string | null | undefined)[],
  assetCandidates?: readonly string[],
) {
  const overridePaths = sourcePathOverrides.filter(
    (sourcePath): sourcePath is string => typeof sourcePath === 'string' && sourcePath.length > 0,
  )
  const resolvedAssetCandidates =
    overridePaths.length > 0
      ? overridePaths
      : (assetCandidates ?? []).map((relativePath) =>
          path.join(resolveTemplatesPackageRoot(), relativePath),
        )
  const copiedPaths: string[] = []

  for (const sourcePath of resolvedAssetCandidates) {
    if (!(await pathExists(sourcePath))) {
      continue
    }

    const targetFileName = path.basename(sourcePath)
    const targetPath = path.join(serverRoot, SERVER_GUIDE_ASSET_TARGET_DIR, targetFileName)

    await mkdir(path.dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    copiedPaths.push(`./${SERVER_GUIDE_ASSET_TARGET_DIR}/${targetFileName}`)
  }

  return copiedPaths
}

async function writeServerScaffoldStateFile(serverRoot: string, state: ServerScaffoldState) {
  await mkdir(path.join(serverRoot, SERVER_SCAFFOLD_STATE_DIR), { recursive: true })
  await writeFile(
    path.join(serverRoot, SERVER_SCAFFOLD_STATE_RELATIVE_PATH),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  )
}

export async function writeServerScaffoldState(targetRoot: string, state: ServerScaffoldState) {
  const serverRoot = path.join(targetRoot, 'server')

  if (!(await pathExists(serverRoot))) {
    return
  }

  await writeServerScaffoldStateFile(serverRoot, state)
}

function renderServerCheckEnvScriptSource() {
  const providerEnvKeys = Object.fromEntries(
    Object.entries(PROVIDER_CLIENT_CONTRACTS).map(([provider, contract]) => [
      provider,
      contract.serverEnvKeys,
    ]),
  )
  const statePathExpr = '$' + '{statePath}'
  const readmeRelativePathExpr = '$' + '{readmeRelativePath}'
  const readmePathExpr = '$' + '{readmePath}'
  const envStatusExpr = '$' + "{existsSync(envPath) ? 'present' : 'missing'}"
  const envPathExpr = '$' + '{envPath}'
  const missingKeysExpr = '$' + "{missingKeys.join(', ')}"

  return dedentWithTrailingNewline`
  import { existsSync, readFileSync } from 'node:fs'
  import path from 'node:path'
  import { parseEnv } from 'node:util'
  import { fileURLToPath } from 'node:url'

  const PROVIDER_ENV_KEYS = ${JSON.stringify(providerEnvKeys, null, 2)}
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const statePath = path.join(serverRoot, ${JSON.stringify(SERVER_SCAFFOLD_STATE_RELATIVE_PATH)})
  const readmeRelativePath = 'server/README.md'
  const readmePath = path.join(serverRoot, 'README.md')
  const envPath = path.join(serverRoot, '.env.local')

  function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  }

  if (!existsSync(statePath)) {
    console.error(\`[server] missing scaffold state: ${statePathExpr}\`)
    process.exit(1)
  }

  const state = readJson(statePath)
  const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {}
  const providerKeys = PROVIDER_ENV_KEYS[state.serverProvider] ?? []
  const missingKeys = providerKeys.filter((key) => !(env[key] ?? "").trim())

  console.log(\`[server] state: ${statePathExpr}\`)
  console.log(\`[server] readme: ${readmeRelativePathExpr} (${readmePathExpr})\`)
  console.log(\`[server] env: ${envStatusExpr} (${envPathExpr})\`)

  if (missingKeys.length === 0) {
    console.log('[server] required provider env keys look present')
  } else {
    console.log(\`[server] missing env keys: ${missingKeysExpr}\`)
  }
`
}

function renderServerCheckClientLinksScriptSource() {
  const providerClientFiles = Object.fromEntries(
    (Object.keys(PROVIDER_CLIENT_CONTRACTS) as Array<keyof typeof PROVIDER_CLIENT_CONTRACTS>).map(
      (provider) => [
        provider,
        {
          default: resolveProviderClientLinkFiles(provider, { trpc: false, backoffice: false }),
          trpc: resolveProviderClientLinkFiles(provider, { trpc: true, backoffice: false }),
          backofficeDefault: resolveProviderClientLinkFiles(provider, {
            trpc: false,
            backoffice: true,
          }).filter((filePath) => filePath.startsWith('backoffice/')),
          backofficeTrpc: resolveProviderClientLinkFiles(provider, {
            trpc: true,
            backoffice: true,
          }).filter((filePath) => filePath.startsWith('backoffice/')),
        },
      ],
    ),
  )
  const statePathExpr = '$' + '{statePath}'
  const fileStatusExpr = '$' + "{existsSync(absolutePath) ? 'ok' : 'missing'}"
  const relativePathExpr = '$' + '{relativePath}'

  return dedentWithTrailingNewline`
  import { existsSync, readFileSync } from 'node:fs'
  import path from 'node:path'
  import { fileURLToPath } from 'node:url'

  const PROVIDER_CLIENT_FILES = ${JSON.stringify(providerClientFiles, null, 2)}
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const repoRoot = path.resolve(serverRoot, '..')
  const statePath = path.join(serverRoot, ${JSON.stringify(SERVER_SCAFFOLD_STATE_RELATIVE_PATH)})

  if (!existsSync(statePath)) {
    console.error(\`[server] missing scaffold state: ${statePathExpr}\`)
    process.exit(1)
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  const providerFiles = PROVIDER_CLIENT_FILES[state.serverProvider] ?? {}
  const frontendFiles = state.trpc ? providerFiles.trpc ?? [] : providerFiles.default ?? []
  const backofficeFiles = state.backoffice
    ? state.trpc
      ? providerFiles.backofficeTrpc ?? []
      : providerFiles.backofficeDefault ?? []
    : []
  const expectedFiles = [...frontendFiles, ...backofficeFiles]

  for (const relativePath of expectedFiles) {
    const absolutePath = path.join(repoRoot, relativePath)
    console.log(\`[server] ${fileStatusExpr}: ${relativePathExpr}\`)
  }
`
}

function renderServerPrintNextCommandsScriptSource(nextCommands: string[]) {
  const statePathExpr = '$' + '{statePath}'
  const remoteInitializationExpr = '$' + '{state.remoteInitialization}'
  const commandExpr = '$' + '{command}'

  return dedentWithTrailingNewline`
  import { existsSync, readFileSync } from 'node:fs'
  import path from 'node:path'
  import { fileURLToPath } from 'node:url'

  const NEXT_COMMANDS = ${JSON.stringify(nextCommands, null, 2)}
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const statePath = path.join(serverRoot, ${JSON.stringify(SERVER_SCAFFOLD_STATE_RELATIVE_PATH)})

  if (!existsSync(statePath)) {
    console.error(\`[server] missing scaffold state: ${statePathExpr}\`)
    process.exit(1)
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  const nextCommands = NEXT_COMMANDS

  console.log(\`[server] state: ${statePathExpr}\`)
  console.log(\`[server] remoteInitialization=${remoteInitializationExpr}\`)
  console.log('[server] read-only checks first:')
  console.log('- node ./scripts/check-env.mjs')
  console.log('- node ./scripts/check-client-links.mjs')
  console.log('- read server/README.md')
  console.log('[server] remote ops candidates:')
  for (const command of nextCommands) {
    console.log(\`- ${commandExpr}\`)
  }
`
}

async function writeServerScaffoldSupportFiles(
  serverRoot: string,
  state: ServerScaffoldState,
  nextCommands: string[],
) {
  await writeServerScaffoldStateFile(serverRoot, state)
  await writeTextFile(
    path.join(serverRoot, 'scripts', 'check-env.mjs'),
    renderServerCheckEnvScriptSource(),
  )
  await writeTextFile(
    path.join(serverRoot, 'scripts', 'check-client-links.mjs'),
    renderServerCheckClientLinksScriptSource(),
  )
  await writeTextFile(
    path.join(serverRoot, 'scripts', 'print-next-commands.mjs'),
    renderServerPrintNextCommandsScriptSource(nextCommands),
  )
}

function renderServerScaffoldStateSection() {
  const readOnlyScriptCommands = SERVER_SCAFFOLD_READ_ONLY_SCRIPTS.map(
    (filePath) => `\`node ./${filePath}\``,
  ).join(', ')

  return dedent`
    ## Scaffold State

    - scaffold 상태의 source of truth는 \`server/${SERVER_SCAFFOLD_STATE_RELATIVE_PATH}\`예요.
    - provider skill을 읽거나 원격 명령을 실행하기 전에 이 파일과 이 README를 먼저 확인해요.
    - read-only 확인용으로 ${readOnlyScriptCommands}를 먼저 실행해요.
    - state에는 provider, project mode, remoteInitialization, tRPC, backoffice 포함 여부가 들어 있어요.
  `
}

function renderServerRemoteOpsSection(commands: string[]) {
  return [
    '## Remote Ops',
    '',
    '- 아래 명령은 원격 상태를 바꿔요.',
    '- 실행 전에는 `server/.create-rn-miniapp/state.json`과 `server/README.md`를 먼저 확인해요.',
    ...commands.map((command) => `- 후보 명령: \`${command}\``),
  ]
}

function formatEnvKeys(keys: string[]) {
  return keys.map((key) => `\`${key}\``).join(', ')
}

function renderOptionalMarkdownLines(lines: string[]) {
  if (lines.length === 0) {
    return ''
  }

  return dedent`

    ${lines.join('\n')}
  `
}

function renderOptionalMarkdownSection(heading: string, lines: string[]) {
  if (lines.length === 0) {
    return ''
  }

  return dedent`

    ### ${heading}

    ${lines.join('\n')}
  `
}

async function copyCloudflareTokenGuideAsset(
  serverRoot: string,
  sourcePathOverride?: string | null,
) {
  const copiedPaths = await copyGuideAssets(
    serverRoot,
    [sourcePathOverride],
    CLOUDFLARE_TOKEN_GUIDE_ASSET_CANDIDATES,
  )

  return copiedPaths[0] ?? null
}

function renderCloudflareDeployScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.exec(WRANGLER_CLI.packageName, ['deploy'])

  return dedentWithTrailingNewline`
    import { spawnSync } from 'node:child_process'
    import { existsSync, readFileSync } from 'node:fs'
    import path from 'node:path'
    import process from 'node:process'
    import { fileURLToPath } from 'node:url'
    ${(renderProcessEnvLoaderScriptLines()).join('\n')}
    
    const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const envPath = path.join(serverRoot, '.env.local')
    
    loadLocalEnv(envPath)
    
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? ''
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? ''
    
    const commandEnv = { ...process.env }
    
    if (apiToken) {
      commandEnv.CLOUDFLARE_API_TOKEN = apiToken
    } else {
      delete commandEnv.CLOUDFLARE_API_TOKEN
    }
    
    if (accountId) {
      commandEnv.CLOUDFLARE_ACCOUNT_ID = accountId
    } else {
      delete commandEnv.CLOUDFLARE_ACCOUNT_ID
    }
    
    const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'
    const result = spawnSync(packageManagerCommand, ${JSON.stringify(command.args)}, {
      cwd: serverRoot,
      stdio: 'inherit',
      env: commandEnv,
    })
    
    if (typeof result.status === 'number') {
      process.exit(result.status)
    }
    
    if (result.error) {
      throw result.error
    }
    
    process.exit(1)
  `
}

function renderCloudflareVitestConfigSource() {
  return dedentWithTrailingNewline`
  import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

  export default defineWorkersConfig({
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.vitest.jsonc' },
        },
      },
    },
  })
`
}

function renderSupabaseServerReadme(options?: {
  packageManager: PackageManager
  scriptCatalog: ServerScriptCatalogEntry[]
  accessTokenGuideImagePaths?: string[] | null
}) {
  const contract = getProviderClientContract('supabase')
  const scriptLines = renderServerReadmeScriptLines(
    options?.scriptCatalog ?? [],
    options?.packageManager ?? 'pnpm',
  )
  const remoteOpsLines = renderServerRemoteOpsSection(
    renderServerRemoteOpsCommands(options?.scriptCatalog ?? [], options?.packageManager ?? 'pnpm'),
  )

  return dedentWithTrailingNewline`
    # server
    
    이 워크스페이스는 Supabase 프로젝트 연결, SQL migration, Edge Functions 배포를 관리하는 server 워크스페이스예요.
    
    ## 디렉토리 구조
    
    \`\`\`text
    server/
      supabase/config.toml
      supabase/migrations/
      supabase/functions/${SUPABASE_DEFAULT_FUNCTION_NAME}/index.ts
      scripts/supabase-db-apply.mjs
      scripts/supabase-functions-typecheck.mjs
      scripts/supabase-functions-deploy.mjs
      .env.local
      package.json
    \`\`\`
    
    ${renderServerScaffoldStateSection()}

    ${renderServerReadmeCliVersionsSection('supabase')}
    
    ## 주요 스크립트
    
    ${(scriptLines).join('\n')}
    
    ## Miniapp / Backoffice 연결
    
    - miniapp frontend는 \`frontend/src/lib/supabase.ts\`에서 Supabase client를 생성해요.
    - miniapp frontend \`.env.local\`은 \`${contract.frontend.envFile}\`에 두고 ${formatEnvKeys(contract.frontend.envKeys)}를 사용해요.
    - frontend \`scaffold.preset.ts\`가 \`.env.local\` 값을 읽어 ${formatEnvKeys(contract.frontend.envKeys)}를 주입하고, \`granite.config.ts\`는 그 scaffold preset만 연결해요.
    - miniapp frontend는 \`supabase.functions.invoke('${SUPABASE_DEFAULT_FUNCTION_NAME}')\` 형태로 Edge Function을 호출할 수 있어요.
    - backoffice가 있으면 \`backoffice/src/lib/supabase.ts\`에서 별도 browser client를 생성해요.
    - backoffice \`.env.local\`은 \`${contract.backoffice.envFile}\`에 두고 ${formatEnvKeys(contract.backoffice.envKeys)}를 사용해요.
    - backoffice도 ${formatEnvKeys(contract.backoffice.envKeys)}를 사용해요.
    - backoffice도 동일하게 \`supabase.functions.invoke('${SUPABASE_DEFAULT_FUNCTION_NAME}')\`를 사용할 수 있어요.
    
    ## 운영 메모
    
    - 원격 SQL push를 직접 실행하려면 \`server/.env.local\`의 \`SUPABASE_DB_PASSWORD\`를 채워주세요.
    - Supabase 원격 DB 반영은 스캐폴딩 중에 자동으로 하지 않아요. 필요하면 \`db:apply\`를 직접 실행해 주세요.
    - 기존 Supabase 프로젝트에 연결하면 먼저 원격 초기화 여부를 물어봐요.
    - 기존 프로젝트에서 원격 초기화를 건너뛰었다면 기본 Edge Function 배포도 자동으로 하지 않아요. 이 경우 필요할 때 \`functions:deploy\`를 직접 실행해 주세요.
    - 새 프로젝트를 만들었거나 기존 프로젝트에서 원격 초기화를 허용했다면 기본 Edge Function은 자동으로 배포해요.
    - 다른 Edge Function을 추가하려면 \`supabase functions new <name> --workdir .\`로 생성한 뒤 \`functions:deploy\`를 다시 실행하면 돼요.
    - frontend/backoffice의 \`.env.local\`은 server provisioning 결과와 같은 Supabase project를 가리키게 맞춰두는 걸 권장해요.
    
    ${(remoteOpsLines).join('\n')}
    
    ## Supabase access token
    
    - 브라우저 로그인 없이 CI나 비대화형 배포를 할 때만 필요해요.
    - Supabase Dashboard > Account > Access Tokens 에서 새 personal access token을 만들어 주세요.
    - Supabase access token은 별도 scope를 고르는 방식이 아니라, 토큰을 만든 계정 권한을 그대로 따라가요.
    - 프로젝트 생성이나 배포가 필요하면 해당 organization / project에 접근 가능한 계정으로 만들어 주세요.
    - 발급된 token은 \`server/.env.local\`의 \`SUPABASE_ACCESS_TOKEN=\` 뒤에 붙여 넣으면 돼요.
    - ${SUPABASE_ACCESS_TOKENS_DASHBOARD_URL}
    - ${SUPABASE_MANAGEMENT_API_DOC_URL}
    ${renderOptionalMarkdownSection(
      '발급 화면 예시',
      options?.accessTokenGuideImagePaths?.map(
        (imagePath, index) => `![Supabase access token 발급 화면 ${index + 1}](${imagePath})`,
      ) ?? [],
    )}
  `
}

function renderCloudflareServerReadme(options?: {
  packageManager: PackageManager
  scriptCatalog: ServerScriptCatalogEntry[]
  tokenGuideImagePath?: string | null
  trpc?: boolean
}) {
  const contract = getProviderClientContract('cloudflare')
  const trpcEnabled = options?.trpc === true
  const scriptLines = renderServerReadmeScriptLines(
    options?.scriptCatalog ?? [],
    options?.packageManager ?? 'pnpm',
  )
  const remoteOpsLines = renderServerRemoteOpsSection(
    renderServerRemoteOpsCommands(options?.scriptCatalog ?? [], options?.packageManager ?? 'pnpm'),
  )

  return dedentWithTrailingNewline`
    # server
    
    이 워크스페이스는 Cloudflare Worker를 배포하는 server 워크스페이스예요.
    
    ## 디렉토리 구조
    
    \`\`\`text
    server/
      src/index.ts
    ${trpcEnabled ? '  src/trpc/context.ts' : ''}
      wrangler.jsonc
      wrangler.vitest.jsonc
      vitest.config.mts
      worker-configuration.d.ts
      .env.local
      package.json
    \`\`\`
    
    ${renderServerScaffoldStateSection()}

    ${renderServerReadmeCliVersionsSection('cloudflare')}
    
    ## 주요 스크립트
    
    ${(scriptLines).join('\n')}
    
    ## Miniapp / Backoffice 연결
    
    - miniapp frontend \`.env.local\`은 \`${contract.frontend.envFile}\`에 두고 ${formatEnvKeys(contract.frontend.envKeys)}를 사용해요.
    - backoffice \`.env.local\`은 \`${contract.backoffice.envFile}\`에 두고 ${formatEnvKeys(contract.backoffice.envKeys)}를 사용해요.
    - provisioning이 성공하면 frontend/backoffice \`.env.local\`에 Worker URL이 자동으로 기록돼요.
    - Worker 코드는 \`${CLOUDFLARE_D1_BINDING_NAME}\` D1 binding과 \`${CLOUDFLARE_R2_BINDING_NAME}\` R2 binding을 사용할 수 있어요.
    ${
      trpcEnabled
        ? TRPC_SERVER_README_WORKSPACE_LINES.join('\n')
        : dedent`
            - miniapp frontend는 \`frontend/src/lib/api.ts\`에서 API helper를 만들고 \`MINIAPP_API_BASE_URL\`을 사용해요.
            - backoffice가 있으면 \`backoffice/src/lib/api.ts\`에서 \`VITE_API_BASE_URL\` 기반 helper를 사용해요.
          `
    }
    ${trpcEnabled ? renderOptionalMarkdownLines(['## API SSOT', '', ...TRPC_SERVER_README_API_SSOT_LINES]) : ''}
    
    ## 운영 메모
    
    - \`worker-configuration.d.ts\`는 \`wrangler types\`가 생성하는 파일이에요.
    - \`server/.env.local\`은 Cloudflare account/worker/D1/R2 메타데이터를 기록해요.
    - 기존 Worker에 연결하면 먼저 원격 초기화 여부를 물어봐요. 원격 초기화를 건너뛰면 Worker 재배포와 \`workers.dev\` 활성화는 자동으로 하지 않아요.
    - \`wrangler.jsonc\`는 원격 deploy 기준 설정이고, \`wrangler.vitest.jsonc\`는 local D1/R2 binding으로 테스트를 돌리기 위한 설정이에요.
    ${trpcEnabled ? TRPC_SERVER_README_OPERATION_NOTE : ''}
    
    ${(remoteOpsLines).join('\n')}
    
    ## Cloudflare API token
    
    - 브라우저 로그인 없이 다시 배포하거나 CI에서 쓸 때만 필요해요.
    - Cloudflare Dashboard > My Profile > API Tokens 에서 만들어 주세요.
    - 가장 빠른 방법은 \`Edit Cloudflare Workers\` 템플릿으로 시작하는 거예요.
    - 권한은 최소한 \`Account > Workers Scripts > Write\`, \`Account > D1 > Write\`, \`Account > Workers R2 Storage > Write\`를 포함해 주세요.
    - 발급된 secret은 \`server/.env.local\`의 \`CLOUDFLARE_API_TOKEN=\` 뒤에 붙여 넣으면 돼요.
    - ${CLOUDFLARE_API_TOKENS_DASHBOARD_URL}
    - ${CLOUDFLARE_CREATE_TOKEN_DOC_URL}
    - ${CLOUDFLARE_WORKERS_AUTH_DOC_URL}
    ${renderOptionalMarkdownSection(
      '발급 화면 예시',
      options?.tokenGuideImagePath
        ? [`![Cloudflare API token 발급 화면](${options.tokenGuideImagePath})`]
        : [],
    )}
  `
}

function renderFirebaseServerReadme(options?: {
  packageManager: PackageManager
  scriptCatalog: ServerScriptCatalogEntry[]
  loginCiGuideImagePath?: string | null
  serviceAccountGuideImagePaths?: string[] | null
}) {
  const contract = getProviderClientContract('firebase')
  const scriptLines = renderServerReadmeScriptLines(
    options?.scriptCatalog ?? [],
    options?.packageManager ?? 'pnpm',
  )
  const remoteOpsLines = renderServerRemoteOpsSection(
    renderServerRemoteOpsCommands(options?.scriptCatalog ?? [], options?.packageManager ?? 'pnpm'),
  )

  return dedentWithTrailingNewline`
    # server
    
    이 워크스페이스는 Firebase Functions, Firestore 리소스, Firebase 프로젝트 연결을 관리하는 server 워크스페이스예요.
    
    ## 디렉토리 구조
    
    \`\`\`text
    server/
      firebase.json
      firestore.rules
      firestore.indexes.json
      .firebaserc
      .env.local
      scripts/
        firebase-ensure-firestore.mjs
      functions/
        src/index.ts
        package.json
        tsconfig.json
      package.json
    \`\`\`
    
    ${renderServerScaffoldStateSection()}

    ${renderServerReadmeCliVersionsSection('firebase')}
    
    ## 주요 스크립트
    
    ${(scriptLines).join('\n')}
    
    ## Miniapp / Backoffice 연결
    
    - miniapp frontend는 \`frontend/src/lib/firebase.ts\`, \`frontend/src/lib/firestore.ts\`, \`frontend/src/lib/functions.ts\`, \`frontend/src/lib/public-app-status.ts\`, \`frontend/src/lib/storage.ts\`에서 Firebase Web SDK와 public status fallback 흐름을 초기화해요.
    - miniapp frontend \`.env.local\`은 \`${contract.frontend.envFile}\`에 두고 ${formatEnvKeys(contract.frontend.envKeys)}를 사용해요.
    - frontend \`scaffold.preset.ts\`는 \`process.cwd()\` 기준으로 \`.env.local\` 값을 읽어 같은 \`MINIAPP_FIREBASE_*\` 값을 주입하고, \`granite.config.ts\`는 그 scaffold preset만 연결해요.
    - \`frontend/src/lib/public-app-status.ts\`는 Firestore direct read를 먼저 시도하고, 권한 오류가 나면 \`getPublicStatus\` callable function으로 fallback 해요.
    - backoffice가 있으면 \`backoffice/src/lib/firebase.ts\`, \`backoffice/src/lib/firestore.ts\`, \`backoffice/src/lib/storage.ts\`가 같은 Firebase project를 사용해요.
    - backoffice \`.env.local\`은 \`${contract.backoffice.envFile}\`에 두고 ${formatEnvKeys(contract.backoffice.envKeys)}를 사용해요.
    
    ## 운영 메모
    
    - \`server/.env.local\`의 \`FIREBASE_PROJECT_ID\`, \`FIREBASE_FUNCTION_REGION\`은 배포 기준 메타데이터예요.
    - 기존 Firebase 프로젝트에 연결하면 먼저 원격 초기화 여부를 물어봐요. 원격 초기화를 건너뛰어도 Blaze와 build IAM 확인은 먼저 하고, Firestore 준비와 Functions/Firestore 배포만 자동으로 건너뛰어요.
    - \`server/.env.local\`의 \`FIREBASE_TOKEN\` 또는 \`GOOGLE_APPLICATION_CREDENTIALS\`를 채우면 비대화형 deploy에 사용할 수 있어요.
    - \`server/functions/package.json\`의 Node runtime은 Firebase 지원 범위에 맞춰 \`22\`를 사용해요.
    - \`server/functions/src/index.ts\`는 \`api\` HTTP 함수와 \`getPublicStatus\` callable function을 함께 배포해요.
    
    ${(remoteOpsLines).join('\n')}
    
    ## Firebase deploy auth
    
    - 브라우저 로그인 없이 CI나 비대화형 배포를 할 때만 필요해요.
    - \`FIREBASE_TOKEN\`은 \`firebase login:ci\`로 발급받아 \`server/.env.local\`의 \`FIREBASE_TOKEN=\` 뒤에 넣어 주세요.
    - \`GOOGLE_APPLICATION_CREDENTIALS\`는 Google Cloud Service Accounts 페이지에서 JSON 키를 발급받아 파일 경로를 넣어 주세요.
    - 서비스 계정을 따로 쓸 때는 보통 \`Cloud Functions Developer\`와 \`Service Account User\` 역할이 먼저 필요해요.
    - 프로젝트 설정에 따라 Cloud Build, Cloud Run, Artifact Registry 쪽 권한이 더 필요할 수 있고, 이 생성기는 가능한 자동 보정을 먼저 시도해요.
    - ${FIREBASE_CLI_DOC_URL}
    - ${GOOGLE_CLOUD_SERVICE_ACCOUNTS_CONSOLE_URL}
    - ${FIREBASE_ADMIN_SETUP_URL}
    ${renderOptionalMarkdownSection(
      '`FIREBASE_TOKEN` 발급 화면 예시',
      options?.loginCiGuideImagePath
        ? [`![Firebase login:ci 발급 화면](${options.loginCiGuideImagePath})`]
        : [],
    )}
    ${renderOptionalMarkdownSection(
      '`GOOGLE_APPLICATION_CREDENTIALS` 발급 화면 예시',
      options?.serviceAccountGuideImagePaths?.map(
        (imagePath, index) => `![Firebase service account 발급 화면 ${index + 1}](${imagePath})`,
      ) ?? [],
    )}
  `
}

function normalizePackageVersionSpec(versionSpec: string | undefined) {
  if (!versionSpec) {
    return null
  }

  return minVersion(versionSpec)?.version ?? null
}

export function resolveWranglerSchemaUrl(packageJson: PackageJson) {
  const version =
    normalizePackageVersionSpec(packageJson.devDependencies?.[WRANGLER_PACKAGE_NAME]) ?? 'latest'
  return `https://unpkg.com/${WRANGLER_PACKAGE_NAME}@${version}/config-schema.json`
}

async function patchWranglerConfigSchema(serverRoot: string, packageJson: PackageJson) {
  const wranglerConfigPath = path.join(serverRoot, 'wrangler.jsonc')

  if (!(await pathExists(wranglerConfigPath))) {
    return
  }

  const source = await readFile(wranglerConfigPath, 'utf8')
  const next = patchWranglerConfigSource(source, {
    schemaUrl: resolveWranglerSchemaUrl(packageJson),
  })

  await writeFile(wranglerConfigPath, next, 'utf8')
}

async function ensureRootGitignoreEntry(targetRoot: string, entry: string) {
  const gitignorePath = path.join(targetRoot, '.gitignore')

  if (!(await pathExists(gitignorePath))) {
    return
  }

  const source = await readFile(gitignorePath, 'utf8')
  const lines = source.split(/\r?\n/)

  if (lines.includes(entry)) {
    return
  }

  const nextLines = [...lines]

  while (nextLines.length > 0 && nextLines.at(-1) === '') {
    nextLines.pop()
  }

  nextLines.push(entry, '')
  await writeFile(gitignorePath, nextLines.join('\n'), 'utf8')
}

function toBiomeForceIgnorePattern(entry: string) {
  if (entry.startsWith('!')) {
    return entry
  }

  if (entry.endsWith('/**')) {
    return `!!${entry.slice(0, -3)}`
  }

  return `!!${entry}`
}

async function ensureRootBiomeIgnoreEntry(targetRoot: string, entry: string) {
  const biomePath = path.join(targetRoot, 'biome.json')

  if (!(await pathExists(biomePath))) {
    return
  }

  const biomeJson = JSON.parse(await readFile(biomePath, 'utf8')) as {
    files?: {
      ignore?: string[]
      includes?: string[]
    }
  }

  const includes = biomeJson.files?.includes

  if (includes) {
    const forceIgnoreEntry = toBiomeForceIgnorePattern(entry)

    if (includes.includes(forceIgnoreEntry) || includes.includes(entry)) {
      return
    }

    biomeJson.files = {
      ...(biomeJson.files ?? {}),
      includes: [...includes, forceIgnoreEntry],
    }
  } else {
    const ignore = biomeJson.files?.ignore ?? []

    if (ignore.includes(entry)) {
      return
    }

    biomeJson.files = {
      ...(biomeJson.files ?? {}),
      ignore: [...ignore, entry],
    }
  }

  await writeFile(biomePath, `${JSON.stringify(biomeJson, null, 2)}\n`, 'utf8')
}

async function ensureRootYarnPackageExtension(targetRoot: string) {
  const yarnrcPath = path.join(targetRoot, '.yarnrc.yml')

  if (!(await pathExists(yarnrcPath))) {
    return
  }

  const source = await readFile(yarnrcPath, 'utf8')

  if (source.includes(FIREBASE_YARN_PACKAGE_EXTENSION_KEY)) {
    return
  }

  const normalizedSource = source.endsWith('\n') ? source : `${source}\n`
  const nextSource = normalizedSource.includes('packageExtensions:')
    ? `${normalizedSource}${FIREBASE_YARN_PACKAGE_EXTENSION_BLOCK}\n`
    : `${normalizedSource}\npackageExtensions:\n${FIREBASE_YARN_PACKAGE_EXTENSION_BLOCK}\n`

  await writeFile(yarnrcPath, nextSource, 'utf8')
}

async function writeCloudflareVitestConfigFiles(serverRoot: string) {
  const wranglerConfigPath = path.join(serverRoot, 'wrangler.jsonc')

  if (!(await pathExists(wranglerConfigPath))) {
    return
  }

  const wranglerSource = await readFile(wranglerConfigPath, 'utf8')
  await writeTextFile(
    path.join(serverRoot, 'wrangler.vitest.jsonc'),
    createCloudflareVitestWranglerConfigSource(wranglerSource),
  )
  await writeTextFile(
    path.join(serverRoot, 'vitest.config.mts'),
    renderCloudflareVitestConfigSource(),
  )
}

async function writeCloudflareTrpcServerBootstrap(serverRoot: string) {
  await writeTextFile(
    path.join(serverRoot, 'src', 'trpc', 'context.ts'),
    renderCloudflareServerTrpcContextSource(),
  )
  await writeTextFile(path.join(serverRoot, 'src', 'index.ts'), renderCloudflareServerIndexSource())
}

export async function patchSupabaseServerWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: Pick<WorkspacePatchOptions, 'packageManager'> & {
    accessTokenGuideImageSourcePaths?: string[] | null
    state: ServerScaffoldState
  },
) {
  const serverRoot = path.join(targetRoot, 'server')
  const accessTokenGuideImagePaths = await copyGuideAssets(
    serverRoot,
    options.accessTokenGuideImageSourcePaths ?? [],
    SUPABASE_ACCESS_TOKEN_GUIDE_ASSET_CANDIDATES,
  )
  const supabaseScriptCatalog = createSupabaseServerScriptCatalog(tokens.packageManager)
  const remoteOpsCommands = renderServerRemoteOpsCommands(
    supabaseScriptCatalog,
    tokens.packageManager,
  )
  await applyServerPackageTemplate(targetRoot, tokens)
  await writeServerScaffoldSupportFiles(serverRoot, options.state, remoteOpsCommands)
  await writeTextFile(
    path.join(serverRoot, 'README.md'),
    renderSupabaseServerReadme({
      packageManager: tokens.packageManager,
      scriptCatalog: supabaseScriptCatalog,
      accessTokenGuideImagePaths,
    }),
  )
  await removeToolingFiles(serverRoot, options.packageManager)
  await removeWorkspaceArtifacts(serverRoot, options.packageManager)
  await applyWorkspaceProjectTemplate(targetRoot, 'server', tokens)
}

export async function patchCloudflareServerWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: Pick<WorkspacePatchOptions, 'packageManager'> & {
    tokenGuideImageSourcePath?: string | null
    trpc?: boolean
    state: ServerScaffoldState
  },
) {
  const serverRoot = path.join(targetRoot, 'server')
  const packageJsonPath = path.join(serverRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)
  const tokenGuideImagePath = await copyCloudflareTokenGuideAsset(
    serverRoot,
    options.tokenGuideImageSourcePath,
  )
  const cloudflareScripts = createCloudflareServerScriptCatalog({
    devCommand: options.trpc
      ? prefixTrpcWorkspaceBuild(packageJson.scripts?.dev ?? 'wrangler dev', options.packageManager)
      : (packageJson.scripts?.dev ?? 'wrangler dev'),
    buildCommand: options.trpc
      ? prefixTrpcWorkspaceBuild('wrangler deploy --dry-run', options.packageManager)
      : 'wrangler deploy --dry-run',
    typecheckCommand: options.trpc
      ? prefixTrpcWorkspaceBuild('wrangler types && tsc --noEmit', options.packageManager)
      : 'wrangler types && tsc --noEmit',
    deployCommand: options.trpc
      ? prefixTrpcWorkspaceBuild('node ./scripts/cloudflare-deploy.mjs', options.packageManager)
      : 'node ./scripts/cloudflare-deploy.mjs',
    testCommand: packageJson.scripts?.test
      ? normalizeVitestTestScript(packageJson.scripts.test)
      : null,
  })
  const remoteOpsCommands = renderServerRemoteOpsCommands(cloudflareScripts, tokens.packageManager)

  await writeServerScaffoldSupportFiles(serverRoot, options.state, remoteOpsCommands)
  await patchPackageJsonFile(packageJsonPath, {
    upsertTopLevel: [
      {
        key: 'name',
        value: 'server',
      },
    ],
    upsertSections: {
      scripts: createServerScriptRecord(cloudflareScripts),
      ...(options.trpc
        ? {
            dependencies: {
              '@trpc/server': TRPC_SERVER_VERSION,
              '@workspace/app-router': APP_ROUTER_WORKSPACE_DEPENDENCY,
              '@workspace/contracts': CONTRACTS_WORKSPACE_DEPENDENCY,
            },
          }
        : {}),
    },
    removeFromSections: {
      scripts: ['deploy:remote', ...(options.trpc ? ['trpc:sync'] : [])],
      dependencies: toolingDependencyNames(),
      devDependencies: toolingDependencyNames(),
    },
  })
  await patchWranglerConfigSchema(serverRoot, packageJson)
  await writeCloudflareVitestConfigFiles(serverRoot)
  await writeTextFile(
    path.join(serverRoot, 'README.md'),
    renderCloudflareServerReadme({
      packageManager: tokens.packageManager,
      scriptCatalog: cloudflareScripts,
      tokenGuideImagePath,
      trpc: options.trpc,
    }),
  )
  await writeTextFile(
    path.join(serverRoot, 'scripts', 'cloudflare-deploy.mjs'),
    renderCloudflareDeployScript(tokens),
  )
  if (options.trpc) {
    await writeCloudflareTrpcServerBootstrap(serverRoot)
    await removePathIfExists(path.join(serverRoot, 'scripts', 'trpc-sync.mjs'))
  }
  if (options.packageManager === 'npm') {
    await writeWorkspaceNpmrc(serverRoot)
  }
  await ensureRootGitignoreEntry(targetRoot, CLOUDFLARE_ROOT_GITIGNORE_ENTRY)
  await ensureRootBiomeIgnoreEntry(targetRoot, CLOUDFLARE_ROOT_BIOME_IGNORE_ENTRY)

  await Promise.all(
    CLOUDFLARE_SERVER_LOCAL_FILES.map((fileName) =>
      removePathIfExists(path.join(serverRoot, fileName)),
    ),
  )
  await removeToolingFiles(serverRoot, options.packageManager)
  await removeWorkspaceArtifacts(serverRoot, options.packageManager)
  await applyWorkspaceProjectTemplate(targetRoot, 'server', tokens)
}

export async function patchFirebaseServerWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: Pick<WorkspacePatchOptions, 'packageManager'> & {
    loginCiGuideImageSourcePath?: string | null
    serviceAccountGuideImageSourcePaths?: string[] | null
    state: ServerScaffoldState
  },
) {
  const serverRoot = path.join(targetRoot, 'server')
  const loginCiGuideImagePath =
    (
      await copyGuideAssets(
        serverRoot,
        [options.loginCiGuideImageSourcePath],
        FIREBASE_LOGIN_CI_GUIDE_ASSET_CANDIDATES,
      )
    )[0] ?? null
  const serviceAccountGuideImagePaths = await copyGuideAssets(
    serverRoot,
    options.serviceAccountGuideImageSourcePaths ?? [],
    FIREBASE_SERVICE_ACCOUNT_GUIDE_ASSET_CANDIDATES,
  )
  const firebaseScriptCatalog = createFirebaseServerScriptCatalog({
    packageManager: tokens.packageManager,
    firestoreRegion: FIREBASE_DEFAULT_FUNCTION_REGION,
  })
  const remoteOpsCommands = renderServerRemoteOpsCommands(
    firebaseScriptCatalog,
    tokens.packageManager,
  )

  await writeServerScaffoldSupportFiles(serverRoot, options.state, remoteOpsCommands)
  await writeTextFile(
    path.join(serverRoot, 'README.md'),
    renderFirebaseServerReadme({
      packageManager: tokens.packageManager,
      scriptCatalog: firebaseScriptCatalog,
      loginCiGuideImagePath,
      serviceAccountGuideImagePaths,
    }),
  )
  await ensureRootGitignoreEntry(targetRoot, FIREBASE_ROOT_GITIGNORE_ENTRY)
  await ensureRootBiomeIgnoreEntry(targetRoot, FIREBASE_ROOT_BIOME_IGNORE_ENTRY)
  if (options.packageManager === 'yarn') {
    await ensureRootYarnPackageExtension(targetRoot)
  }
  await removeToolingFiles(serverRoot, options.packageManager)
  await removeWorkspaceArtifacts(serverRoot, options.packageManager)
  await removePathIfExists(path.join(serverRoot, '.eslintrc.js'))
  await applyWorkspaceProjectTemplate(targetRoot, 'server', tokens)
}

export function createRootPackageName(appName: string) {
  return `${appName}-workspace`
}
