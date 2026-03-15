import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { readGraniteConfigMetadata } from './patching/ast/index.js'
import { toDefaultDisplayName } from './layout.js'
import type { PackageManager } from './package-manager.js'
import { detectServerProvider, type ServerProvider } from './providers/index.js'
import { pathExists } from './templates/index.js'

type RootPackageJson = {
  packageManager?: string
}

export type WorkspaceInspection = {
  rootDir: string
  packageManager: PackageManager
  appName: string
  displayName: string
  hasServer: boolean
  hasBackoffice: boolean
  serverProvider: ServerProvider | null
}

function parsePackageManagerField(value: string | undefined): PackageManager {
  if (value?.startsWith('pnpm@')) {
    return 'pnpm'
  }

  if (value?.startsWith('yarn@')) {
    return 'yarn'
  }

  if (value?.startsWith('npm@')) {
    return 'npm'
  }

  if (value?.startsWith('bun@')) {
    return 'bun'
  }

  throw new Error(
    '지원하지 않는 package manager예요. root package.json의 `packageManager`를 확인해 주세요.',
  )
}

export async function inspectWorkspace(rootDir: string): Promise<WorkspaceInspection> {
  const resolvedRootDir = path.resolve(rootDir)
  const packageJsonPath = path.join(resolvedRootDir, 'package.json')
  const graniteConfigPath = path.join(resolvedRootDir, 'frontend', 'granite.config.ts')

  if (!(await pathExists(packageJsonPath))) {
    throw new Error(`root package.json을 찾지 못했어요: ${resolvedRootDir}`)
  }

  if (!(await pathExists(graniteConfigPath))) {
    throw new Error(`frontend/granite.config.ts를 찾지 못했어요: ${resolvedRootDir}`)
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as RootPackageJson
  const packageManager = parsePackageManagerField(packageJson.packageManager)

  const graniteConfigSource = await readFile(graniteConfigPath, 'utf8')
  const metadata = readGraniteConfigMetadata(graniteConfigSource)

  if (!metadata.appName) {
    throw new Error('frontend/granite.config.ts에서 appName을 읽지 못했어요.')
  }

  const hasServer = await pathExists(path.join(resolvedRootDir, 'server'))
  const hasBackoffice = await pathExists(path.join(resolvedRootDir, 'backoffice'))
  const serverProvider = hasServer ? await detectServerProvider(resolvedRootDir) : null

  return {
    rootDir: resolvedRootDir,
    packageManager,
    appName: metadata.appName,
    displayName: metadata.displayName ?? toDefaultDisplayName(metadata.appName),
    hasServer,
    hasBackoffice,
    serverProvider,
  }
}
