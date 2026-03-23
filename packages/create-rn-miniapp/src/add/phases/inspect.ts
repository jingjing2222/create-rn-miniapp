import path from 'node:path'
import { createTemplateTokens } from '../../scaffold/helpers.js'
import type { AddContext, AddOptions } from '../context.js'

export async function inspectAddWorkspace(options: AddOptions): Promise<AddContext> {
  return {
    options,
    targetRoot: path.resolve(options.rootDir),
    notes: [],
    tokens: createTemplateTokens({
      appName: options.appName,
      displayName: options.displayName,
      packageManager: options.packageManager,
    }),
    commandPhases: null,
    serverFlowState: null,
    trpcEnabled: false,
    initialServerState: null,
    provisionedSupabaseProject: null,
    provisionedCloudflareWorker: null,
    provisionedFirebaseProject: null,
  }
}
