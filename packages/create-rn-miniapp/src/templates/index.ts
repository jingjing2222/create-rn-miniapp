import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { patchRootPackageJsonSource } from '../patching/package-json.js'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import {
  applyTrpcWorkspaceTemplate as applyTrpcWorkspaceTemplateImpl,
  TRPC_WORKSPACE_PATH,
} from './trpc.js'

const ROOT_WORKSPACE_ORDER = ['frontend', 'server', TRPC_WORKSPACE_PATH, 'backoffice'] as const

export type WorkspaceName = (typeof ROOT_WORKSPACE_ORDER)[number]

export type TemplateTokens = {
  appName: string
  displayName: string
  packageManager: PackageManager
  packageManagerCommand: string
  packageManagerRunCommand: string
  packageManagerExecCommand: string
  verifyCommand: string
}

type OptionalDocsServerProvider = 'supabase' | 'cloudflare' | 'firebase'

export type OptionalDocsOptions = {
  hasBackoffice: boolean
  serverProvider: OptionalDocsServerProvider | null
  hasTrpc: boolean
}

type WorkspaceProjectJson = {
  targets?: Record<string, { command?: string }>
}

type ServerPackageJson = {
  scripts?: Record<string, string>
}

type FirebaseFunctionsPackageJson = {
  name: string
  private: boolean
  main: string
  packageManager?: string
  engines: {
    node: string
  }
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

export const SUPABASE_DEFAULT_FUNCTION_NAME = 'api'
export const FIREBASE_DEFAULT_FUNCTION_NAME = 'api'
export const FIREBASE_DEFAULT_FUNCTION_REGION = 'asia-northeast3'
const FIREBASE_NODE_ENGINE = '24'
const FIREBASE_WEB_SDK_VERSION = '^12.10.0'
const FIREBASE_ADMIN_VERSION = '^13.6.0'
const FIREBASE_FUNCTIONS_VERSION = '^7.0.0'
const GOOGLE_CLOUD_FUNCTIONS_FRAMEWORK_VERSION = '^3.4.5'
const FIREBASE_FUNCTIONS_TYPESCRIPT_VERSION = '^5.7.3'
const OPTIONAL_GOLDEN_RULES_START_MARKER = '<!-- optional-golden-rules:start -->'
const OPTIONAL_GOLDEN_RULES_END_MARKER = '<!-- optional-golden-rules:end -->'
const OPTIONAL_AGENTS_START_MARKER = '<!-- optional-doc-links:start -->'
const OPTIONAL_AGENTS_END_MARKER = '<!-- optional-doc-links:end -->'
const OPTIONAL_DOCS_INDEX_START_MARKER = '<!-- optional-engineering-links:start -->'
const OPTIONAL_DOCS_INDEX_END_MARKER = '<!-- optional-engineering-links:end -->'
const NPMRC_SOURCE = 'legacy-peer-deps=true\n'

const require = createRequire(import.meta.url)
const NORMALIZED_PACKAGE_WORKSPACE = 'packages/*' as const
const NORMALIZED_ROOT_WORKSPACE_ORDER = [
  'frontend',
  'server',
  NORMALIZED_PACKAGE_WORKSPACE,
  'backoffice',
] as const
type NormalizedRootWorkspaceName = (typeof NORMALIZED_ROOT_WORKSPACE_ORDER)[number]

function resolveTemplatesPackageRoot() {
  const packageJsonPath = require.resolve('@create-rn-miniapp/scaffold-templates/package.json')
  return path.dirname(packageJsonPath)
}

function replaceTemplateTokens(source: string, tokens: TemplateTokens) {
  return source
    .replaceAll('{{appName}}', tokens.appName)
    .replaceAll('{{displayName}}', tokens.displayName)
    .replaceAll('{{packageManager}}', tokens.packageManager)
    .replaceAll('{{packageManagerCommand}}', tokens.packageManagerCommand)
    .replaceAll('{{packageManagerRunCommand}}', tokens.packageManagerRunCommand)
    .replaceAll('{{packageManagerExecCommand}}', tokens.packageManagerExecCommand)
    .replaceAll('{{verifyCommand}}', tokens.verifyCommand)
}

async function copyFileWithTokens(sourcePath: string, targetPath: string, tokens: TemplateTokens) {
  const contents = await readFile(sourcePath, 'utf8')
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, replaceTemplateTokens(contents, tokens), 'utf8')
}

async function copyDirectoryWithTokens(
  sourceDir: string,
  targetDir: string,
  tokens: TemplateTokens,
) {
  const entries = await readdir(sourceDir, { withFileTypes: true })

  await mkdir(targetDir, { recursive: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryWithTokens(sourcePath, targetPath, tokens)
      continue
    }

    await copyFileWithTokens(sourcePath, targetPath, tokens)
  }
}

async function copyOptionalTemplateFile(
  sourcePath: string,
  targetPath: string,
  tokens: TemplateTokens,
) {
  await copyFileWithTokens(sourcePath, targetPath, tokens)
}

async function copyOptionalTemplateDirectory(
  sourceDir: string,
  targetRoot: string,
  tokens: TemplateTokens,
) {
  await copyDirectoryWithTokens(sourceDir, targetRoot, tokens)
}

async function readJsonTemplate<T>(sourcePath: string, tokens: TemplateTokens) {
  const contents = replaceTemplateTokens(await readFile(sourcePath, 'utf8'), tokens)
  return JSON.parse(contents) as T
}

async function writeJsonFile(targetPath: string, value: unknown) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeWorkspaceNpmrc(targetRoot: string) {
  await mkdir(targetRoot, { recursive: true })
  await writeFile(path.join(targetRoot, '.npmrc'), NPMRC_SOURCE, 'utf8')
}

function renderSupabaseDbApplyScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx('supabase', [
    'db',
    'push',
    '--workdir',
    '.',
    '--linked',
    '--password',
    '__SUPABASE_DB_PASSWORD__',
    '--yes',
  ])
  const passwordPlaceholderIndex = command.args.indexOf('__SUPABASE_DB_PASSWORD__')

  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const envPath = path.join(serverRoot, '.env.local')",
    '',
    'function stripWrappingQuotes(value) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath) {',
    '  if (!existsSync(filePath)) {',
    '    return',
    '  }',
    '',
    "  const source = readFileSync(filePath, 'utf8')",
    '',
    '  for (const line of source.split(/\\r?\\n/)) {',
    '    const trimmed = line.trim()',
    '',
    "    if (!trimmed || trimmed.startsWith('#')) {",
    '      continue',
    '    }',
    '',
    "    const separatorIndex = trimmed.indexOf('=')",
    '    if (separatorIndex <= 0) {',
    '      continue',
    '    }',
    '',
    '    const key = trimmed.slice(0, separatorIndex).trim()',
    '    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())',
    '',
    '    if (process.env[key] === undefined) {',
    '      process.env[key] = value',
    '    }',
    '  }',
    '}',
    '',
    'loadLocalEnv(envPath)',
    '',
    "const password = process.env.SUPABASE_DB_PASSWORD?.trim() ?? ''",
    'if (!password) {',
    "  console.error('[server] SUPABASE_DB_PASSWORD is required. Set server/.env.local before running db:apply.')",
    '  process.exit(1)',
    '}',
    '',
    `const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'`,
    `const baseArgs = ${JSON.stringify(command.args)};`,
    'const result = spawnSync(',
    '  packageManagerCommand,',
    '  [',
    `    ...baseArgs.slice(0, ${passwordPlaceholderIndex}),`,
    '    password,',
    `    ...baseArgs.slice(${passwordPlaceholderIndex + 1}),`,
    '  ],',
    '  {',
    '    cwd: serverRoot,',
    "    stdio: 'inherit',",
    '    env: process.env,',
    '  },',
    ')',
    '',
    "if (typeof result.status === 'number') {",
    '  process.exit(result.status)',
    '}',
    '',
    'if (result.error) {',
    '  throw result.error',
    '}',
    '',
    'process.exit(1)',
    '',
  ].join('\n')
}

function renderSupabaseFunctionsDeployScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx('supabase', [
    'functions',
    'deploy',
    '__REQUESTED_FUNCTIONS__',
    '--project-ref',
    '__SUPABASE_PROJECT_REF__',
    '--workdir',
    '.',
    '--yes',
  ])
  const requestedFunctionsPlaceholderIndex = command.args.indexOf('__REQUESTED_FUNCTIONS__')
  const projectRefPlaceholderIndex = command.args.indexOf('__SUPABASE_PROJECT_REF__')

  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const envPath = path.join(serverRoot, '.env.local')",
    '',
    'function stripWrappingQuotes(value) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath) {',
    '  if (!existsSync(filePath)) {',
    '    return',
    '  }',
    '',
    "  const source = readFileSync(filePath, 'utf8')",
    '',
    '  for (const line of source.split(/\\r?\\n/)) {',
    '    const trimmed = line.trim()',
    '',
    "    if (!trimmed || trimmed.startsWith('#')) {",
    '      continue',
    '    }',
    '',
    "    const separatorIndex = trimmed.indexOf('=')",
    '    if (separatorIndex <= 0) {',
    '      continue',
    '    }',
    '',
    '    const key = trimmed.slice(0, separatorIndex).trim()',
    '    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())',
    '',
    '    if (process.env[key] === undefined) {',
    '      process.env[key] = value',
    '    }',
    '  }',
    '}',
    '',
    'loadLocalEnv(envPath)',
    '',
    "const projectRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? ''",
    'if (!projectRef) {',
    "  console.error('[server] SUPABASE_PROJECT_REF is required. Set server/.env.local before running functions:deploy.')",
    '  process.exit(1)',
    '}',
    '',
    `const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'`,
    `const baseArgs = ${JSON.stringify(command.args)};`,
    'const requestedFunctions = process.argv.slice(2).map((value) => value.trim()).filter(Boolean)',
    'const result = spawnSync(',
    '  packageManagerCommand,',
    '  [',
    `    ...baseArgs.slice(0, ${requestedFunctionsPlaceholderIndex}),`,
    '    ...requestedFunctions,',
    `    ...baseArgs.slice(${requestedFunctionsPlaceholderIndex + 1}, ${projectRefPlaceholderIndex}),`,
    '    projectRef,',
    `    ...baseArgs.slice(${projectRefPlaceholderIndex + 1}),`,
    '  ],',
    '  {',
    '    cwd: serverRoot,',
    "    stdio: 'inherit',",
    '    env: process.env,',
    '  },',
    ')',
    '',
    "if (typeof result.status === 'number') {",
    '  process.exit(result.status)',
    '}',
    '',
    'if (result.error) {',
    '  throw result.error',
    '}',
    '',
    'process.exit(1)',
    '',
  ].join('\n')
}

function renderFirebaseFunctionsDeployScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx('firebase-tools', [
    'deploy',
    '--only',
    'functions',
    '--config',
    'firebase.json',
    '--project',
    '__FIREBASE_PROJECT_ID__',
  ])
  const projectPlaceholderIndex = command.args.indexOf('__FIREBASE_PROJECT_ID__')

  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const envPath = path.join(serverRoot, '.env.local')",
    '',
    'function stripWrappingQuotes(value) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath) {',
    '  if (!existsSync(filePath)) {',
    '    return',
    '  }',
    '',
    "  const source = readFileSync(filePath, 'utf8')",
    '',
    '  for (const line of source.split(/\\r?\\n/)) {',
    '    const trimmed = line.trim()',
    '',
    "    if (!trimmed || trimmed.startsWith('#')) {",
    '      continue',
    '    }',
    '',
    "    const separatorIndex = trimmed.indexOf('=')",
    '    if (separatorIndex <= 0) {',
    '      continue',
    '    }',
    '',
    '    const key = trimmed.slice(0, separatorIndex).trim()',
    '    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())',
    '',
    '    if (process.env[key] === undefined) {',
    '      process.env[key] = value',
    '    }',
    '  }',
    '}',
    '',
    'loadLocalEnv(envPath)',
    '',
    "const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? ''",
    'if (!projectId) {',
    "  console.error('[server] FIREBASE_PROJECT_ID is required. Set server/.env.local before running deploy.')",
    '  process.exit(1)',
    '}',
    '',
    "const firebaseToken = process.env.FIREBASE_TOKEN?.trim() ?? ''",
    "const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? ''",
    'const commandEnv = { ...process.env }',
    '',
    'if (credentials) {',
    '  const resolvedCredentials = path.isAbsolute(credentials)',
    '    ? credentials',
    '    : path.resolve(serverRoot, credentials)',
    '',
    '  if (!existsSync(resolvedCredentials)) {',
    '    console.error(`[server] GOOGLE_APPLICATION_CREDENTIALS file not found: ${resolvedCredentials}`)',
    '    process.exit(1)',
    '  }',
    '',
    '  commandEnv.GOOGLE_APPLICATION_CREDENTIALS = resolvedCredentials',
    '} else {',
    '  delete commandEnv.GOOGLE_APPLICATION_CREDENTIALS',
    '}',
    '',
    `const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'`,
    `const baseArgs = ${JSON.stringify(command.args)};`,
    'const finalArgs = [',
    `  ...baseArgs.slice(0, ${projectPlaceholderIndex}),`,
    '  projectId,',
    `  ...baseArgs.slice(${projectPlaceholderIndex + 1}),`,
    ']',
    '',
    'if (firebaseToken) {',
    "  finalArgs.push('--token', firebaseToken, '--non-interactive')",
    '}',
    '',
    'const result = spawnSync(packageManagerCommand, finalArgs, {',
    '  cwd: serverRoot,',
    "  stdio: 'inherit',",
    '  env: commandEnv,',
    '})',
    '',
    "if (typeof result.status === 'number') {",
    '  process.exit(result.status)',
    '}',
    '',
    'if (result.error) {',
    '  throw result.error',
    '}',
    '',
    'process.exit(1)',
    '',
  ].join('\n')
}

function renderFirebaseFirebaserc(projectId?: string | null) {
  return `${JSON.stringify(
    {
      projects: {
        default: projectId ?? '',
      },
    },
    null,
    2,
  )}\n`
}

function renderFirebaseJson(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const installCommand = renderFirebaseFunctionsInstallCommand(
    tokens.packageManager,
    '"$RESOURCE_DIR"',
  )
  const predeployCommand = `${installCommand} && ${packageManager.runScriptInDirectoryCommand('"$RESOURCE_DIR"', 'build')}`

  return `${JSON.stringify(
    {
      functions: [
        {
          source: 'functions',
          codebase: 'default',
          ignore: ['node_modules', '.git', 'firebase-debug.log', 'firebase-debug.*.log', '*.local'],
          predeploy: [predeployCommand],
        },
      ],
    },
    null,
    2,
  )}\n`
}

function renderFirebaseServerGitignore() {
  return [
    '# Firebase cache',
    '.firebase/',
    'firebase-debug.log*',
    '',
    '# Local env',
    '.env.local',
    '',
    '# Functions output',
    'functions/lib/',
    'functions/node_modules/',
    '',
  ].join('\n')
}

function renderFirebaseFunctionsGitignore(packageManager: PackageManager) {
  const lines = ['lib/', 'node_modules/']

  if (packageManager === 'yarn') {
    lines.push('.yarn/', '.pnp.*')
  }

  lines.push('')

  return lines.join('\n')
}

function renderFirebaseFunctionsYarnrc() {
  return ['nodeLinker: node-modules', ''].join('\n')
}

function renderFirebaseFunctionsPackageJson(
  packageManager: PackageManager,
): FirebaseFunctionsPackageJson {
  return {
    name: 'functions',
    private: true,
    main: 'lib/index.js',
    ...(packageManager === 'yarn'
      ? { packageManager: getPackageManagerAdapter('yarn').packageManagerField }
      : {}),
    engines: {
      node: FIREBASE_NODE_ENGINE,
    },
    scripts: {
      build: 'tsc -p tsconfig.json',
      typecheck: 'tsc --noEmit -p tsconfig.json',
      test: `node -e "console.log('firebase functions test placeholder')"`,
    },
    dependencies: {
      '@google-cloud/functions-framework': GOOGLE_CLOUD_FUNCTIONS_FRAMEWORK_VERSION,
      'firebase-admin': FIREBASE_ADMIN_VERSION,
      'firebase-functions': FIREBASE_FUNCTIONS_VERSION,
    },
    devDependencies: {
      '@types/node': '^24.10.1',
      typescript: FIREBASE_FUNCTIONS_TYPESCRIPT_VERSION,
    },
  }
}

function renderFirebaseFunctionsTsconfig() {
  return `${JSON.stringify(
    {
      compilerOptions: {
        module: 'NodeNext',
        esModuleInterop: true,
        moduleResolution: 'nodenext',
        noImplicitReturns: true,
        noUnusedLocals: true,
        skipLibCheck: true,
        outDir: 'lib',
        sourceMap: true,
        strict: true,
        target: 'es2017',
      },
      compileOnSave: true,
      include: ['src'],
    },
    null,
    2,
  )}\n`
}

function renderFirebaseFunctionsIndex(region = FIREBASE_DEFAULT_FUNCTION_REGION) {
  return [
    "import { setGlobalOptions } from 'firebase-functions'",
    "import { onRequest } from 'firebase-functions/https'",
    '',
    'setGlobalOptions({',
    `  region: '${region}',`,
    '  maxInstances: 10,',
    '})',
    '',
    `export const ${FIREBASE_DEFAULT_FUNCTION_NAME} = onRequest((request, response) => {`,
    '  response.json({',
    '    ok: true,',
    "    provider: 'firebase',",
    '    path: request.path,',
    '  })',
    '})',
    '',
  ].join('\n')
}

function renderFirebaseFunctionsInstallCommand(packageManager: PackageManager, directory: string) {
  const adapter = getPackageManagerAdapter(packageManager)

  if (packageManager === 'pnpm') {
    return `${adapter.installInDirectoryCommand(directory)} --ignore-workspace`
  }

  return adapter.installInDirectoryCommand(directory)
}

function renderFirebaseServerPackageJson(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const functionsDirectory = './functions'
  const installFunctionsCommand = renderFirebaseFunctionsInstallCommand(
    tokens.packageManager,
    functionsDirectory,
  )

  return {
    name: 'server',
    private: true,
    scripts: {
      dev: `${installFunctionsCommand} && ${packageManager.dlxCommand('firebase-tools', ['emulators:start', '--only', 'functions', '--config', 'firebase.json'])}`,
      build: `${installFunctionsCommand} && ${packageManager.runScriptInDirectoryCommand(functionsDirectory, 'build')}`,
      typecheck: `${installFunctionsCommand} && ${packageManager.runScriptInDirectoryCommand(functionsDirectory, 'typecheck')}`,
      test: `node -e "console.log('firebase server test placeholder')"`,
      deploy: `${installFunctionsCommand} && node ./scripts/firebase-functions-deploy.mjs`,
      logs: packageManager.dlxCommand('firebase-tools', ['functions:log']),
    },
  }
}

function normalizeRootWorkspaces(workspaces: WorkspaceName[]): NormalizedRootWorkspaceName[] {
  const included = new Set<string>()

  for (const workspace of workspaces) {
    if (workspace.startsWith('packages/')) {
      included.add(NORMALIZED_PACKAGE_WORKSPACE)
      continue
    }

    included.add(workspace)
  }

  return NORMALIZED_ROOT_WORKSPACE_ORDER.filter((workspace) => included.has(workspace))
}

function renderPnpmWorkspaceManifest(workspaces: NormalizedRootWorkspaceName[]) {
  const lines = ['packages:', ...workspaces.map((workspace) => `  - ${workspace}`)]
  return `${lines.join('\n')}\n`
}

function renderOptionalAgentsSection(options: OptionalDocsOptions) {
  const lines: string[] = []

  if (options.hasBackoffice) {
    lines.push(
      '- `docs/engineering/backoffice-react-best-practices.md`',
      '  - backoffice React/Vite 작업에서 상태, 렌더링, 번들 규칙을 빠르게 확인할 때 보는 문서',
    )
  }

  if (options.serverProvider === 'supabase') {
    lines.push(
      '- `docs/engineering/server-provider-supabase.md`',
      '  - server가 Supabase workspace일 때 DB, Edge Functions, 클라이언트 연결 흐름을 먼저 보는 문서',
    )
  }

  if (options.serverProvider === 'cloudflare') {
    lines.push(
      '- `docs/engineering/server-provider-cloudflare.md`',
      '  - server가 Cloudflare Worker workspace일 때 deploy, API URL, 운영 흐름을 먼저 보는 문서',
    )
  }

  if (options.serverProvider === 'firebase') {
    lines.push(
      '- `docs/engineering/server-provider-firebase.md`',
      '  - server가 Firebase Functions workspace일 때 billing, IAM, deploy 흐름을 먼저 보는 문서',
    )
  }

  if (options.hasTrpc) {
    lines.push(
      '- `docs/engineering/server-api-ssot-trpc.md`',
      '  - tRPC를 같이 쓸 때 server API의 source of truth가 어디인지 먼저 확인하는 문서',
    )
  }

  return lines.join('\n')
}

function renderOptionalGoldenRulesSection(options: OptionalDocsOptions) {
  if (!options.hasTrpc) {
    return ''
  }

  return [
    '8. Boundary types from schema only: client-server 경계 타입은 Zod schema에서 `z.infer`로만 파생하고, 같은 DTO를 별도 type alias로 중복 정의하지 않는다.',
  ].join('\n')
}

function renderOptionalDocsIndexSection(options: OptionalDocsOptions) {
  const lines: string[] = []

  if (options.hasBackoffice) {
    lines.push(
      '- Backoffice React best practices: `engineering/backoffice-react-best-practices.md`',
    )
  }

  if (options.serverProvider === 'supabase') {
    lines.push('- Server provider guide (Supabase): `engineering/server-provider-supabase.md`')
  }

  if (options.serverProvider === 'cloudflare') {
    lines.push('- Server provider guide (Cloudflare): `engineering/server-provider-cloudflare.md`')
  }

  if (options.serverProvider === 'firebase') {
    lines.push('- Server provider guide (Firebase): `engineering/server-provider-firebase.md`')
  }

  if (options.hasTrpc) {
    lines.push('- Server API SSOT (tRPC): `engineering/server-api-ssot-trpc.md`')
  }

  return lines.join('\n')
}

function replaceMarkedSection(
  source: string,
  options: {
    startMarker: string
    endMarker: string
    renderedSection: string
    fallbackAnchor: string
  },
) {
  const replacement = options.renderedSection
    ? `${options.startMarker}\n${options.renderedSection}\n${options.endMarker}`
    : `${options.startMarker}\n${options.endMarker}`

  if (source.includes(options.startMarker) && source.includes(options.endMarker)) {
    const pattern = new RegExp(`${options.startMarker}[\\s\\S]*?${options.endMarker}`, 'm')
    return source.replace(pattern, replacement)
  }

  if (source.includes(options.fallbackAnchor)) {
    return source.replace(options.fallbackAnchor, `${replacement}\n${options.fallbackAnchor}`)
  }

  return `${source.trimEnd()}\n\n${replacement}\n`
}

type OptionalDocTemplate = {
  templateDir: string
}

function resolveOptionalDocTemplates(options: OptionalDocsOptions): OptionalDocTemplate[] {
  const templates: OptionalDocTemplate[] = []

  if (options.hasBackoffice) {
    templates.push({
      templateDir: 'backoffice',
    })
  }

  if (options.serverProvider) {
    templates.push({
      templateDir: `server-${options.serverProvider}`,
    })
  }

  if (options.hasTrpc) {
    templates.push({
      templateDir: 'trpc',
    })
  }

  return templates
}

export async function syncRootWorkspaceManifest(
  targetRoot: string,
  packageManager: PackageManager,
  workspaces: WorkspaceName[],
) {
  const adapter = getPackageManagerAdapter(packageManager)
  const normalizedWorkspaces = normalizeRootWorkspaces(workspaces)

  if (adapter.workspaceManifestFile) {
    await writeFile(
      path.join(targetRoot, adapter.workspaceManifestFile),
      renderPnpmWorkspaceManifest(normalizedWorkspaces),
      'utf8',
    )
    return
  }

  const rootPackageJsonPath = path.join(targetRoot, 'package.json')
  const rootPackageJsonSource = await readFile(rootPackageJsonPath, 'utf8')
  const nextRootPackageJsonSource = patchRootPackageJsonSource(rootPackageJsonSource, {
    packageManagerField: adapter.packageManagerField,
    scripts: {},
    workspaces: normalizedWorkspaces,
  })

  await writeFile(rootPackageJsonPath, nextRootPackageJsonSource, 'utf8')
}

export async function applyRootTemplates(
  targetRoot: string,
  tokens: TemplateTokens,
  workspaces: WorkspaceName[],
) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const rootTemplateDir = path.join(templatesRoot, 'root')
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const normalizedWorkspaces = normalizeRootWorkspaces(workspaces)

  const fileMappings = [['nx.json', 'nx.json']] as const

  for (const [sourceName, targetName] of fileMappings) {
    await copyFileWithTokens(
      path.join(rootTemplateDir, sourceName),
      path.join(targetRoot, targetName),
      tokens,
    )
  }

  for (const rootTemplateFile of packageManager.rootTemplateFiles) {
    await copyFileWithTokens(
      path.join(rootTemplateDir, rootTemplateFile.sourceName),
      path.join(targetRoot, rootTemplateFile.targetName),
      tokens,
    )
  }

  const rootPackageJsonSource = replaceTemplateTokens(
    await readFile(path.join(rootTemplateDir, 'package.json'), 'utf8'),
    tokens,
  )
  const nextRootPackageJsonSource = patchRootPackageJsonSource(rootPackageJsonSource, {
    packageManagerField: packageManager.packageManagerField,
    scripts: {
      build: 'nx run-many -t build --all',
      typecheck: 'nx run-many -t typecheck --all',
      test: 'nx run-many -t test --all',
      format: packageManager.rootFormatScript(),
      'format:check': packageManager.rootFormatCheckScript(),
      lint: packageManager.rootLintScript(),
      verify: packageManager.rootVerifyScript(),
    },
    workspaces: packageManager.workspaceManifestFile === null ? normalizedWorkspaces : null,
  })

  await mkdir(targetRoot, { recursive: true })
  await writeFile(path.join(targetRoot, 'package.json'), nextRootPackageJsonSource, 'utf8')

  if (packageManager.workspaceManifestFile) {
    await writeFile(
      path.join(targetRoot, packageManager.workspaceManifestFile),
      renderPnpmWorkspaceManifest(normalizedWorkspaces),
      'utf8',
    )
  }

  for (const extraRootFile of packageManager.extraRootFiles) {
    await copyOptionalTemplateFile(
      path.join(rootTemplateDir, extraRootFile.sourceName),
      path.join(targetRoot, extraRootFile.targetName),
      tokens,
    )
  }
}

export async function applyTrpcWorkspaceTemplate(
  targetRoot: string,
  tokens: TemplateTokens,
  options: {
    serverProvider: 'supabase' | 'cloudflare'
  },
) {
  await applyTrpcWorkspaceTemplateImpl(targetRoot, tokens, options)
}

export async function applyDocsTemplates(targetRoot: string, tokens: TemplateTokens) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const baseTemplateDir = path.join(templatesRoot, 'base')

  await copyFileWithTokens(
    path.join(baseTemplateDir, 'AGENTS.md'),
    path.join(targetRoot, 'AGENTS.md'),
    tokens,
  )
  await copyDirectoryWithTokens(
    path.join(baseTemplateDir, 'docs'),
    path.join(targetRoot, 'docs'),
    tokens,
  )
}

export async function syncOptionalDocsTemplates(
  targetRoot: string,
  tokens: TemplateTokens,
  options: OptionalDocsOptions,
) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const optionalTemplateRoot = path.join(templatesRoot, 'optional')

  for (const template of resolveOptionalDocTemplates(options)) {
    await copyOptionalTemplateDirectory(
      path.join(optionalTemplateRoot, template.templateDir),
      targetRoot,
      tokens,
    )
  }

  const agentsPath = path.join(targetRoot, 'AGENTS.md')
  if (await pathExists(agentsPath)) {
    const agentsSource = await readFile(agentsPath, 'utf8')
    const nextAgentsSource = replaceMarkedSection(
      replaceMarkedSection(agentsSource, {
        startMarker: OPTIONAL_GOLDEN_RULES_START_MARKER,
        endMarker: OPTIONAL_GOLDEN_RULES_END_MARKER,
        renderedSection: renderOptionalGoldenRulesSection(options),
        fallbackAnchor: '## Start Here',
      }),
      {
        startMarker: OPTIONAL_AGENTS_START_MARKER,
        endMarker: OPTIONAL_AGENTS_END_MARKER,
        renderedSection: renderOptionalAgentsSection(options),
        fallbackAnchor: '- `docs/engineering/native-modules-policy.md`',
      },
    )
    await writeFile(agentsPath, nextAgentsSource, 'utf8')
  }

  const docsIndexPath = path.join(targetRoot, 'docs', 'index.md')
  if (await pathExists(docsIndexPath)) {
    const docsIndexSource = await readFile(docsIndexPath, 'utf8')
    const nextDocsIndexSource = replaceMarkedSection(docsIndexSource, {
      startMarker: OPTIONAL_DOCS_INDEX_START_MARKER,
      endMarker: OPTIONAL_DOCS_INDEX_END_MARKER,
      renderedSection: renderOptionalDocsIndexSection(options),
      fallbackAnchor: '- Native modules policy: `engineering/native-modules-policy.md`',
    })
    await writeFile(docsIndexPath, nextDocsIndexSource, 'utf8')
  }
}

export async function applyWorkspaceProjectTemplate(
  targetRoot: string,
  workspace: WorkspaceName,
  tokens: TemplateTokens,
) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const templateName = `${workspace}.project.json`
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const projectJson = await readJsonTemplate<WorkspaceProjectJson>(
    path.join(templatesRoot, 'root', templateName),
    tokens,
  )

  projectJson.targets ??= {}
  projectJson.targets.build ??= {}
  projectJson.targets.typecheck ??= {}
  projectJson.targets.test ??= {}
  projectJson.targets.build.command = packageManager.workspaceRunCommand(workspace, 'build')
  projectJson.targets.typecheck.command = packageManager.workspaceRunCommand(workspace, 'typecheck')
  projectJson.targets.test.command = packageManager.workspaceRunCommand(workspace, 'test')

  await writeJsonFile(path.join(targetRoot, workspace, 'project.json'), projectJson)
}

export async function applyServerPackageTemplate(targetRoot: string, tokens: TemplateTokens) {
  const templatesRoot = resolveTemplatesPackageRoot()
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const serverRoot = path.join(targetRoot, 'server')
  const packageJson = await readJsonTemplate<ServerPackageJson>(
    path.join(templatesRoot, 'root', 'server.package.json'),
    tokens,
  )

  packageJson.scripts ??= {}
  packageJson.scripts.dev = packageManager.dlxCommand('supabase', ['start', '--workdir', '.'])
  packageJson.scripts.build = packageManager.runScript('typecheck')
  packageJson.scripts['db:apply'] = 'node ./scripts/supabase-db-apply.mjs'
  packageJson.scripts['db:apply:remote'] = 'node ./scripts/supabase-db-apply.mjs'
  packageJson.scripts['functions:serve'] = packageManager.dlxCommand('supabase', [
    'functions',
    'serve',
    '--env-file',
    './.env.local',
    '--workdir',
    '.',
  ])
  packageJson.scripts['functions:deploy'] = 'node ./scripts/supabase-functions-deploy.mjs'
  packageJson.scripts['db:apply:local'] = packageManager.dlxCommand('supabase', [
    'db',
    'push',
    '--local',
    '--workdir',
    '.',
  ])
  packageJson.scripts['db:reset'] = packageManager.dlxCommand('supabase', [
    'db',
    'reset',
    '--local',
    '--workdir',
    '.',
  ])

  await writeJsonFile(path.join(serverRoot, 'package.json'), packageJson)
  if (tokens.packageManager === 'npm') {
    await writeWorkspaceNpmrc(serverRoot)
  }
  await mkdir(path.join(serverRoot, 'scripts'), { recursive: true })
  await writeFile(
    path.join(serverRoot, 'scripts', 'supabase-db-apply.mjs'),
    renderSupabaseDbApplyScript(tokens),
    'utf8',
  )
  await writeFile(
    path.join(serverRoot, 'scripts', 'supabase-functions-deploy.mjs'),
    renderSupabaseFunctionsDeployScript(tokens),
    'utf8',
  )
}

export async function applyFirebaseServerWorkspaceTemplate(
  targetRoot: string,
  tokens: TemplateTokens,
  options?: {
    projectId?: string | null
    functionRegion?: string
  },
) {
  const serverRoot = path.join(targetRoot, 'server')
  const functionsRoot = path.join(serverRoot, 'functions')

  await mkdir(path.join(functionsRoot, 'src'), { recursive: true })
  await writeFile(
    path.join(serverRoot, '.firebaserc'),
    renderFirebaseFirebaserc(options?.projectId),
    'utf8',
  )
  await writeFile(path.join(serverRoot, 'firebase.json'), renderFirebaseJson(tokens), 'utf8')
  await writeFile(path.join(serverRoot, '.gitignore'), renderFirebaseServerGitignore(), 'utf8')
  await writeJsonFile(
    path.join(serverRoot, 'package.json'),
    renderFirebaseServerPackageJson(tokens),
  )
  await mkdir(path.join(serverRoot, 'scripts'), { recursive: true })
  await writeFile(
    path.join(serverRoot, 'scripts', 'firebase-functions-deploy.mjs'),
    renderFirebaseFunctionsDeployScript(tokens),
    'utf8',
  )
  if (tokens.packageManager === 'npm') {
    await writeWorkspaceNpmrc(serverRoot)
    await writeWorkspaceNpmrc(functionsRoot)
  }
  await writeFile(
    path.join(functionsRoot, '.gitignore'),
    renderFirebaseFunctionsGitignore(tokens.packageManager),
    'utf8',
  )
  await writeJsonFile(
    path.join(functionsRoot, 'package.json'),
    renderFirebaseFunctionsPackageJson(tokens.packageManager),
  )
  if (tokens.packageManager === 'yarn') {
    await writeFile(
      path.join(functionsRoot, '.yarnrc.yml'),
      renderFirebaseFunctionsYarnrc(),
      'utf8',
    )
    await writeFile(path.join(functionsRoot, 'yarn.lock'), '', 'utf8')
  }
  await writeFile(
    path.join(functionsRoot, 'tsconfig.json'),
    renderFirebaseFunctionsTsconfig(),
    'utf8',
  )
  await writeFile(
    path.join(functionsRoot, 'src', 'index.ts'),
    renderFirebaseFunctionsIndex(options?.functionRegion),
    'utf8',
  )
}

export async function patchFirebaseServerProjectId(targetRoot: string, projectId: string) {
  await writeFile(
    path.join(targetRoot, 'server', '.firebaserc'),
    renderFirebaseFirebaserc(projectId),
    'utf8',
  )
}

export async function patchFirebaseFunctionRegion(targetRoot: string, region: string) {
  await writeFile(
    path.join(targetRoot, 'server', 'functions', 'src', 'index.ts'),
    renderFirebaseFunctionsIndex(region),
    'utf8',
  )
}

export function getFirebaseWebSdkVersion() {
  return FIREBASE_WEB_SDK_VERSION
}

export async function removePathIfExists(targetPath: string) {
  try {
    await rm(targetPath, { recursive: true, force: true })
  } catch {
    // noop
  }
}

export async function ensureEmptyDirectory(targetRoot: string) {
  await mkdir(targetRoot, { recursive: true })
  const entries = await readdir(targetRoot)

  if (entries.length > 0) {
    throw new Error(`대상 디렉터리가 비어 있지 않습니다: ${targetRoot}`)
  }
}

export async function pathExists(targetPath: string) {
  try {
    await stat(targetPath)
    return true
  } catch {
    return false
  }
}

export async function copyDirectory(sourceDir: string, targetDir: string) {
  await cp(sourceDir, targetDir, { recursive: true })
}
