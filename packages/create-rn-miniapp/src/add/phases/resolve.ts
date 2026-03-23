import { buildAddCommandPhases } from '../../runtime/commands.js'
import { resolveAddServerFlowState } from '../../scaffold/flow-state.js'
import {
  buildServerScaffoldState,
  resolveRequestedRemoteInitializationState,
} from '../../server/project.js'
import type { AddContext } from '../context.js'

function buildAddInitialServerState(ctx: AddContext) {
  const { options } = ctx
  const serverProvider = options.withServer
    ? options.serverProvider
    : (options.serverProvider ?? options.existingServerProvider)

  if (!serverProvider) {
    return null
  }

  if (options.withServer) {
    return buildServerScaffoldState({
      serverProvider,
      serverProjectMode: options.serverProjectMode,
      remoteInitialization: resolveRequestedRemoteInitializationState({
        serverProjectMode: options.serverProjectMode,
        skipServerProvisioning: options.skipServerProvisioning,
      }),
      trpc: ctx.trpcEnabled,
      backoffice: options.withBackoffice || options.existingHasBackoffice,
    })
  }

  return {
    serverProvider,
    serverProjectMode: options.existingServerScaffoldState?.serverProjectMode ?? null,
    remoteInitialization: options.existingServerScaffoldState?.remoteInitialization ?? 'not-run',
    trpc:
      ctx.trpcEnabled ||
      options.existingServerScaffoldState?.trpc === true ||
      options.existingHasTrpc,
    backoffice:
      options.withBackoffice ||
      options.existingServerScaffoldState?.backoffice === true ||
      options.existingHasBackoffice,
  }
}

export async function resolveAddContext(ctx: AddContext) {
  const serverFlowState = resolveAddServerFlowState({
    existingServerProvider: ctx.options.existingServerProvider,
    requestedServerProvider: ctx.options.serverProvider,
    withServer: ctx.options.withServer,
    withTrpc: ctx.options.withTrpc,
  })
  const trpcEnabled = serverFlowState.trpcEnabled
  const resolvedContext = {
    ...ctx,
    serverFlowState,
    trpcEnabled,
    commandPhases: buildAddCommandPhases({
      targetRoot: ctx.targetRoot,
      packageManager: ctx.options.packageManager,
      serverProvider: ctx.options.serverProvider,
      withBackoffice: ctx.options.withBackoffice,
    }),
  }

  return {
    ...resolvedContext,
    initialServerState: buildAddInitialServerState(resolvedContext),
  }
}
