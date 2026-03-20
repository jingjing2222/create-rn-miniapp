import path from 'node:path'
import { APP_ROUTER_WORKSPACE_PATH, CONTRACTS_WORKSPACE_PATH } from '../trpc-workspace-metadata.js'
import { pathExists } from './filesystem.js'
import type { GeneratedWorkspaceHints, GeneratedWorkspaceOptions } from './types.js'

export async function resolveGeneratedWorkspaceOptions(
  targetRoot: string,
  hints: GeneratedWorkspaceHints,
): Promise<GeneratedWorkspaceOptions> {
  const hasBackoffice = await pathExists(path.join(targetRoot, 'backoffice'))
  const hasServerWorkspace = await pathExists(path.join(targetRoot, 'server'))
  const hasContractsWorkspace = await pathExists(path.join(targetRoot, CONTRACTS_WORKSPACE_PATH))
  const hasAppRouterWorkspace = await pathExists(path.join(targetRoot, APP_ROUTER_WORKSPACE_PATH))

  return {
    hasBackoffice,
    serverProvider: hasServerWorkspace ? hints.serverProvider : null,
    hasTrpc: hasContractsWorkspace && hasAppRouterWorkspace,
  }
}
