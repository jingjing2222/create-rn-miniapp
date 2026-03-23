import type { GeneratedWorkspaceOptions } from './types.js'
import { detectServerProvider } from '../providers/index.js'
import { readServerScaffoldState } from '../server/project.js'
import { resolveWorkspaceOptionalState } from '../workspace/optional-state.js'
import { inspectWorkspaceTopology } from '../workspace/topology.js'

export async function resolveGeneratedWorkspaceOptions(
  targetRoot: string,
): Promise<GeneratedWorkspaceOptions> {
  const topology = await inspectWorkspaceTopology(targetRoot)
  const detectedServerProvider = topology.hasServer ? await detectServerProvider(targetRoot) : null
  const serverScaffoldState = topology.hasServer ? await readServerScaffoldState(targetRoot) : null

  return resolveWorkspaceOptionalState({
    topology,
    detectedServerProvider,
    serverScaffoldState,
  })
}
