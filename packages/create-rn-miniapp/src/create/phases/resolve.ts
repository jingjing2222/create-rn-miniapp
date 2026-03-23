import path from 'node:path'
import { resolveCreateTrpcEnabled } from '../../scaffold/flow-state.js'
import { createTemplateTokens } from '../../scaffold/helpers.js'
import {
  buildServerScaffoldState,
  resolveRequestedRemoteInitializationState,
} from '../../server/project.js'
import type { CreateContext, CreateOptions } from '../context.js'

export async function resolveCreateContext(options: CreateOptions): Promise<CreateContext> {
  const trpcEnabled = resolveCreateTrpcEnabled({
    serverProvider: options.serverProvider,
    withTrpc: options.withTrpc,
  })

  return {
    options,
    targetRoot: path.resolve(options.outputDir, options.appName),
    notes: [],
    installedSkillNotes: [],
    tokens: createTemplateTokens({
      appName: options.appName,
      displayName: options.displayName,
      packageManager: options.packageManager,
    }),
    trpcEnabled,
    initialServerState: buildServerScaffoldState({
      serverProvider: options.serverProvider,
      serverProjectMode: options.serverProjectMode,
      remoteInitialization: resolveRequestedRemoteInitializationState({
        serverProjectMode: options.serverProjectMode,
        skipServerProvisioning: options.skipServerProvisioning,
      }),
      trpc: trpcEnabled,
      backoffice: options.withBackoffice,
    }),
    commandPhases: null,
    provisionedSupabaseProject: null,
    provisionedCloudflareWorker: null,
    provisionedFirebaseProject: null,
  }
}
