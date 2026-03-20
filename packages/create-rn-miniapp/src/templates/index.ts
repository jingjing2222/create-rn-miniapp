import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import { patchRootPackageJsonSource } from '../patching/package-json.js'
import {
  APP_ROUTER_WORKSPACE_PATH,
  applyTrpcWorkspaceTemplate as applyTrpcWorkspaceTemplateImpl,
  CONTRACTS_WORKSPACE_PATH,
} from './trpc.js'

const ROOT_WORKSPACE_ORDER = [
  'frontend',
  'server',
  CONTRACTS_WORKSPACE_PATH,
  APP_ROUTER_WORKSPACE_PATH,
  'backoffice',
] as const

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
  hasWorktreePolicy: boolean
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
const FIREBASE_NODE_ENGINE = '22'
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
const OPTIONAL_WORKTREE_WORKFLOW_START_MARKER = '<!-- optional-worktree-workflow:start -->'
const OPTIONAL_WORKTREE_WORKFLOW_END_MARKER = '<!-- optional-worktree-workflow:end -->'
const SINGLE_ROOT_FINALIZE_LINE = '14. 브랜치 생성, 커밋, 브랜치 푸시, PR 생성 순으로 마무리한다.'
const NPMRC_SOURCE = 'legacy-peer-deps=true\n'
const FRONTEND_POLICY_CHECK_SCRIPT = 'node ./scripts/verify-frontend-routes.mjs'

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

function renderRootVerifyScript(packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)
  return `${adapter.rootVerifyScript()} && ${adapter.runScript('frontend:policy:check')}`
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

function renderSupabaseFunctionsTypecheckScript() {
  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readdirSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const functionsRoot = path.join(serverRoot, 'supabase', 'functions')",
    '',
    'function collectFunctionEntrypoints(rootDir) {',
    '  if (!existsSync(rootDir)) {',
    '    return []',
    '  }',
    '',
    '  return readdirSync(rootDir, { withFileTypes: true })',
    "    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))",
    "    .map((entry) => path.join(rootDir, entry.name, 'index.ts'))",
    '    .filter((entrypoint) => existsSync(entrypoint))',
    '    .sort((left, right) => left.localeCompare(right))',
    '}',
    '',
    'const entrypoints = collectFunctionEntrypoints(functionsRoot)',
    'if (entrypoints.length === 0) {',
    "  console.log('[server] typecheck할 Supabase Edge Function entrypoint를 찾지 못했어요.')",
    '  process.exit(0)',
    '}',
    '',
    "const denoCommand = process.platform === 'win32' ? 'deno.cmd' : 'deno'",
    'for (const entrypoint of entrypoints) {',
    '  const functionRoot = path.dirname(entrypoint)',
    "  const denoConfigPath = path.join(functionRoot, 'deno.json')",
    "  const args = existsSync(denoConfigPath) ? ['check', '--config', denoConfigPath, entrypoint] : ['check', entrypoint]",
    '  const result = spawnSync(denoCommand, args, {',
    '    cwd: serverRoot,',
    "    stdio: 'inherit',",
    '    env: process.env,',
    '  })',
    '',
    "  if (typeof result.status === 'number' && result.status !== 0) {",
    '    process.exit(result.status)',
    '  }',
    '',
    '  if (result.error) {',
    "    if (typeof result.error === 'object' && result.error !== null && 'code' in result.error && result.error.code === 'ENOENT') {",
    "      console.error('[server] Supabase Edge Function typecheck에는 Deno가 필요해요. https://supabase.com/docs/guides/functions/development-environment#step-1-install-deno 를 먼저 확인해 주세요.')",
    '      process.exit(1)',
    '    }',
    '',
    '    throw result.error',
    '  }',
    '}',
    '',
  ].join('\n')
}

function renderFirebaseFunctionsDeployScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx('firebase-tools', [
    'deploy',
    '--only',
    '__FIREBASE_DEPLOY_ONLY__',
    '--config',
    'firebase.json',
    '--project',
    '__FIREBASE_PROJECT_ID__',
  ])
  const onlyPlaceholderIndex = command.args.indexOf('__FIREBASE_DEPLOY_ONLY__')
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
    "    console.error('[server] GOOGLE_APPLICATION_CREDENTIALS file not found: ' + resolvedCredentials)",
    '    process.exit(1)',
    '  }',
    '',
    '  commandEnv.GOOGLE_APPLICATION_CREDENTIALS = resolvedCredentials',
    '} else {',
    '  delete commandEnv.GOOGLE_APPLICATION_CREDENTIALS',
    '}',
    '',
    "const onlyTarget = process.argv.includes('--only')",
    "  ? (process.argv[process.argv.indexOf('--only') + 1]?.trim() ?? '')",
    "  : 'functions,firestore:rules,firestore:indexes'",
    '',
    'if (!onlyTarget) {',
    "  console.error('[server] --only requires a Firebase deploy target.')",
    '  process.exit(1)',
    '}',
    '',
    `const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'`,
    `const baseArgs = ${JSON.stringify(command.args)};`,
    'const finalArgs = [',
    `  ...baseArgs.slice(0, ${onlyPlaceholderIndex}),`,
    '  onlyTarget,',
    `  ...baseArgs.slice(${onlyPlaceholderIndex + 1}, ${projectPlaceholderIndex}),`,
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
      firestore: {
        rules: 'firestore.rules',
        indexes: 'firestore.indexes.json',
      },
    },
    null,
    2,
  )}\n`
}

function renderFirebaseFirestoreRules() {
  return [
    "rules_version = '2';",
    'service cloud.firestore {',
    '  match /databases/{database}/documents {',
    '    match /{document=**} {',
    '      allow read, write: if false;',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n')
}

function renderFirebaseFirestoreIndexes() {
  return `${JSON.stringify(
    {
      indexes: [],
      fieldOverrides: [],
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
      test: 'tsx --test src/**/*.test.ts',
      'seed:public-status': 'tsx src/seed-public-status.ts',
    },
    dependencies: {
      '@google-cloud/functions-framework': GOOGLE_CLOUD_FUNCTIONS_FRAMEWORK_VERSION,
      'firebase-admin': FIREBASE_ADMIN_VERSION,
      'firebase-functions': FIREBASE_FUNCTIONS_VERSION,
    },
    devDependencies: {
      '@types/node': '^24.10.1',
      tsx: '^4.20.5',
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
    "import { getApps, initializeApp } from 'firebase-admin/app'",
    "import { getFirestore } from 'firebase-admin/firestore'",
    "import { setGlobalOptions } from 'firebase-functions'",
    "import { HttpsError, onCall, onRequest } from 'firebase-functions/https'",
    'import {',
    '  buildPublicAppStatusDocument,',
    '  publicAppStatusCollection,',
    '  publicAppStatusDocumentId,',
    "} from './public-status'",
    '',
    'if (getApps().length === 0) {',
    '  initializeApp()',
    '}',
    '',
    'setGlobalOptions({',
    `  region: '${region}',`,
    '  maxInstances: 10,',
    '})',
    '',
    `export const ${FIREBASE_DEFAULT_FUNCTION_NAME} = onRequest(async (request, response) => {`,
    '  const firestore = getFirestore()',
    "  const normalizedPath = request.path === '/' ? '/' : request.path.replace(/\\/$/, '')",
    '',
    '  try {',
    "    if (request.method === 'GET' && (normalizedPath === '/' || normalizedPath === '/health')) {",
    '      response.json({',
    '        ok: true,',
    "        provider: 'firebase',",
    '        path: request.path,',
    '      })',
    '      return',
    '    }',
    '',
    "    if (request.method === 'GET' && normalizedPath === '/public-status') {",
    '      const snapshot = await firestore',
    '        .collection(publicAppStatusCollection)',
    '        .doc(publicAppStatusDocumentId)',
    '        .get()',
    '',
    '      if (!snapshot.exists) {',
    '        response.status(404).json({',
    '          ok: false,',
    "          error: 'public app status document not found',",
    '        })',
    '        return',
    '      }',
    '',
    '      response.json({',
    '        ok: true,',
    '        data: snapshot.data(),',
    '      })',
    '      return',
    '    }',
    '',
    "    if (request.method === 'POST' && normalizedPath === '/seed-public-status') {",
    '      const document = buildPublicAppStatusDocument()',
    '',
    '      await firestore',
    '        .collection(publicAppStatusCollection)',
    '        .doc(publicAppStatusDocumentId)',
    '        .set(document)',
    '',
    '      response.json({',
    '        ok: true,',
    '        data: document,',
    '      })',
    '      return',
    '    }',
    '',
    '    response.status(404).json({',
    '      ok: false,',
    "      error: 'not found',",
    '      path: request.path,',
    '    })',
    '  } catch (error: unknown) {',
    "    const message = error instanceof Error ? error.message : 'unexpected error'",
    '',
    '    response.status(500).json({',
    '      ok: false,',
    '      error: message,',
    '    })',
    '  }',
    '})',
    '',
    'export const getPublicStatus = onCall(async () => {',
    '  const snapshot = await getFirestore()',
    '    .collection(publicAppStatusCollection)',
    '    .doc(publicAppStatusDocumentId)',
    '    .get()',
    '',
    '  if (!snapshot.exists) {',
    "    throw new HttpsError('not-found', 'public app status document not found')",
    '  }',
    '',
    '  return snapshot.data()',
    '})',
    '',
  ].join('\n')
}

function renderFirebasePublicStatusSource() {
  return [
    'export interface PublicStatusItem {',
    '  label: string',
    '  value: string',
    '}',
    '',
    'export interface PublicAppStatusDocument {',
    '  title: string',
    '  message: string',
    "  source: 'server/functions'",
    '  updatedAtIso: string',
    '  updatedAtLabel: string',
    '  items: PublicStatusItem[]',
    '}',
    '',
    "export const publicAppStatusCollection = 'publicAppStatus'",
    "export const publicAppStatusDocumentId = 'current'",
    '',
    'export function buildPublicAppStatusDocument(now: Date = new Date()): PublicAppStatusDocument {',
    '  return {',
    "    title: 'Firebase 연결 준비 완료',",
    "    message: 'frontend가 Firestore 문서를 직접 읽고 있어요.',",
    "    source: 'server/functions',",
    '    updatedAtIso: now.toISOString(),',
    '    updatedAtLabel: formatSeoulDateTime(now),',
    '    items: [',
    "      { label: 'DB', value: 'Cloud Firestore' },",
    "      { label: '읽기 경로', value: 'frontend -> Firestore Web SDK' },",
    "      { label: '시드 경로', value: 'server/functions -> Admin SDK' },",
    '    ],',
    '  }',
    '}',
    '',
    'function formatSeoulDateTime(date: Date): string {',
    '  const seoulTime = new Date(date.getTime() + 9 * 60 * 60 * 1000)',
    '  const year = seoulTime.getUTCFullYear()',
    "  const month = String(seoulTime.getUTCMonth() + 1).padStart(2, '0')",
    "  const day = String(seoulTime.getUTCDate()).padStart(2, '0')",
    "  const hour = String(seoulTime.getUTCHours()).padStart(2, '0')",
    "  const minute = String(seoulTime.getUTCMinutes()).padStart(2, '0')",
    '',
    `  return \`\${year}-\${month}-\${day} \${hour}:\${minute} KST\``,
    '}',
    '',
  ].join('\n')
}

function renderFirebaseSeedPublicStatusScript() {
  return [
    "import { readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { cert, getApps, initializeApp } from 'firebase-admin/app'",
    "import { getFirestore } from 'firebase-admin/firestore'",
    'import {',
    '  buildPublicAppStatusDocument,',
    '  publicAppStatusCollection,',
    '  publicAppStatusDocumentId,',
    "} from './public-status'",
    '',
    'function stripWrappingQuotes(value: string) {',
    `  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {`,
    '    return value.slice(1, -1)',
    '  }',
    '',
    '  return value',
    '}',
    '',
    'function loadLocalEnv(filePath: string): Record<string, string> {',
    "  const source = readFileSync(filePath, 'utf8')",
    '  const result: Record<string, string> = {}',
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
    '    result[key] = value',
    '  }',
    '',
    '  return result',
    '}',
    '',
    'async function main() {',
    "  const serverRoot = path.resolve(process.cwd(), '..')",
    "  const env = loadLocalEnv(path.join(serverRoot, '.env.local'))",
    "  const projectId = env.FIREBASE_PROJECT_ID?.trim() ?? ''",
    "  const credentials = env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? ''",
    '',
    '  if (!projectId) {',
    "    throw new Error('FIREBASE_PROJECT_ID is required in server/.env.local.')",
    '  }',
    '',
    '  if (!credentials) {',
    "    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required in server/.env.local.')",
    '  }',
    '',
    '  const resolvedCredentials = path.isAbsolute(credentials)',
    '    ? credentials',
    '    : path.resolve(serverRoot, credentials)',
    "  const serviceAccount = JSON.parse(readFileSync(resolvedCredentials, 'utf8'))",
    '',
    '  if (getApps().length === 0) {',
    '    initializeApp({',
    '      credential: cert(serviceAccount),',
    '      projectId,',
    '    })',
    '  }',
    '',
    '  const document = buildPublicAppStatusDocument()',
    '',
    '  await getFirestore()',
    '    .collection(publicAppStatusCollection)',
    '    .doc(publicAppStatusDocumentId)',
    '    .set(document)',
    '',
    `  process.stdout.write(\`\${JSON.stringify(document, null, 2)}\\n\`)`,
    '}',
    '',
    'void main().catch((error: unknown) => {',
    '  const message = error instanceof Error ? error.message : String(error)',
    `  process.stderr.write(\`\${message}\\n\`)`,
    '  process.exit(1)',
    '})',
    '',
  ].join('\n')
}

function renderFirebaseEnsureFirestoreScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const getCommand = packageManager.dlx('firebase-tools', [
    'firestore:databases:get',
    '(default)',
    '--project',
    '__FIREBASE_PROJECT_ID__',
    '--json',
  ])
  const createCommand = packageManager.dlx('firebase-tools', [
    'firestore:databases:create',
    '(default)',
    '--project',
    '__FIREBASE_PROJECT_ID__',
    '--location',
    '__FIREBASE_REGION__',
    '--json',
  ])
  const projectPlaceholderIndex = getCommand.args.indexOf('__FIREBASE_PROJECT_ID__')
  const createProjectPlaceholderIndex = createCommand.args.indexOf('__FIREBASE_PROJECT_ID__')
  const createRegionPlaceholderIndex = createCommand.args.indexOf('__FIREBASE_REGION__')

  return [
    "import { spawnSync } from 'node:child_process'",
    "import { existsSync, readFileSync } from 'node:fs'",
    "import path from 'node:path'",
    "import process from 'node:process'",
    "import { fileURLToPath } from 'node:url'",
    "import { GoogleAuth } from 'google-auth-library'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const envPath = path.join(serverRoot, '.env.local')",
    `const packageManagerCommand = process.platform === 'win32' ? '${getCommand.command}.cmd' : '${getCommand.command}'`,
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
    'function runFirebaseCommand(args, env) {',
    '  return spawnSync(packageManagerCommand, args, {',
    '    cwd: serverRoot,',
    '    env,',
    "    encoding: 'utf8',",
    '  })',
    '}',
    '',
    'async function enableFirestoreApi(projectId, credentialsPath) {',
    '  const auth = new GoogleAuth({',
    '    keyFile: credentialsPath,',
    "    scopes: ['https://www.googleapis.com/auth/cloud-platform'],",
    '  })',
    '  const client = await auth.getClient()',
    '',
    '  await client.request({',
    `    url: \`https://serviceusage.googleapis.com/v1/projects/\${projectId}/services/firestore.googleapis.com:enable\`,`,
    "    method: 'POST',",
    '  })',
    '}',
    '',
    'async function main() {',
    '  loadLocalEnv(envPath)',
    '',
    "  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? ''",
    "  const firebaseToken = process.env.FIREBASE_TOKEN?.trim() ?? ''",
    "  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? ''",
    "  const databaseLocation = process.env.FIREBASE_FUNCTION_REGION?.trim() || 'asia-northeast3'",
    '  const commandEnv = { ...process.env }',
    '',
    '  if (!projectId) {',
    "    console.error('[server] FIREBASE_PROJECT_ID is required. Set server/.env.local before running firestore:ensure.')",
    '    process.exit(1)',
    '  }',
    '',
    '  const resolvedCredentials = credentials',
    '    ? path.isAbsolute(credentials)',
    '      ? credentials',
    '      : path.resolve(serverRoot, credentials)',
    "    : ''",
    '',
    '  if (resolvedCredentials) {',
    '    commandEnv.GOOGLE_APPLICATION_CREDENTIALS = resolvedCredentials',
    '  }',
    '',
    "  const baseAuthArgs = firebaseToken ? ['--token', firebaseToken, '--non-interactive'] : []",
    `  const baseGetArgs = ${JSON.stringify(getCommand.args)}`,
    `  const baseCreateArgs = ${JSON.stringify(createCommand.args)}`,
    '  let getResult = runFirebaseCommand(',
    '    [',
    `      ...baseGetArgs.slice(0, ${projectPlaceholderIndex}),`,
    '      projectId,',
    `      ...baseGetArgs.slice(${projectPlaceholderIndex + 1}),`,
    '      ...baseAuthArgs,',
    '    ],',
    '    commandEnv,',
    '  )',
    '',
    '  if (getResult.status === 0) {',
    '    process.stdout.write(getResult.stdout)',
    '    process.exit(0)',
    '  }',
    '',
    '  const disabledApiPattern = /Cloud Firestore API has not been used|it is disabled/i',
    `  const getErrorText = \`\${getResult.stderr ?? ''}\${getResult.stdout ?? ''}\``,
    '',
    '  if (disabledApiPattern.test(getErrorText) && resolvedCredentials) {',
    '    await enableFirestoreApi(projectId, resolvedCredentials)',
    '',
    '    getResult = runFirebaseCommand(',
    '      [',
    `        ...baseGetArgs.slice(0, ${projectPlaceholderIndex}),`,
    '        projectId,',
    `        ...baseGetArgs.slice(${projectPlaceholderIndex + 1}),`,
    '        ...baseAuthArgs,',
    '      ],',
    '      commandEnv,',
    '    )',
    '',
    '    if (getResult.status === 0) {',
    '      process.stdout.write(getResult.stdout)',
    '      process.exit(0)',
    '    }',
    '  }',
    '',
    '  const createResult = runFirebaseCommand(',
    '    [',
    `      ...baseCreateArgs.slice(0, ${createProjectPlaceholderIndex}),`,
    '      projectId,',
    `      ...baseCreateArgs.slice(${createProjectPlaceholderIndex + 1}, ${createRegionPlaceholderIndex}),`,
    '      databaseLocation,',
    `      ...baseCreateArgs.slice(${createRegionPlaceholderIndex + 1}),`,
    '      ...baseAuthArgs,',
    '    ],',
    '    commandEnv,',
    '  )',
    '',
    '  if (createResult.status === 0) {',
    '    process.stdout.write(createResult.stdout)',
    '    process.exit(0)',
    '  }',
    '',
    '  process.stderr.write(getResult.stderr || getResult.stdout)',
    '  process.stderr.write(createResult.stderr || createResult.stdout)',
    '  process.exit(createResult.status ?? 1)',
    '}',
    '',
    'void main().catch((error) => {',
    '  const message = error instanceof Error ? error.message : String(error)',
    `  process.stderr.write(\`\${message}\\n\`)`,
    '  process.exit(1)',
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
    dependencies: {
      'google-auth-library': '^10.6.1',
    },
    scripts: {
      dev: `${installFunctionsCommand} && ${packageManager.dlxCommand('firebase-tools', ['emulators:start', '--only', 'functions,firestore', '--config', 'firebase.json'])}`,
      build: `${installFunctionsCommand} && ${packageManager.runScriptInDirectoryCommand(functionsDirectory, 'build')}`,
      typecheck: `${installFunctionsCommand} && ${packageManager.runScriptInDirectoryCommand(functionsDirectory, 'typecheck')}`,
      test: `${installFunctionsCommand} && ${packageManager.runScriptInDirectoryCommand(functionsDirectory, 'test')}`,
      'firestore:ensure': 'node ./scripts/firebase-ensure-firestore.mjs',
      deploy: `${installFunctionsCommand} && node ./scripts/firebase-functions-deploy.mjs`,
      'deploy:firestore':
        'node ./scripts/firebase-functions-deploy.mjs --only firestore:rules,firestore:indexes',
      'seed:public-status': `${installFunctionsCommand} && ${packageManager.runScriptInDirectoryCommand(functionsDirectory, 'seed:public-status')}`,
      'setup:public-status': `${packageManager.runScript('firestore:ensure')} && ${packageManager.runScript('deploy:firestore')} && ${packageManager.runScript('seed:public-status')}`,
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

  if (options.hasWorktreePolicy) {
    lines.push(
      '- `docs/engineering/worktree-workflow.md`',
      '  - control root bootstrap과 `main/` + sibling worktree 운영 규칙을 먼저 보는 문서',
    )
  }

  return lines.join('\n')
}

function renderOptionalGoldenRulesSection(options: OptionalDocsOptions) {
  const lines: string[] = []
  let ruleNumber = 9

  if (options.hasTrpc) {
    lines.push(
      `${ruleNumber}. Boundary types from schema only: client-server 경계 타입은 Zod schema에서 \`z.infer\`로만 파생하고, 같은 DTO를 별도 type alias로 중복 정의하지 않는다.`,
    )
    ruleNumber++
  }

  if (options.hasWorktreePolicy) {
    lines.push(
      `${ruleNumber}. Worktree discipline: plain clone 상태라면 README의 bootstrap 절차를 먼저 실행하고, 새 작업은 반드시 control root에서 \`git -C main worktree add -b <branch-name> ../<branch-name> main\`으로 시작하며, 브랜치명에는 \`/\`를 쓰지 않고 1-depth kebab-case를 쓰며, \`main/\`과 sibling worktree에서만 작업하며, 구현, 커밋, 푸시, PR 생성은 그 worktree 안에서만 진행한다.`,
    )
    ruleNumber++
  }

  return lines.join('\n')
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

  if (options.hasWorktreePolicy) {
    lines.push('- Worktree workflow: `engineering/worktree-workflow.md`')
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

  if (options.hasWorktreePolicy) {
    templates.push({
      templateDir: 'worktree',
    })
  }

  return templates
}

export async function syncRootWorkspaceManifest(
  workspaceRoot: string,
  packageManager: PackageManager,
  workspaces: WorkspaceName[],
) {
  const adapter = getPackageManagerAdapter(packageManager)
  const normalizedWorkspaces = normalizeRootWorkspaces(workspaces)

  if (adapter.workspaceManifestFile) {
    await writeFile(
      path.join(workspaceRoot, adapter.workspaceManifestFile),
      renderPnpmWorkspaceManifest(normalizedWorkspaces),
      'utf8',
    )
    return
  }

  const rootPackageJsonPath = path.join(workspaceRoot, 'package.json')
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

  const fileMappings = [
    ['nx.json', 'nx.json'],
    ['verify-frontend-routes.mjs', 'scripts/verify-frontend-routes.mjs'],
  ] as const

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
      'frontend:policy:check': FRONTEND_POLICY_CHECK_SCRIPT,
      verify: renderRootVerifyScript(tokens.packageManager),
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
    serverProvider: 'cloudflare'
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

  const harnessGuidePath = path.join(targetRoot, 'docs', 'engineering', '하네스-실행가이드.md')
  if (await pathExists(harnessGuidePath)) {
    const harnessSource = await readFile(harnessGuidePath, 'utf8')
    let nextHarnessSource = replaceMarkedSection(harnessSource, {
      startMarker: OPTIONAL_WORKTREE_WORKFLOW_START_MARKER,
      endMarker: OPTIONAL_WORKTREE_WORKFLOW_END_MARKER,
      renderedSection: options.hasWorktreePolicy
        ? '14. 이 repo는 control root worktree 운영을 기준으로 한다. plain clone 상태라면 README bootstrap을 먼저 실행하고, 새 브랜치 작업은 control root에서 `git -C main worktree add -b <branch-name> ../<branch-name> main`으로 시작하며, 브랜치명에는 `/`를 쓰지 않고 1-depth kebab-case를 쓴다.'
        : '',
      fallbackAnchor: SINGLE_ROOT_FINALIZE_LINE,
    })

    if (options.hasWorktreePolicy && nextHarnessSource.includes(SINGLE_ROOT_FINALIZE_LINE)) {
      nextHarnessSource = nextHarnessSource.replace(
        SINGLE_ROOT_FINALIZE_LINE,
        '15. 브랜치 생성, 커밋, 브랜치 푸시, PR 생성 순으로 마무리한다.',
      )
    }

    await writeFile(harnessGuidePath, nextHarnessSource, 'utf8')
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
  packageJson.scripts.typecheck = 'node ./scripts/supabase-functions-typecheck.mjs'
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
    path.join(serverRoot, 'scripts', 'supabase-functions-typecheck.mjs'),
    renderSupabaseFunctionsTypecheckScript(),
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
  await writeFile(path.join(serverRoot, 'firestore.rules'), renderFirebaseFirestoreRules(), 'utf8')
  await writeFile(
    path.join(serverRoot, 'firestore.indexes.json'),
    renderFirebaseFirestoreIndexes(),
    'utf8',
  )
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
  await writeFile(
    path.join(serverRoot, 'scripts', 'firebase-ensure-firestore.mjs'),
    renderFirebaseEnsureFirestoreScript(tokens),
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
  await writeFile(
    path.join(functionsRoot, 'src', 'public-status.ts'),
    renderFirebasePublicStatusSource(),
    'utf8',
  )
  await writeFile(
    path.join(functionsRoot, 'src', 'seed-public-status.ts'),
    renderFirebaseSeedPublicStatusScript(),
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
