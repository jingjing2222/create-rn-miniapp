import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { readGraniteConfigMetadata } from './ast.js'
import { toDefaultDisplayName } from './layout.js'
import type { PackageManager } from './package-manager.js'
import type { ServerProvider } from './server-provider.js'
import { pathExists } from './templates.js'

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

  throw new Error(
    '지원하지 않는 package manager입니다. root package.json의 `packageManager`를 확인하세요.',
  )
}

export async function inspectWorkspace(rootDir: string): Promise<WorkspaceInspection> {
  const resolvedRootDir = path.resolve(rootDir)
  const packageJsonPath = path.join(resolvedRootDir, 'package.json')
  const graniteConfigPath = path.join(resolvedRootDir, 'frontend', 'granite.config.ts')

  if (!(await pathExists(packageJsonPath))) {
    throw new Error(`root package.json을 찾지 못했습니다: ${resolvedRootDir}`)
  }

  if (!(await pathExists(graniteConfigPath))) {
    throw new Error(`frontend/granite.config.ts를 찾지 못했습니다: ${resolvedRootDir}`)
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as RootPackageJson
  const packageManager = parsePackageManagerField(packageJson.packageManager)

  const graniteConfigSource = await readFile(graniteConfigPath, 'utf8')
  const metadata = readGraniteConfigMetadata(graniteConfigSource)

  if (!metadata.appName) {
    throw new Error('frontend/granite.config.ts에서 appName을 읽지 못했습니다.')
  }

  const hasServer = await pathExists(path.join(resolvedRootDir, 'server'))
  const hasBackoffice = await pathExists(path.join(resolvedRootDir, 'backoffice'))

  return {
    rootDir: resolvedRootDir,
    packageManager,
    appName: metadata.appName,
    displayName: metadata.displayName ?? toDefaultDisplayName(metadata.appName),
    hasServer,
    hasBackoffice,
    serverProvider: hasServer ? 'supabase' : null,
  }
}
