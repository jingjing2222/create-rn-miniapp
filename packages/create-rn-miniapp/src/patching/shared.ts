import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import type { ServerProvider } from '../providers/index.js'
import { pathExists, removePathIfExists } from '../templates/filesystem.js'
import { getFirebaseWebSdkVersion } from '../templates/server.js'
import type { TemplateTokens } from '../templates/types.js'
import {
  APP_ROUTER_WORKSPACE_PATH,
  resolveWorkspaceRelativeTrpcPath,
} from '../trpc-workspace-metadata.js'
import {
  patchBackofficeAppSource,
  patchBackofficeMainSource,
  patchGraniteConfigSource,
  renderGranitePresetSource,
} from './ast/index.js'
import { patchTsconfigModuleSource } from './jsonc.js'
import { patchPackageJsonSource } from './package-json.js'

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

export const SUPABASE_JS_VERSION = '^2.57.4'
export const FIREBASE_JS_VERSION = getFirebaseWebSdkVersion()
export const DOTENV_VERSION = '^16.4.7'
export const NODE_TYPES_VERSION = '^24.10.1'
const FALLBACK_GRANITE_PLUGIN_VERSION = '1.0.7'

export type PackageJson = {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export type WorkspacePatchOptions = {
  packageManager: PackageManager
  serverProvider: ServerProvider | null
  trpc?: boolean
  removeCloudflareApiClientHelpers?: boolean
}

export type ReactVersionAlignment = {
  react: string | null
  reactDom: string | null
  reactTypes: string | null
  reactDomTypes: string | null
}

export function toolingDependencyNames() {
  return [...TOOLING_DEPENDENCIES]
}

export async function readPackageJson(packageJsonPath: string) {
  return JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson
}

export async function writeTextFile(filePath: string, contents: string) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, 'utf8')
}

export function resolvePackageVersion(packageJson: PackageJson, packageName: string) {
  return (
    packageJson.dependencies?.[packageName] ?? packageJson.devDependencies?.[packageName] ?? null
  )
}

function stripSimpleVersionPrefix(version: string) {
  return version.replace(/^[~^]/, '')
}

export function applyExistingVersionPrefix(currentVersion: string, targetVersion: string) {
  const prefix = currentVersion.match(/^[~^]/)?.[0] ?? ''
  return `${prefix}${stripSimpleVersionPrefix(targetVersion)}`
}

export async function resolveFrontendReactVersionAlignment(targetRoot: string) {
  const frontendPackageJsonPath = path.join(targetRoot, 'frontend', 'package.json')

  if (!(await pathExists(frontendPackageJsonPath))) {
    return null
  }

  const frontendPackageJson = await readPackageJson(frontendPackageJsonPath)
  const reactVersion = resolvePackageVersion(frontendPackageJson, 'react')

  if (!reactVersion) {
    return null
  }

  return {
    react: reactVersion,
    reactDom: resolvePackageVersion(frontendPackageJson, 'react-dom') ?? reactVersion,
    reactTypes: resolvePackageVersion(frontendPackageJson, '@types/react'),
    reactDomTypes: resolvePackageVersion(frontendPackageJson, '@types/react-dom'),
  } satisfies ReactVersionAlignment
}

async function patchTsconfigModuleFile(
  filePath: string,
  options?: {
    includeNodeTypes?: boolean
    allowImportingTsExtensions?: boolean
  },
) {
  if (!(await pathExists(filePath))) {
    return
  }

  const source = await readFile(filePath, 'utf8')
  const next = patchTsconfigModuleSource(source, options)
  await writeFile(filePath, next, 'utf8')
}

export function stripToolingFromPackageJson(packageJson: PackageJson) {
  for (const scriptName of ['lint', 'lint:fix', 'format', 'format:check']) {
    delete packageJson.scripts?.[scriptName]
  }

  for (const dependencyName of TOOLING_DEPENDENCIES) {
    delete packageJson.dependencies?.[dependencyName]
    delete packageJson.devDependencies?.[dependencyName]
  }

  return packageJson
}

export async function patchPackageJsonFile(
  packageJsonPath: string,
  patch: Parameters<typeof patchPackageJsonSource>[1],
) {
  const source = await readFile(packageJsonPath, 'utf8')
  const next = patchPackageJsonSource(source, patch)
  await writeFile(packageJsonPath, next, 'utf8')
}

export function resolveGranitePluginVersion(packageJson: PackageJson) {
  return (
    packageJson.devDependencies?.['@granite-js/plugin-hermes'] ??
    packageJson.devDependencies?.['@granite-js/plugin-router'] ??
    packageJson.dependencies?.['@granite-js/react-native'] ??
    FALLBACK_GRANITE_PLUGIN_VERSION
  )
}

export async function removeToolingFiles(workspaceRoot: string, packageManager: PackageManager) {
  const adapter = getPackageManagerAdapter(packageManager)
  await Promise.all(
    [...STATIC_TOOLING_FILES, ...adapter.toolingFiles].map((fileName) =>
      removePathIfExists(path.join(workspaceRoot, fileName)),
    ),
  )
}

export async function removeWorkspaceArtifacts(
  workspaceRoot: string,
  packageManager: PackageManager,
) {
  const adapter = getPackageManagerAdapter(packageManager)
  await Promise.all(
    adapter.workspaceArtifacts.map((fileName) =>
      removePathIfExists(path.join(workspaceRoot, fileName)),
    ),
  )
}

export async function patchGraniteConfig(
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

export async function writeFrontendGranitePreset(
  frontendRoot: string,
  serverProvider: ServerProvider | null,
) {
  await writeTextFile(
    path.join(frontendRoot, 'scaffold.preset.ts'),
    renderGranitePresetSource(serverProvider),
  )
}

export async function patchWorkspaceTsconfigModules(
  workspaceRoot: string,
  filePatches: Array<{
    fileName: string
    includeNodeTypes?: boolean
    allowImportingTsExtensions?: boolean
  }>,
) {
  await Promise.all(
    filePatches.map(({ fileName, includeNodeTypes, allowImportingTsExtensions }) =>
      patchTsconfigModuleFile(path.join(workspaceRoot, fileName), {
        includeNodeTypes,
        allowImportingTsExtensions,
      }),
    ),
  )
}

export async function patchBackofficeEntryFiles(backofficeRoot: string) {
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

export function normalizeVitestTestScript(script: string) {
  if (script === 'vitest') {
    return 'vitest run'
  }

  return script
}

function renderTrpcWorkspaceBuildCommand(packageManager: PackageManager) {
  return getPackageManagerAdapter(packageManager).runScriptInDirectoryCommand(
    resolveWorkspaceRelativeTrpcPath(APP_ROUTER_WORKSPACE_PATH),
    'build',
  )
}

export function prefixTrpcWorkspaceBuild(command: string, packageManager: PackageManager) {
  return `${renderTrpcWorkspaceBuildCommand(packageManager)} && ${command}`
}
