import path from 'node:path'
import { log } from '@clack/prompts'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import { getServerProviderAdapter, type ServerProvider } from '../providers/index.js'
import { resolveRootWorkspacePatterns } from '../root-workspaces.js'
import type { ServerScaffoldState } from '../server-project.js'
import { pathExists, writeWorkspaceNpmrc } from '../templates/filesystem.js'
import { applyTrpcWorkspaceTemplate } from '../templates/trpc.js'
import type { RootWorkspacePattern, TemplateTokens } from '../templates/types.js'

export function createTemplateTokens(options: {
  appName: string
  displayName: string
  packageManager: PackageManager
}) {
  const packageManager = getPackageManagerAdapter(options.packageManager)

  return {
    appName: options.appName,
    displayName: options.displayName,
    packageManager: options.packageManager,
    packageManagerField: packageManager.packageManagerField,
    packageManagerCommand: options.packageManager,
    verifyCommand: packageManager.verifyCommand(),
  } satisfies TemplateTokens
}

export async function maybeWriteNpmWorkspaceConfig(
  workspaceRoot: string,
  packageManager: PackageManager,
) {
  if (packageManager !== 'npm') {
    return
  }

  await writeWorkspaceNpmrc(workspaceRoot)
}

export async function resolveRootWorkspaces(targetRoot: string): Promise<RootWorkspacePattern[]> {
  return resolveRootWorkspacePatterns(targetRoot)
}

export async function maybePrepareServerWorkspace(options: {
  targetRoot: string
  tokens: TemplateTokens
  packageManager: PackageManager
  serverProvider: ServerProvider | null
}) {
  if (!options.serverProvider || !(await pathExists(path.join(options.targetRoot, 'server')))) {
    return
  }

  const adapter = getServerProviderAdapter(options.serverProvider)

  if (!adapter.prepareServerWorkspace) {
    return
  }

  log.step(`server ${adapter.label} 워크스페이스를 준비할게요`)
  await adapter.prepareServerWorkspace({
    targetRoot: options.targetRoot,
    tokens: options.tokens,
    packageManager: options.packageManager,
  })
}

export async function maybePatchServerWorkspace(options: {
  targetRoot: string
  tokens: TemplateTokens
  packageManager: PackageManager
  serverProvider: ServerProvider | null
  state: ServerScaffoldState | null
  trpc: boolean
}) {
  if (
    !options.serverProvider ||
    !options.state ||
    !(await pathExists(path.join(options.targetRoot, 'server')))
  ) {
    return
  }

  const adapter = getServerProviderAdapter(options.serverProvider)

  await adapter.patchServerWorkspace({
    targetRoot: options.targetRoot,
    tokens: options.tokens,
    packageManager: options.packageManager,
    state: options.state,
    trpc: options.trpc,
  })
}

export async function maybePrepareTrpcWorkspace(options: {
  targetRoot: string
  tokens: TemplateTokens
  withTrpc: boolean
  serverProvider: Extract<ServerProvider, 'cloudflare'> | null
}) {
  if (!options.withTrpc || !options.serverProvider) {
    return
  }

  await applyTrpcWorkspaceTemplate(options.targetRoot, options.tokens, {
    serverProvider: options.serverProvider,
  })
}
