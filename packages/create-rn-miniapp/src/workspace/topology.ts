import path from 'node:path'
import {
  APP_ROUTER_WORKSPACE_PATH,
  CONTRACTS_WORKSPACE_PATH,
  LEGACY_TRPC_WORKSPACE_PACKAGE_PATH,
} from './trpc.js'
import { pathExists } from '../templates/filesystem.js'

export type WorkspaceTopologySnapshot = {
  hasServer: boolean
  hasBackoffice: boolean
  hasContractsWorkspace: boolean
  hasAppRouterWorkspace: boolean
  hasLegacyTrpcWorkspace: boolean
}

export async function inspectWorkspaceTopology(
  targetRoot: string,
): Promise<WorkspaceTopologySnapshot> {
  return {
    hasServer: await pathExists(path.join(targetRoot, 'server')),
    hasBackoffice: await pathExists(path.join(targetRoot, 'backoffice')),
    hasContractsWorkspace: await pathExists(path.join(targetRoot, CONTRACTS_WORKSPACE_PATH)),
    hasAppRouterWorkspace: await pathExists(path.join(targetRoot, APP_ROUTER_WORKSPACE_PATH)),
    hasLegacyTrpcWorkspace: await pathExists(
      path.join(targetRoot, LEGACY_TRPC_WORKSPACE_PACKAGE_PATH),
    ),
  }
}

export function hasTrpcWorkspace(topology: WorkspaceTopologySnapshot) {
  return topology.hasLegacyTrpcWorkspace || topology.hasAppRouterWorkspace
}
