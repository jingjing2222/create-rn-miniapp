import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  patchBackofficeAppSource,
  patchBackofficeMainSource,
  patchGraniteConfigSource,
  patchTsconfigModuleSource,
} from './ast.js'
import { getPackageManagerAdapter, type PackageManager } from './package-manager.js'
import type { ServerProvider } from './server-provider.js'
import {
  type TemplateTokens,
  applyServerPackageTemplate,
  applyWorkspaceProjectTemplate,
  pathExists,
  removePathIfExists,
} from './templates.js'

const STATIC_TOOLING_FILES = [
  'biome.json',
  '.biome.json',
  'eslint.config.js',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.json',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
] as const

const TOOLING_DEPENDENCIES = [
  '@biomejs/biome',
  '@eslint/js',
  'eslint',
  'eslint-config-prettier',
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'eslint-plugin-react-refresh',
  'typescript-eslint',
  'prettier',
] as const

const SUPABASE_JS_VERSION = '^2.57.4'
const DOTENV_VERSION = '^16.4.7'
const FALLBACK_GRANITE_PLUGIN_VERSION = '1.0.7'

const FRONTEND_SUPABASE_ENV_EXAMPLE = [
  'MINIAPP_SUPABASE_URL=https://your-project.supabase.co',
  'MINIAPP_SUPABASE_PUBLISHABLE_KEY=your-publishable-key',
  '',
].join('\n')

const BACKOFFICE_SUPABASE_ENV_EXAMPLE = [
  'VITE_SUPABASE_URL=https://your-project.supabase.co',
  'VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key',
  '',
].join('\n')

const FRONTEND_ENV_TYPES = [
  'interface ImportMetaEnv {',
  '  readonly MINIAPP_SUPABASE_URL: string',
  '  readonly MINIAPP_SUPABASE_PUBLISHABLE_KEY: string',
  '}',
  '',
  'interface ImportMeta {',
  '  readonly env: ImportMetaEnv',
  '}',
  '',
].join('\n')

const BACKOFFICE_ENV_TYPES = [
  '/// <reference types="vite/client" />',
  '',
  'interface ImportMetaEnv {',
  '  readonly VITE_SUPABASE_URL: string',
  '  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string',
  '}',
  '',
  'interface ImportMeta {',
  '  readonly env: ImportMetaEnv',
  '}',
  '',
].join('\n')

const FRONTEND_SUPABASE_CLIENT = [
  "import { createClient, type SupabaseClient } from '@supabase/supabase-js'",
  '',
  'function isSafeHttpUrl(value: string) {',
  '  try {',
  '    const parsed = new URL(value)',
  "    return parsed.protocol === 'http:' || parsed.protocol === 'https:'",
  '  } catch {',
  '    return false',
  '  }',
  '}',
  '',
  'function resolveSupabaseUrl() {',
  '  const configured =',
  "    import.meta.env.MINIAPP_SUPABASE_URL?.trim() ?? process.env.MINIAPP_SUPABASE_URL?.trim() ?? ''",
  '',
  '  if (!isSafeHttpUrl(configured)) {',
  '    throw new Error(',
  "      `[frontend] MINIAPP_SUPABASE_URL must be a valid http(s) URL. Received: ${configured || '<empty>'}`",
  '    )',
  '  }',
  '',
  '  return configured',
  '}',
  '',
  'function resolveSupabasePublishableKey() {',
  '  const configured =',
  '    import.meta.env.MINIAPP_SUPABASE_PUBLISHABLE_KEY?.trim() ??',
  '    process.env.MINIAPP_SUPABASE_PUBLISHABLE_KEY?.trim() ??',
  "    ''",
  '',
  '  if (!configured) {',
  "    throw new Error('[frontend] MINIAPP_SUPABASE_PUBLISHABLE_KEY is required.')",
  '  }',
  '',
  '  return configured',
  '}',
  '',
  'export const supabase: SupabaseClient = createClient(',
  '  resolveSupabaseUrl(),',
  '  resolveSupabasePublishableKey(),',
  '  {',
  '    auth: {',
  '      persistSession: false,',
  '      detectSessionInUrl: false,',
  '    },',
  '  },',
  ')',
  '',
].join('\n')

const BACKOFFICE_SUPABASE_CLIENT = [
  "import { createClient, type SupabaseClient } from '@supabase/supabase-js'",
  '',
  'function resolveSupabaseUrl() {',
  "  const value = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''",
  '',
  '  if (!value) {',
  "    throw new Error('[backoffice] VITE_SUPABASE_URL is required.')",
  '  }',
  '',
  '  return value',
  '}',
  '',
  'function resolveSupabasePublishableKey() {',
  "  const value = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''",
  '',
  '  if (!value) {',
  "    throw new Error('[backoffice] VITE_SUPABASE_PUBLISHABLE_KEY is required.')",
  '  }',
  '',
  '  return value',
  '}',
  '',
  'function isSafeHttpUrl(value: string) {',
  '  try {',
  '    const parsed = new URL(value)',
  "    return parsed.protocol === 'http:' || parsed.protocol === 'https:'",
  '  } catch {',
  '    return false',
  '  }',
  '}',
  '',
  'const supabaseUrl = resolveSupabaseUrl()',
  'if (!isSafeHttpUrl(supabaseUrl)) {',
  '  throw new Error(',
  '    `[backoffice] VITE_SUPABASE_URL must be a valid http(s) URL. Received: ${supabaseUrl}`',
  '  )',
  '}',
  '',
  'export const supabase: SupabaseClient = createClient(',
  '  supabaseUrl,',
  '  resolveSupabasePublishableKey(),',
  '  {',
  '    auth: {',
  '      persistSession: true,',
  '      autoRefreshToken: true,',
  '      detectSessionInUrl: false,',
  '    },',
  '  },',
  ')',
  '',
].join('\n')

type PackageJson = {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

type WorkspacePatchOptions = {
  packageManager: PackageManager
  serverProvider: ServerProvider | null
}

async function readPackageJson(packageJsonPath: string) {
  return JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson
}

async function writePackageJson(packageJsonPath: string, packageJson: PackageJson) {
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
}

async function writeTextFile(filePath: string, contents: string) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, 'utf8')
}

async function patchTsconfigModuleFile(filePath: string) {
  if (!(await pathExists(filePath))) {
    return
  }

  const source = await readFile(filePath, 'utf8')
  const next = patchTsconfigModuleSource(source)
  await writeFile(filePath, next, 'utf8')
}

function stripToolingFromPackageJson(packageJson: PackageJson) {
  for (const scriptName of ['lint', 'lint:fix', 'format', 'format:check']) {
    delete packageJson.scripts?.[scriptName]
  }

  for (const dependencyName of TOOLING_DEPENDENCIES) {
    delete packageJson.dependencies?.[dependencyName]
    delete packageJson.devDependencies?.[dependencyName]
  }

  return packageJson
}

function ensureDependency(
  packageJson: PackageJson,
  dependencyName: string,
  version: string,
  section: 'dependencies' | 'devDependencies',
) {
  packageJson[section] ??= {}
  const target = packageJson[section]
  target[dependencyName] ??= version
}

function resolveGranitePluginVersion(packageJson: PackageJson) {
  return (
    packageJson.devDependencies?.['@granite-js/plugin-hermes'] ??
    packageJson.devDependencies?.['@granite-js/plugin-router'] ??
    packageJson.dependencies?.['@granite-js/react-native'] ??
    FALLBACK_GRANITE_PLUGIN_VERSION
  )
}

async function removeToolingFiles(workspaceRoot: string, packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)
  await Promise.all(
    [...STATIC_TOOLING_FILES, ...adapter.toolingFiles].map((fileName) =>
      removePathIfExists(path.join(workspaceRoot, fileName)),
    ),
  )
}

async function removeWorkspaceArtifacts(workspaceRoot: string, packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)
  await Promise.all(
    adapter.workspaceArtifacts.map((fileName) =>
      removePathIfExists(path.join(workspaceRoot, fileName)),
    ),
  )
}

async function patchGraniteConfig(
  frontendRoot: string,
  tokens: TemplateTokens,
  serverProvider: ServerProvider | null,
) {
  const graniteConfigPath = path.join(frontendRoot, 'granite.config.ts')

  if (!(await pathExists(graniteConfigPath))) {
    return
  }

  const source = await readFile(graniteConfigPath, 'utf8')
  const next = patchGraniteConfigSource(source, tokens, serverProvider)

  await writeFile(graniteConfigPath, next, 'utf8')
}

async function patchWorkspaceTsconfigModules(workspaceRoot: string, fileNames: string[]) {
  await Promise.all(
    fileNames.map((fileName) => patchTsconfigModuleFile(path.join(workspaceRoot, fileName))),
  )
}

async function writeFrontendSupabaseBootstrap(frontendRoot: string) {
  await writeTextFile(path.join(frontendRoot, '.env.local.example'), FRONTEND_SUPABASE_ENV_EXAMPLE)
  await writeTextFile(path.join(frontendRoot, 'src', 'env.d.ts'), FRONTEND_ENV_TYPES)
  await writeTextFile(
    path.join(frontendRoot, 'src', 'lib', 'supabase.ts'),
    FRONTEND_SUPABASE_CLIENT,
  )
}

async function writeBackofficeSupabaseBootstrap(backofficeRoot: string) {
  await writeTextFile(
    path.join(backofficeRoot, '.env.local.example'),
    BACKOFFICE_SUPABASE_ENV_EXAMPLE,
  )
  await writeTextFile(path.join(backofficeRoot, 'src', 'vite-env.d.ts'), BACKOFFICE_ENV_TYPES)
  await writeTextFile(
    path.join(backofficeRoot, 'src', 'lib', 'supabase.ts'),
    BACKOFFICE_SUPABASE_CLIENT,
  )
}

async function patchBackofficeEntryFiles(backofficeRoot: string) {
  const mainPath = path.join(backofficeRoot, 'src', 'main.tsx')
  const appPath = path.join(backofficeRoot, 'src', 'App.tsx')

  if (await pathExists(mainPath)) {
    const source = await readFile(mainPath, 'utf8')
    const next = patchBackofficeMainSource(source)

    await writeFile(mainPath, next, 'utf8')
  }

  if (await pathExists(appPath)) {
    const source = await readFile(appPath, 'utf8')
    const next = patchBackofficeAppSource(source)
    await writeFile(appPath, next, 'utf8')
  }
}

export async function patchFrontendWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: WorkspacePatchOptions,
) {
  const frontendRoot = path.join(targetRoot, 'frontend')
  const packageJsonPath = path.join(frontendRoot, 'package.json')
  const packageJson = stripToolingFromPackageJson(await readPackageJson(packageJsonPath))

  packageJson.name = 'frontend'
  packageJson.scripts ??= {}
  packageJson.scripts.typecheck ??= 'tsc --noEmit'
  packageJson.scripts.test ??= `node -e "console.log('frontend test placeholder')"`

  if (options.serverProvider === 'supabase') {
    ensureDependency(packageJson, '@supabase/supabase-js', SUPABASE_JS_VERSION, 'dependencies')
    ensureDependency(
      packageJson,
      '@granite-js/plugin-env',
      resolveGranitePluginVersion(packageJson),
      'devDependencies',
    )
    ensureDependency(packageJson, 'dotenv', DOTENV_VERSION, 'devDependencies')
  }

  await writePackageJson(packageJsonPath, packageJson)
  await removeToolingFiles(frontendRoot, options.packageManager)
  await removeWorkspaceArtifacts(frontendRoot, options.packageManager)
  await patchGraniteConfig(frontendRoot, tokens, options.serverProvider)
  await patchWorkspaceTsconfigModules(frontendRoot, ['tsconfig.json'])

  if (options.serverProvider === 'supabase') {
    await writeFrontendSupabaseBootstrap(frontendRoot)
  }

  await applyWorkspaceProjectTemplate(targetRoot, 'frontend', tokens)
}

export async function patchBackofficeWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: WorkspacePatchOptions,
) {
  const backofficeRoot = path.join(targetRoot, 'backoffice')
  const packageJsonPath = path.join(backofficeRoot, 'package.json')
  const packageJson = stripToolingFromPackageJson(await readPackageJson(packageJsonPath))

  packageJson.name = 'backoffice'
  packageJson.scripts ??= {}
  packageJson.scripts.typecheck = 'tsc -b --pretty false'
  packageJson.scripts.test ??= `node -e "console.log('backoffice test placeholder')"`

  if (options.serverProvider === 'supabase') {
    ensureDependency(packageJson, '@supabase/supabase-js', SUPABASE_JS_VERSION, 'dependencies')
  }

  await writePackageJson(packageJsonPath, packageJson)
  await patchWorkspaceTsconfigModules(backofficeRoot, [
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
  ])
  await patchBackofficeEntryFiles(backofficeRoot)
  await removeToolingFiles(backofficeRoot, options.packageManager)
  await removeWorkspaceArtifacts(backofficeRoot, options.packageManager)

  if (options.serverProvider === 'supabase') {
    await writeBackofficeSupabaseBootstrap(backofficeRoot)
  }

  await applyWorkspaceProjectTemplate(targetRoot, 'backoffice', tokens)
}

export async function patchServerWorkspace(
  targetRoot: string,
  tokens: TemplateTokens,
  options: Pick<WorkspacePatchOptions, 'packageManager'>,
) {
  await applyServerPackageTemplate(targetRoot, tokens)
  await removeToolingFiles(path.join(targetRoot, 'server'), options.packageManager)
  await removeWorkspaceArtifacts(path.join(targetRoot, 'server'), options.packageManager)
  await applyWorkspaceProjectTemplate(targetRoot, 'server', tokens)
}

export function createRootPackageName(appName: string) {
  return `${appName}-workspace`
}
