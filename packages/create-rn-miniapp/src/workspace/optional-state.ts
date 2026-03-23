import type { ServerProvider } from '../providers/index.js'
import { detectServerProvider } from '../providers/index.js'
import { readServerScaffoldState, type ServerScaffoldState } from '../server/project.js'
import {
  inspectWorkspaceTopology,
  hasTrpcWorkspace,
  type WorkspaceTopologySnapshot,
} from './topology.js'

export type WorkspaceOptionalState = {
  hasBackoffice: boolean
  hasTrpc: boolean
  serverProvider: ServerProvider | null
}

export type InspectedOptionalWorkspaceState = WorkspaceOptionalState & {
  topology: WorkspaceTopologySnapshot
  detectedServerProvider: ServerProvider | null
  serverScaffoldState: ServerScaffoldState | null
}

function assertConsistentServerScaffoldState(options: {
  state: ServerScaffoldState
  detectedServerProvider: ServerProvider
  topology: WorkspaceTopologySnapshot
}) {
  const mismatches: string[] = []
  const actualHasBackoffice = options.topology.hasBackoffice
  const actualHasTrpc = hasTrpcWorkspace(options.topology)

  if (options.state.serverProvider !== options.detectedServerProvider) {
    mismatches.push(
      `serverProvider(state=${options.state.serverProvider}, actual=${options.detectedServerProvider})`,
    )
  }

  if (options.state.backoffice !== actualHasBackoffice) {
    mismatches.push(`backoffice(state=${options.state.backoffice}, actual=${actualHasBackoffice})`)
  }

  if (options.state.trpc !== actualHasTrpc) {
    mismatches.push(`trpc(state=${options.state.trpc}, actual=${actualHasTrpc})`)
  }

  if (mismatches.length > 0) {
    throw new Error(
      `server/.create-rn-miniapp/state.json과 실제 workspace topology가 서로 다릅니다: ${mismatches.join(', ')}`,
    )
  }
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

export async function inspectOptionalWorkspaceState(
  targetRoot: string,
): Promise<InspectedOptionalWorkspaceState> {
  const topology = await inspectWorkspaceTopology(targetRoot)
  const detectedServerProvider = topology.hasServer ? await detectServerProvider(targetRoot) : null
  const serverScaffoldState = topology.hasServer ? await readServerScaffoldState(targetRoot) : null

  if (serverScaffoldState && detectedServerProvider) {
    assertConsistentServerScaffoldState({
      state: serverScaffoldState,
      detectedServerProvider,
      topology,
    })
  }

  return {
    topology,
    detectedServerProvider,
    serverScaffoldState,
    ...resolveWorkspaceOptionalState({
      topology,
      detectedServerProvider,
      serverScaffoldState,
    }),
  }
}
