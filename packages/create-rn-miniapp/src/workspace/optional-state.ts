import type { ServerProvider } from '../providers/index.js'
import type { ServerScaffoldState } from '../server/project.js'
import { hasTrpcWorkspace, type WorkspaceTopologySnapshot } from './topology.js'

export type WorkspaceOptionalState = {
  hasBackoffice: boolean
  hasTrpc: boolean
  serverProvider: ServerProvider | null
}

export function resolveWorkspaceOptionalState(options: {
  topology: WorkspaceTopologySnapshot
  detectedServerProvider: ServerProvider | null
  serverScaffoldState: ServerScaffoldState | null
}): WorkspaceOptionalState {
  const actualHasBackoffice = options.topology.hasBackoffice
  const actualHasTrpc = hasTrpcWorkspace(options.topology)

  if (options.topology.hasServer && options.serverScaffoldState) {
    return {
      hasBackoffice: options.serverScaffoldState.backoffice,
      hasTrpc: options.serverScaffoldState.trpc,
      serverProvider: options.serverScaffoldState.serverProvider,
    }
  }

  return {
    hasBackoffice: actualHasBackoffice,
    hasTrpc: actualHasTrpc,
    serverProvider: options.detectedServerProvider,
  }
}
