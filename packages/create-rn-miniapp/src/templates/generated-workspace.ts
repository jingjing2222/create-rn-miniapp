import type { GeneratedWorkspaceOptions } from './types.js'
import { inspectOptionalWorkspaceState } from '../workspace/optional-state.js'

export async function resolveGeneratedWorkspaceOptions(
  targetRoot: string,
): Promise<GeneratedWorkspaceOptions> {
  const optionalState = await inspectOptionalWorkspaceState(targetRoot)

  return {
    hasBackoffice: optionalState.hasBackoffice,
    serverProvider: optionalState.serverProvider,
    hasTrpc: optionalState.hasTrpc,
  }
}
