import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { FIREBASE_TOOLS_CLI, SUPABASE_CLI } from '../runtime/external-tooling.js'
import {
  renderProcessEnvLoaderScriptLines,
  renderTypedEnvReaderScriptLines,
} from '../server/env-loader-script.js'
import { getPackageManagerAdapter } from '../runtime/package-manager.js'
import {
  createFirebaseServerScriptCatalog,
  createServerScriptRecord,
  createSupabaseServerScriptCatalog,
  renderFirebaseFunctionsInstallCommand,
} from '../server/script-catalog.js'
import {
  readJsonTemplate,
  resolveTemplatesPackageRoot,
  writeJsonFile,
  writeWorkspaceNpmrc,
} from './filesystem.js'
import type {
  FirebaseFunctionsPackageJson,
  ServerPackageJson,
  TemplateTokens,
  WorkspaceName,
} from './types.js'
import { dedentWithTrailingNewline } from '../runtime/dedent.js'

export const SUPABASE_DEFAULT_FUNCTION_NAME = 'api'
export const FIREBASE_DEFAULT_FUNCTION_NAME = 'api'
export const FIREBASE_DEFAULT_FUNCTION_REGION = 'asia-northeast3'
const FIREBASE_NODE_ENGINE = '22'
const FIREBASE_WEB_SDK_VERSION = '^12.10.0'
const FIREBASE_ADMIN_VERSION = '^13.6.0'
const FIREBASE_FUNCTIONS_VERSION = '^7.0.0'
const GOOGLE_CLOUD_FUNCTIONS_FRAMEWORK_VERSION = '^3.4.5'
const FIREBASE_FUNCTIONS_TYPESCRIPT_VERSION = '^5.7.3'

type WorkspaceProjectJson = {
  targets?: Record<string, { command?: string }>
}

function renderSupabaseDbApplyScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx(SUPABASE_CLI, [
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
    
    const password = process.env.SUPABASE_DB_PASSWORD?.trim() ?? ''
    if (!password) {
      console.error('[server] SUPABASE_DB_PASSWORD is required. Set server/.env.local before running db:apply.')
      process.exit(1)
    }
    
    const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'
    const baseArgs = ${JSON.stringify(command.args)};
    const result = spawnSync(
      packageManagerCommand,
      [
        ...baseArgs.slice(0, ${passwordPlaceholderIndex}),
        password,
        ...baseArgs.slice(${passwordPlaceholderIndex + 1}),
      ],
      {
        cwd: serverRoot,
        stdio: 'inherit',
        env: process.env,
      },
    )
    
    if (typeof result.status === 'number') {
      process.exit(result.status)
    }
    
    if (result.error) {
      throw result.error
    }
    
    process.exit(1)
  `
}

function renderSupabaseFunctionsDeployScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx(SUPABASE_CLI, [
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
    
    const projectRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? ''
    if (!projectRef) {
      console.error('[server] SUPABASE_PROJECT_REF is required. Set server/.env.local before running functions:deploy.')
      process.exit(1)
    }
    
    const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'
    const baseArgs = ${JSON.stringify(command.args)};
    const requestedFunctions = process.argv.slice(2).map((value) => value.trim()).filter(Boolean)
    const result = spawnSync(
      packageManagerCommand,
      [
        ...baseArgs.slice(0, ${requestedFunctionsPlaceholderIndex}),
        ...requestedFunctions,
        ...baseArgs.slice(${requestedFunctionsPlaceholderIndex + 1}, ${projectRefPlaceholderIndex}),
        projectRef,
        ...baseArgs.slice(${projectRefPlaceholderIndex + 1}),
      ],
      {
        cwd: serverRoot,
        stdio: 'inherit',
        env: process.env,
      },
    )
    
    if (typeof result.status === 'number') {
      process.exit(result.status)
    }
    
    if (result.error) {
      throw result.error
    }
    
    process.exit(1)
  `
}

function renderSupabaseFunctionsTypecheckScript(tokens: TemplateTokens) {
  const installCommand = `cd server && ${getPackageManagerAdapter(tokens.packageManager).runScript('deno:install')}`
  const missingDenoMessage = `[server] Supabase Edge Function typecheck에는 Deno가 필요해요. 먼저 \`${installCommand}\`를 실행해 주세요.`

  return dedentWithTrailingNewline`
  import { spawnSync } from 'node:child_process'
  import { existsSync, readdirSync } from 'node:fs'
  import os from 'node:os'
  import path from 'node:path'
  import process from 'node:process'
  import { fileURLToPath } from 'node:url'

  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const functionsRoot = path.join(serverRoot, 'supabase', 'functions')
  const missingDenoMessage = ${JSON.stringify(missingDenoMessage)}

  function collectFunctionEntrypoints(rootDir) {
    if (!existsSync(rootDir)) {
      return []
    }

    return readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => path.join(rootDir, entry.name, 'index.ts'))
      .filter((entrypoint) => existsSync(entrypoint))
      .sort((left, right) => left.localeCompare(right))
  }

  function resolveDefaultDenoCommand() {
    return path.join(os.homedir(), '.deno', 'bin', process.platform === 'win32' ? 'deno.exe' : 'deno')
  }

  function resolveDenoCommand() {
    const pathCommand = process.platform === 'win32' ? 'deno.cmd' : 'deno'
    const pathProbe = spawnSync(pathCommand, ['--version'], { stdio: 'ignore' })

    if (!pathProbe.error) {
      return pathCommand
    }

    const defaultCommand = resolveDefaultDenoCommand()

    if (existsSync(defaultCommand)) {
      return defaultCommand
    }

    return pathCommand
  }

  const entrypoints = collectFunctionEntrypoints(functionsRoot)
  if (entrypoints.length === 0) {
    console.log('[server] typecheck할 Supabase Edge Function entrypoint를 찾지 못했어요.')
    process.exit(0)
  }

  const denoCommand = resolveDenoCommand()
  for (const entrypoint of entrypoints) {
    const functionRoot = path.dirname(entrypoint)
    const denoConfigPath = path.join(functionRoot, 'deno.json')
    const args = existsSync(denoConfigPath) ? ['check', '--config', denoConfigPath, entrypoint] : ['check', entrypoint]
    const result = spawnSync(denoCommand, args, {
      cwd: serverRoot,
      stdio: 'inherit',
      env: process.env,
    })

    if (typeof result.status === 'number' && result.status !== 0) {
      process.exit(result.status)
    }

    if (result.error) {
      if (typeof result.error === 'object' && result.error !== null && 'code' in result.error && result.error.code === 'ENOENT') {
        console.error(missingDenoMessage)
        process.exit(1)
      }

      throw result.error
    }
  }
`
}

function renderSupabaseInstallDenoScript() {
  const responseStatusExpression = '$' + '{response.status}'
  const responseStatusTextExpression = '$' + '{response.statusText}'
  const resolvedCommandExpression = '$' + '{resolvedCommand}'

  return dedentWithTrailingNewline`
  import { spawnSync } from 'node:child_process'
  import { existsSync } from 'node:fs'
  import os from 'node:os'
  import path from 'node:path'
  import process from 'node:process'

  const POSIX_INSTALL_URL = 'https://deno.land/install.sh'
  const WINDOWS_INSTALL_URL = 'https://deno.land/install.ps1'

  function resolveDefaultDenoCommand() {
    return path.join(os.homedir(), '.deno', 'bin', process.platform === 'win32' ? 'deno.exe' : 'deno')
  }

  function resolveInstalledDenoCommand() {
    const pathCommand = process.platform === 'win32' ? 'deno.cmd' : 'deno'
    const pathProbe = spawnSync(pathCommand, ['--version'], { stdio: 'ignore' })

    if (!pathProbe.error) {
      return pathCommand
    }

    const defaultCommand = resolveDefaultDenoCommand()

    if (existsSync(defaultCommand)) {
      return defaultCommand
    }

    return null
  }

  function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, {
      stdio: ['pipe', 'inherit', 'inherit'],
      encoding: 'utf8',
      env: process.env,
      ...options,
    })

    if (typeof result.status === 'number' && result.status === 0) {
      return
    }

    if (result.error) {
      throw result.error
    }

    if (typeof result.status === 'number') {
      process.exit(result.status)
      return
    }

    process.exit(1)
  }

  async function downloadInstallerSource(url) {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(\`Deno installer를 다운로드하지 못했어요: ${responseStatusExpression} ${responseStatusTextExpression}\`)
    }

    return await response.text()
  }

  async function main() {
    const installedCommand = resolveInstalledDenoCommand()

    if (installedCommand) {
      console.log('[server] Deno를 찾았어요. stable 채널로 \`deno upgrade stable\`를 실행할게요.')
      runCommand(installedCommand, ['upgrade', 'stable'])
    } else if (process.platform === "win32") {
      console.log('[server] Deno가 없어서 Windows installer로 stable 버전을 설치할게요.')
      const installerSource = await downloadInstallerSource(WINDOWS_INSTALL_URL)
      runCommand(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
        { input: installerSource },
      )
    } else {
      console.log('[server] Deno가 없어서 install.sh로 stable 버전을 설치할게요.')
      const installerSource = await downloadInstallerSource(POSIX_INSTALL_URL)
      runCommand('sh', ['-s', '--'], { input: installerSource })
    }

    const resolvedCommand = resolveInstalledDenoCommand()

    if (!resolvedCommand) {
      console.error('[server] Deno 설치가 끝났지만 실행 파일을 찾지 못했어요. 새 셸을 열거나 PATH를 확인해 주세요.')
      process.exit(1)
    }

    console.log(\`[server] Deno ready: ${resolvedCommandExpression}\`)
  }

  await main()
`
}

function renderFirebaseFunctionsDeployScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const command = packageManager.dlx(FIREBASE_TOOLS_CLI, [
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
    
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? ''
    if (!projectId) {
      console.error('[server] FIREBASE_PROJECT_ID is required. Set server/.env.local before running deploy.')
      process.exit(1)
    }
    
    const firebaseToken = process.env.FIREBASE_TOKEN?.trim() ?? ''
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? ''
    const commandEnv = { ...process.env }
    
    if (credentials) {
      const resolvedCredentials = path.isAbsolute(credentials)
        ? credentials
        : path.resolve(serverRoot, credentials)
    
      if (!readFileSync || !existsSync(resolvedCredentials)) {
        console.error('[server] GOOGLE_APPLICATION_CREDENTIALS file not found: ' + resolvedCredentials)
        process.exit(1)
      }
    
      commandEnv.GOOGLE_APPLICATION_CREDENTIALS = resolvedCredentials
    } else {
      delete commandEnv.GOOGLE_APPLICATION_CREDENTIALS
    }
    
    const onlyTarget = process.argv.includes('--only')
      ? (process.argv[process.argv.indexOf('--only') + 1]?.trim() ?? '')
      : 'functions,firestore:rules,firestore:indexes'
    
    if (!onlyTarget) {
      console.error('[server] --only requires a Firebase deploy target.')
      process.exit(1)
    }
    
    const packageManagerCommand = process.platform === 'win32' ? '${command.command}.cmd' : '${command.command}'
    const baseArgs = ${JSON.stringify(command.args)};
    const finalArgs = [
      ...baseArgs.slice(0, ${onlyPlaceholderIndex}),
      onlyTarget,
      ...baseArgs.slice(${onlyPlaceholderIndex + 1}, ${projectPlaceholderIndex}),
      projectId,
      ...baseArgs.slice(${projectPlaceholderIndex + 1}),
    ]
    
    if (firebaseToken) {
      finalArgs.push('--token', firebaseToken, '--non-interactive')
    }
    
    const result = spawnSync(packageManagerCommand, finalArgs, {
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
  return dedentWithTrailingNewline`
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if false;
      }
    }
  }
`
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
  return dedentWithTrailingNewline`
  # Firebase cache
  .firebase/
  firebase-debug.log*

  # Local env
  .env.local

  # Functions output
  functions/lib/
  functions/node_modules/
`
}

function renderFirebaseFunctionsGitignore(packageManager: string) {
  if (packageManager === 'yarn') {
    return dedentWithTrailingNewline`
      lib/
      node_modules/
      .yarn/
      .pnp.*
    `
  }

  return dedentWithTrailingNewline`
    lib/
    node_modules/
  `
}

function renderFirebaseFunctionsYarnrc() {
  return dedentWithTrailingNewline`
  nodeLinker: node-modules
`
}

function renderFirebaseFunctionsPackageJson(
  packageManager: TemplateTokens['packageManager'],
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
  return dedentWithTrailingNewline`
  import { getApps, initializeApp } from 'firebase-admin/app'
  import { getFirestore } from 'firebase-admin/firestore'
  import { setGlobalOptions } from 'firebase-functions'
  import { HttpsError, onCall, onRequest } from 'firebase-functions/https'
  import {
    buildPublicAppStatusDocument,
    publicAppStatusCollection,
    publicAppStatusDocumentId,
  } from './public-status'

  if (getApps().length === 0) {
    initializeApp()
  }

  setGlobalOptions({
    region: '${region}',
    maxInstances: 10,
  })

  export const ${FIREBASE_DEFAULT_FUNCTION_NAME} = onRequest(async (request, response) => {
    const firestore = getFirestore()
    const normalizedPath = request.path === '/' ? '/' : request.path.replace(/\\/$/, '')

    try {
      if (request.method === 'GET' && (normalizedPath === '/' || normalizedPath === '/health')) {
        response.json({
          ok: true,
          provider: 'firebase',
          path: request.path,
        })
        return
      }

      if (request.method === 'GET' && normalizedPath === '/public-status') {
        const snapshot = await firestore
          .collection(publicAppStatusCollection)
          .doc(publicAppStatusDocumentId)
          .get()

        if (!snapshot.exists) {
          response.status(404).json({
            ok: false,
            error: 'public app status document not found',
          })
          return
        }

        response.json({
          ok: true,
          data: snapshot.data(),
        })
        return
      }

      if (request.method === 'POST' && normalizedPath === '/seed-public-status') {
        const document = buildPublicAppStatusDocument()

        await firestore
          .collection(publicAppStatusCollection)
          .doc(publicAppStatusDocumentId)
          .set(document)

        response.json({
          ok: true,
          data: document,
        })
        return
      }

      response.status(404).json({
        ok: false,
        error: 'not found',
        path: request.path,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error'

      response.status(500).json({
        ok: false,
        error: message,
      })
    }
  })

  export const getPublicStatus = onCall(async () => {
    const snapshot = await getFirestore()
      .collection(publicAppStatusCollection)
      .doc(publicAppStatusDocumentId)
      .get()

    if (!snapshot.exists) {
      throw new HttpsError('not-found', 'public app status document not found')
    }

    return snapshot.data()
  })
`
}

function renderFirebasePublicStatusSource() {
  return dedentWithTrailingNewline`
  export interface PublicStatusItem {
    label: string
    value: string
  }

  export interface PublicAppStatusDocument {
    title: string
    message: string
    source: 'server/functions'
    updatedAtIso: string
    updatedAtLabel: string
    items: PublicStatusItem[]
  }

  export const publicAppStatusCollection = 'publicAppStatus'
  export const publicAppStatusDocumentId = 'current'

  export function buildPublicAppStatusDocument(now: Date = new Date()): PublicAppStatusDocument {
    return {
      title: 'Firebase 연결 준비 완료',
      message: 'frontend가 Firestore 문서를 직접 읽고 있어요.',
      source: 'server/functions',
      updatedAtIso: now.toISOString(),
      updatedAtLabel: formatSeoulDateTime(now),
      items: [
        { label: 'DB', value: 'Cloud Firestore' },
        { label: '읽기 경로', value: 'frontend -> Firestore Web SDK' },
        { label: '시드 경로', value: 'server/functions -> Admin SDK' },
      ],
    }
  }

  function formatSeoulDateTime(date: Date): string {
    const seoulTime = new Date(date.getTime() + 9 * 60 * 60 * 1000)
    const year = seoulTime.getUTCFullYear()
    const month = String(seoulTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(seoulTime.getUTCDate()).padStart(2, '0')
    const hour = String(seoulTime.getUTCHours()).padStart(2, '0')
    const minute = String(seoulTime.getUTCMinutes()).padStart(2, '0')

    return \`\${year}-\${month}-\${day} \${hour}:\${minute} KST\`
  }
`
}

function renderFirebaseSeedPublicStatusScript() {
  return dedentWithTrailingNewline`
    import { readFileSync } from 'node:fs'
    import path from 'node:path'
    import process from 'node:process'
    import { cert, getApps, initializeApp } from 'firebase-admin/app'
    import { getFirestore } from 'firebase-admin/firestore'
    ${(renderTypedEnvReaderScriptLines()).join('\n')}
    import {
      buildPublicAppStatusDocument,
      publicAppStatusCollection,
      publicAppStatusDocumentId,
    } from './public-status'
    
    async function main() {
      const serverRoot = path.resolve(process.cwd(), '..')
      const env = loadLocalEnv(path.join(serverRoot, '.env.local'))
      const projectId = env.FIREBASE_PROJECT_ID?.trim() ?? ''
      const credentials = env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? ''
    
      if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID is required in server/.env.local.')
      }
    
      if (!credentials) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required in server/.env.local.')
      }
    
      const resolvedCredentials = path.isAbsolute(credentials)
        ? credentials
        : path.resolve(serverRoot, credentials)
      const serviceAccount = JSON.parse(readFileSync(resolvedCredentials, 'utf8'))
    
      if (getApps().length === 0) {
        initializeApp({
          credential: cert(serviceAccount),
          projectId,
        })
      }
    
      const document = buildPublicAppStatusDocument()
    
      await getFirestore()
        .collection(publicAppStatusCollection)
        .doc(publicAppStatusDocumentId)
        .set(document)
    
      process.stdout.write(\`\${JSON.stringify(document, null, 2)}\\n\`)
    }
    
    void main().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(\`\${message}\\n\`)
      process.exit(1)
    })
  `
}

function renderFirebaseEnsureFirestoreScript(tokens: TemplateTokens) {
  const packageManager = getPackageManagerAdapter(tokens.packageManager)
  const getCommand = packageManager.dlx(FIREBASE_TOOLS_CLI, [
    'firestore:databases:get',
    '(default)',
    '--project',
    '__FIREBASE_PROJECT_ID__',
    '--json',
  ])
  const createCommand = packageManager.dlx(FIREBASE_TOOLS_CLI, [
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

  return dedentWithTrailingNewline`
    import { spawnSync } from 'node:child_process'
    import { existsSync, readFileSync } from 'node:fs'
    import path from 'node:path'
    import process from 'node:process'
    import { fileURLToPath } from 'node:url'
    import { GoogleAuth } from 'google-auth-library'
    ${(renderProcessEnvLoaderScriptLines()).join('\n')}
    
    const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const envPath = path.join(serverRoot, '.env.local')
    const packageManagerCommand = process.platform === 'win32' ? '${getCommand.command}.cmd' : '${getCommand.command}'
    
    function runFirebaseCommand(args, env) {
      return spawnSync(packageManagerCommand, args, {
        cwd: serverRoot,
        env,
        encoding: 'utf8',
      })
    }
    
    async function enableFirestoreApi(projectId, credentialsPath) {
      const auth = new GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      })
      const client = await auth.getClient()
    
      await client.request({
        url: 'https://serviceusage.googleapis.com/v1/projects/' + projectId + '/services/firestore.googleapis.com:enable',
        method: 'POST',
      })
    }
    
    async function main() {
      loadLocalEnv(envPath)
    
      const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? ''
      const firebaseToken = process.env.FIREBASE_TOKEN?.trim() ?? ''
      const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ?? ''
      const databaseLocation = process.env.FIREBASE_FUNCTION_REGION?.trim() || 'asia-northeast3'
      const commandEnv = { ...process.env }
    
      if (!projectId) {
        console.error('[server] FIREBASE_PROJECT_ID is required. Set server/.env.local before running firestore:ensure.')
        process.exit(1)
      }
    
      const resolvedCredentials = credentials
        ? path.isAbsolute(credentials)
          ? credentials
          : path.resolve(serverRoot, credentials)
        : ''
    
      if (resolvedCredentials) {
        commandEnv.GOOGLE_APPLICATION_CREDENTIALS = resolvedCredentials
      }
    
      const baseAuthArgs = firebaseToken ? ['--token', firebaseToken, '--non-interactive'] : []
      const baseGetArgs = ${JSON.stringify(getCommand.args)}
      const baseCreateArgs = ${JSON.stringify(createCommand.args)}
      let getResult = runFirebaseCommand(
        [
          ...baseGetArgs.slice(0, ${projectPlaceholderIndex}),
          projectId,
          ...baseGetArgs.slice(${projectPlaceholderIndex + 1}),
          ...baseAuthArgs,
        ],
        commandEnv,
      )
    
      if (getResult.status === 0) {
        process.stdout.write(getResult.stdout)
        process.exit(0)
      }
    
      const disabledApiPattern = /Cloud Firestore API has not been used|it is disabled/i
      const getErrorText = String(getResult.stderr ?? '') + String(getResult.stdout ?? '') + ' '
    
      if (disabledApiPattern.test(getErrorText) && resolvedCredentials) {
        await enableFirestoreApi(projectId, resolvedCredentials)
    
        getResult = runFirebaseCommand(
          [
            ...baseGetArgs.slice(0, ${projectPlaceholderIndex}),
            projectId,
            ...baseGetArgs.slice(${projectPlaceholderIndex + 1}),
            ...baseAuthArgs,
          ],
          commandEnv,
        )
    
        if (getResult.status === 0) {
          process.stdout.write(getResult.stdout)
          process.exit(0)
        }
      }
    
      const createResult = runFirebaseCommand(
        [
          ...baseCreateArgs.slice(0, ${createProjectPlaceholderIndex}),
          projectId,
          ...baseCreateArgs.slice(${createProjectPlaceholderIndex + 1}, ${createRegionPlaceholderIndex}),
          databaseLocation,
          ...baseCreateArgs.slice(${createRegionPlaceholderIndex + 1}),
          ...baseAuthArgs,
        ],
        commandEnv,
      )
    
      if (createResult.status === 0) {
        process.stdout.write(createResult.stdout)
        process.exit(0)
      }
    
      process.stderr.write(getResult.stderr || getResult.stdout)
      process.stderr.write(createResult.stderr || createResult.stdout)
      process.exit(createResult.status ?? 1)
    }
    
    void main().catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(message + '\\n')
      process.exit(1)
    })
  `
}

function renderFirebaseServerPackageJson(tokens: TemplateTokens) {
  const scripts = createServerScriptRecord(
    createFirebaseServerScriptCatalog({
      packageManager: tokens.packageManager,
      firestoreRegion: FIREBASE_DEFAULT_FUNCTION_REGION,
    }),
  )

  return {
    name: 'server',
    private: true,
    dependencies: {
      'google-auth-library': '^10.6.1',
    },
    scripts,
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
  const serverRoot = path.join(targetRoot, 'server')
  const packageJson = await readJsonTemplate<ServerPackageJson>(
    path.join(templatesRoot, 'root', 'server.package.json'),
    tokens,
  )
  const scripts = createServerScriptRecord(createSupabaseServerScriptCatalog(tokens.packageManager))

  packageJson.scripts = {
    ...(packageJson.scripts ?? {}),
    ...scripts,
  }

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
    renderSupabaseFunctionsTypecheckScript(tokens),
    'utf8',
  )
  await writeFile(
    path.join(serverRoot, 'scripts', 'supabase-install-deno.mjs'),
    renderSupabaseInstallDenoScript(),
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
