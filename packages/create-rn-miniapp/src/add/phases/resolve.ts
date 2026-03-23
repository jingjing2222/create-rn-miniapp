import { buildAddCommandPhases } from '../../runtime/commands.js'
import { resolveAddServerState } from '../../scaffold/flow-state.js'
import type { AddContext } from '../context.js'

export async function resolveAddContext(ctx: AddContext) {
  const serverState = resolveAddServerState({
    existingServerProvider: ctx.options.existingServerProvider,
    existingServerScaffoldState: ctx.options.existingServerScaffoldState,
    existingHasBackoffice: ctx.options.existingHasBackoffice,
    existingHasTrpc: ctx.options.existingHasTrpc,
    requestedServerProvider: ctx.options.serverProvider,
    requestedServerProjectMode: ctx.options.serverProjectMode,
    skipServerProvisioning: ctx.options.skipServerProvisioning,
    withServer: ctx.options.withServer,
    withTrpc: ctx.options.withTrpc,
    withBackoffice: ctx.options.withBackoffice,
  })
  const { serverFlowState } = serverState
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
    initialServerState: serverState.initialServerState,
  }
}
