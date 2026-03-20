import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { toDefaultDisplayName } from './layout.js'
import type { PackageManager } from './package-manager.js'
import { readGraniteConfigMetadata } from './patching/ast/index.js'
import { detectServerProvider, type ServerProvider } from './providers/index.js'
import { MAIN_WORKTREE_DIRECTORY } from './scaffold/worktree.js'
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
  hasTrpc: boolean
  hasWorktreePolicy: boolean
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

async function hasWorkspaceMarkers(rootDir: string) {
  return (
    (await pathExists(path.join(rootDir, 'package.json'))) &&
    (await pathExists(path.join(rootDir, 'frontend', 'granite.config.ts')))
  )
}

export async function resolveWorkspaceRoot(rootDir: string) {
  const resolvedRootDir = path.resolve(rootDir)

  if (await hasWorkspaceMarkers(resolvedRootDir)) {
    return resolvedRootDir
  }

  const mainWorktreeRoot = path.join(resolvedRootDir, MAIN_WORKTREE_DIRECTORY)
  const looksLikeWorktreeControlRoot =
    (await pathExists(path.join(resolvedRootDir, '.git'))) ||
    (await pathExists(path.join(resolvedRootDir, '.bare')))

  if (looksLikeWorktreeControlRoot && (await hasWorkspaceMarkers(mainWorktreeRoot))) {
    return mainWorktreeRoot
  }

  return resolvedRootDir
}

export async function inspectWorkspace(rootDir: string): Promise<WorkspaceInspection> {
  const resolvedRootDir = await resolveWorkspaceRoot(rootDir)
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
  const hasTrpc =
    (await pathExists(path.join(resolvedRootDir, 'packages', 'app-router', 'package.json'))) ||
    (await pathExists(path.join(resolvedRootDir, 'packages', 'trpc', 'package.json')))
  const hasWorktreePolicy = await pathExists(
    path.join(resolvedRootDir, 'docs', 'engineering', 'worktree-workflow.md'),
  )
  const serverProvider = hasServer ? await detectServerProvider(resolvedRootDir) : null

  return {
    rootDir: resolvedRootDir,
    packageManager,
    appName: metadata.appName,
    displayName: metadata.displayName ?? toDefaultDisplayName(metadata.appName),
    hasServer,
    hasBackoffice,
    hasTrpc,
    hasWorktreePolicy,
    serverProvider,
  }
}
