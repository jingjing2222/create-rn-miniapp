import path from 'node:path'
import type { ServerProvider } from '../providers/index.js'
import { removePathIfExists, writeWorkspaceNpmrc } from '../templates/filesystem.js'
import { applyWorkspaceProjectTemplate } from '../templates/server.js'
import type { TemplateTokens } from '../templates/types.js'
import {
  APP_ROUTER_WORKSPACE_DEPENDENCY,
  renderCloudflareTrpcClientSource,
  TRPC_CLIENT_VERSION,
} from './trpc.js'
import {
  applyExistingVersionPrefix,
  FIREBASE_JS_VERSION,
  patchBackofficeEntryFiles,
  patchPackageJsonFile,
  patchWorkspaceTsconfigModules,
  prefixTrpcWorkspaceBuild,
  readPackageJson,
  removeToolingFiles,
  removeWorkspaceArtifacts,
  resolveFrontendReactVersionAlignment,
  stripToolingFromPackageJson,
  SUPABASE_JS_VERSION,
  toolingDependencyNames,
  type PackageJson,
  type ReactVersionAlignment,
  type WorkspacePatchOptions,
  writeTextFile,
} from './shared.js'
import { dedentWithTrailingNewline } from '../dedent.js'

const BACKOFFICE_ENV_TYPES = dedentWithTrailingNewline`
  /// <reference types="vite/client" />

  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
`

const BACKOFFICE_CLOUDFLARE_ENV_TYPES = dedentWithTrailingNewline`
  /// <reference types="vite/client" />

  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
`

const BACKOFFICE_FIREBASE_ENV_TYPES = dedentWithTrailingNewline`
  /// <reference types="vite/client" />

  interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY: string
    readonly VITE_FIREBASE_AUTH_DOMAIN: string
    readonly VITE_FIREBASE_PROJECT_ID: string
    readonly VITE_FIREBASE_STORAGE_BUCKET: string
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
    readonly VITE_FIREBASE_APP_ID: string
    readonly VITE_FIREBASE_MEASUREMENT_ID: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
`

const BACKOFFICE_SUPABASE_CLIENT = dedentWithTrailingNewline`
  import { createClient, type SupabaseClient } from '@supabase/supabase-js'

  function resolveSupabaseUrl() {
    const value = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''

    if (!value) {
      throw new Error('[backoffice] VITE_SUPABASE_URL is required.')
    }

    return value
  }

  function resolveSupabasePublishableKey() {
    const value = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

    if (!value) {
      throw new Error('[backoffice] VITE_SUPABASE_PUBLISHABLE_KEY is required.')
    }

    return value
  }

  function isSafeHttpUrl(value: string) {
    try {
      const parsed = new URL(value)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  const supabaseUrl = resolveSupabaseUrl()
  if (!isSafeHttpUrl(supabaseUrl)) {
    throw new Error(
      '[backoffice] VITE_SUPABASE_URL must be a valid http(s) URL. Received: ' + supabaseUrl
    )
  }

  export const supabase: SupabaseClient = createClient(
    supabaseUrl,
    resolveSupabasePublishableKey(),
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  )
`

const BACKOFFICE_CLOUDFLARE_API_CLIENT = dedentWithTrailingNewline`
  function isSafeHttpUrl(value: string) {
    try {
      const parsed = new URL(value)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  function resolveApiBaseUrl() {
    const configured = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''

    if (!isSafeHttpUrl(configured)) {
      throw new Error(
        '[backoffice] VITE_API_BASE_URL must be a valid http(s) URL. Received: ' + (configured || '<empty>')
      )
    }

    return configured.replace(/\\/$/, '')
  }

  export const apiBaseUrl = resolveApiBaseUrl()

  export function resolveApiUrl(pathname: string) {
    const normalizedPath = pathname.replace(/^\\//, '')
    return new URL(normalizedPath, apiBaseUrl + '/').toString()
  }

  export async function apiFetch(pathname: string, init?: RequestInit) {
    return fetch(resolveApiUrl(pathname), init)
  }
`

const BACKOFFICE_FIREBASE_APP = dedentWithTrailingNewline`
  import { getApp, getApps, initializeApp } from 'firebase/app'

  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim()

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    ...(measurementId ? { measurementId } : {}),
  }

  export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
`

const BACKOFFICE_FIREBASE_FIRESTORE = dedentWithTrailingNewline`
  import { getFirestore } from 'firebase/firestore'
  import { firebaseApp } from './firebase'

  export const firestore = getFirestore(firebaseApp)
`

const BACKOFFICE_FIREBASE_STORAGE = dedentWithTrailingNewline`
  import { getStorage } from 'firebase/storage'
  import { firebaseApp } from './firebase'

  export const storage = getStorage(firebaseApp)
`

async function writeBackofficeSupabaseBootstrap(backofficeRoot: string) {
  await writeTextFile(path.join(backofficeRoot, 'src', 'vite-env.d.ts'), BACKOFFICE_ENV_TYPES)
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'supabase.ts'),
    BACKOFFICE_SUPABASE_CLIENT,
  )
}

async function writeBackofficeCloudflareBootstrap(backofficeRoot: string) {
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'vite-env.d.ts'),
    BACKOFFICE_CLOUDFLARE_ENV_TYPES,
  )
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'api.ts'),
    BACKOFFICE_CLOUDFLARE_API_CLIENT,
  )
}

async function writeBackofficeCloudflareTrpcBootstrap(backofficeRoot: string) {
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'trpc.ts'),
    renderCloudflareTrpcClientSource({
      urlExpression: 'import.meta.env.VITE_API_BASE_URL',
    }),
  )
}

async function writeBackofficeFirebaseBootstrap(backofficeRoot: string) {
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'vite-env.d.ts'),
    BACKOFFICE_FIREBASE_ENV_TYPES,
  )
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'firebase.ts'),
    BACKOFFICE_FIREBASE_APP,
  )
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'firestore.ts'),
    BACKOFFICE_FIREBASE_FIRESTORE,
  )
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'storage.ts'),
    BACKOFFICE_FIREBASE_STORAGE,
  )
}

async function ensureBackofficePackageJsonForWorkspace(
  backofficeRoot: string,
  packageJson: PackageJson,
  packageManager: TemplateTokens['packageManager'],
  serverProvider: ServerProvider | null,
  trpc = false,
  reactVersionAlignment: ReactVersionAlignment | null = null,
) {
  const scripts: Record<string, string> = {
    typecheck: 'tsc -b --pretty false',
  }
  const dependencies: Record<string, string> = {}
  const devDependencies: Record<string, string> = {}

  if (!packageJson.scripts?.test) {
    scripts.test = `node -e "console.log('backoffice test placeholder')"`
  } else if (packageJson.scripts.test === 'vitest') {
    scripts.test = 'vitest run'
  }

  if (serverProvider === 'supabase') {
    if (!packageJson.dependencies?.['@supabase/supabase-js']) {
      dependencies['@supabase/supabase-js'] = SUPABASE_JS_VERSION
    }
  }

  if (serverProvider === 'firebase' && !packageJson.dependencies?.firebase) {
    dependencies.firebase = FIREBASE_JS_VERSION
  }

  if (
    reactVersionAlignment?.react &&
    packageJson.dependencies?.react &&
    packageJson.dependencies.react !== reactVersionAlignment.react
  ) {
    dependencies.react = reactVersionAlignment.react
  }

  if (
    reactVersionAlignment?.reactDom &&
    packageJson.dependencies?.['react-dom'] &&
    packageJson.dependencies['react-dom'] !== reactVersionAlignment.reactDom
  ) {
    dependencies['react-dom'] = reactVersionAlignment.reactDom
  }

  if (
    reactVersionAlignment?.reactTypes &&
    packageJson.devDependencies?.['@types/react'] &&
    packageJson.devDependencies['@types/react'] !== reactVersionAlignment.reactTypes
  ) {
    devDependencies['@types/react'] = reactVersionAlignment.reactTypes
  }

  const alignedReactDomTypesVersion =
    reactVersionAlignment?.reactDomTypes ??
    (reactVersionAlignment?.react && packageJson.devDependencies?.['@types/react-dom']
      ? applyExistingVersionPrefix(
          packageJson.devDependencies['@types/react-dom'],
          reactVersionAlignment.react,
        )
      : null)

  if (
    alignedReactDomTypesVersion &&
    packageJson.devDependencies?.['@types/react-dom'] &&
    packageJson.devDependencies['@types/react-dom'] !== alignedReactDomTypesVersion
  ) {
    devDependencies['@types/react-dom'] = alignedReactDomTypesVersion
  }

  if (trpc && serverProvider === 'cloudflare') {
    if (!packageJson.dependencies?.['@trpc/client']) {
      dependencies['@trpc/client'] = TRPC_CLIENT_VERSION
    }

    if (!packageJson.devDependencies?.['@workspace/app-router']) {
      devDependencies['@workspace/app-router'] = APP_ROUTER_WORKSPACE_DEPENDENCY
    }

    scripts.typecheck = prefixTrpcWorkspaceBuild(scripts.typecheck, packageManager)
  }

  await patchPackageJsonFile(path.join(backofficeRoot, 'package.json'), {
    upsertTopLevel: [
      {
        key: 'name',
        value: packageJson.name,
      },
    ],
    upsertSections: {
      scripts,
      dependencies,
      devDependencies,
    },
  })
}

export async function ensureBackofficeSupabaseBootstrap(
  targetRoot: string,
  tokens: TemplateTokens,
) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)

  await ensureBackofficePackageJsonForWorkspace(
    backofficeRoot,
    packageJson,
    tokens.packageManager,
    'supabase',
  )
  await patchWorkspaceTsconfigModules(backofficeRoot, [
    { fileName: 'tsconfig.json' },
    { fileName: 'tsconfig.app.json' },
    { fileName: 'tsconfig.node.json' },
  ])
  await patchBackofficeEntryFiles(backofficeRoot)
  await writeBackofficeSupabaseBootstrap(backofficeRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}

export async function ensureBackofficeCloudflareBootstrap(
  targetRoot: string,
  tokens: TemplateTokens,
) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)

  await ensureBackofficePackageJsonForWorkspace(
    backofficeRoot,
    packageJson,
    tokens.packageManager,
    'cloudflare',
  )
  await patchWorkspaceTsconfigModules(backofficeRoot, [
    { fileName: 'tsconfig.json' },
    { fileName: 'tsconfig.app.json' },
    { fileName: 'tsconfig.node.json' },
  ])
  await patchBackofficeEntryFiles(backofficeRoot)
  await writeBackofficeCloudflareBootstrap(backofficeRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}

export async function ensureBackofficeFirebaseBootstrap(
  targetRoot: string,
  tokens: TemplateTokens,
) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = await readPackageJson(packageJsonPath)

  await ensureBackofficePackageJsonForWorkspace(
    backofficeRoot,
    packageJson,
    tokens.packageManager,
    'firebase',
  )
  await patchWorkspaceTsconfigModules(backofficeRoot, [
    { fileName: 'tsconfig.json' },
    { fileName: 'tsconfig.app.json' },
    { fileName: 'tsconfig.node.json' },
  ])
  await patchBackofficeEntryFiles(backofficeRoot)
  await writeBackofficeFirebaseBootstrap(backofficeRoot)
  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}

export async function patchBackofficeWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: WorkspacePatchOptions,
) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = stripToolingFromPackageJson(await readPackageJson(packageJsonPath))
  const reactVersionAlignment = await resolveFrontendReactVersionAlignment(targetRoot)

  packageJson.name = 'backoffice'
  await patchPackageJsonFile(packageJsonPath, {
    upsertTopLevel: [
      {
        key: 'name',
        value: packageJson.name,
      },
    ],
    removeFromSections: {
      scripts: ['lint', 'lint:fix', 'format', 'format:check'],
      dependencies: toolingDependencyNames(),
      devDependencies: toolingDependencyNames(),
    },
  })
  await ensureBackofficePackageJsonForWorkspace(
    backofficeRoot,
    packageJson,
    options.packageManager,
    options.serverProvider,
    options.trpc,
    reactVersionAlignment,
  )
  await patchWorkspaceTsconfigModules(backofficeRoot, [
    { fileName: 'tsconfig.json' },
    { fileName: 'tsconfig.app.json' },
    { fileName: 'tsconfig.node.json' },
  ])
  await patchBackofficeEntryFiles(backofficeRoot)
  if (options.packageManager === 'npm') {
    await writeWorkspaceNpmrc(backofficeRoot)
  }
  await removeToolingFiles(backofficeRoot, options.packageManager)
  await removeWorkspaceArtifacts(backofficeRoot, options.packageManager)

  if (options.serverProvider === 'supabase') {
    await writeBackofficeSupabaseBootstrap(backofficeRoot)
  }

  if (options.serverProvider === 'cloudflare') {
    await writeTextFile(
      path.join(backofficeRoot, 'src', 'vite-env.d.ts'),
      BACKOFFICE_CLOUDFLARE_ENV_TYPES,
    )
    if (options.trpc) {
      await writeBackofficeCloudflareTrpcBootstrap(backofficeRoot)
      if (options.removeCloudflareApiClientHelpers) {
        await removePathIfExists(path.join(backofficeRoot, 'src', 'lib', 'api.ts'))
      }
    } else {
      await writeTextFile(
        path.join(backofficeRoot, 'src', 'lib', 'api.ts'),
        BACKOFFICE_CLOUDFLARE_API_CLIENT,
      )
    }
  }

  if (options.serverProvider === 'firebase') {
    await writeBackofficeFirebaseBootstrap(backofficeRoot)
  }

  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}
