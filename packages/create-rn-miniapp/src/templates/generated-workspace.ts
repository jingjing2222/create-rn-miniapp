import type { GeneratedWorkspaceHints, GeneratedWorkspaceOptions } from './types.js'
import { hasTrpcWorkspace, inspectWorkspaceTopology } from '../workspace/topology.js'

export async function resolveGeneratedWorkspaceOptions(
  targetRoot: string,
  hints: GeneratedWorkspaceHints,
): Promise<GeneratedWorkspaceOptions> {
  const topology = await inspectWorkspaceTopology(targetRoot)

  return {
    hasBackoffice: topology.hasBackoffice,
    serverProvider: topology.hasServer ? hints.serverProvider : null,
    hasTrpc: hasTrpcWorkspace(topology),
  }
}
