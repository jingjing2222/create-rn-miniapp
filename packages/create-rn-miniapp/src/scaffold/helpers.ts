import path from 'node:path'
import { log } from '@clack/prompts'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import { getServerProviderAdapter, type ServerProvider } from '../providers/index.js'
import {
  pathExists,
  type TemplateTokens,
  type WorkspaceName,
  writeWorkspaceNpmrc,
} from '../templates/index.js'

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
    packageManagerCommand: options.packageManager,
    packageManagerRunCommand: packageManager.runCommandPrefix,
    packageManagerExecCommand: packageManager.execCommandPrefix,
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

export async function resolveRootWorkspaces(targetRoot: string) {
  const workspaces: WorkspaceName[] = []

  for (const workspace of ['frontend', 'server', 'backoffice'] as const) {
    if (await pathExists(path.join(targetRoot, workspace))) {
      workspaces.push(workspace)
    }
  }

  return workspaces
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
}) {
  if (!options.serverProvider || !(await pathExists(path.join(options.targetRoot, 'server')))) {
    return
  }

  const adapter = getServerProviderAdapter(options.serverProvider)

  await adapter.patchServerWorkspace({
    targetRoot: options.targetRoot,
    tokens: options.tokens,
    packageManager: options.packageManager,
  })
}
