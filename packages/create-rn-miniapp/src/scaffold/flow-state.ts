import type { ServerProvider } from '../providers/index.js'
import {
  buildServerScaffoldState,
  resolveRequestedRemoteInitializationState,
  type ServerProjectMode,
  type ServerScaffoldState,
} from '../server/project.js'

export function resolveCreateTrpcEnabled(options: {
  serverProvider: ServerProvider | null
  withTrpc: boolean
}) {
  return options.withTrpc && options.serverProvider === 'cloudflare'
}

export function resolveAddServerFlowState(options: {
  existingServerProvider: ServerProvider | null
  requestedServerProvider: ServerProvider | null
  withServer: boolean
  withTrpc: boolean
}) {
  const activeServerProvider = options.withServer
    ? options.requestedServerProvider
    : options.existingServerProvider
  const trpcProvider = activeServerProvider ?? options.existingServerProvider
  const trpcEnabled = options.withTrpc && trpcProvider === 'cloudflare'

  return {
    activeServerProvider,
    patchServerProvider:
      activeServerProvider && (options.withServer || trpcEnabled) ? activeServerProvider : null,
    finalServerProvider: activeServerProvider,
    trpcEnabled,
  }
}

export function resolveAddServerState(options: {
  existingServerProvider: ServerProvider | null
  existingServerScaffoldState: ServerScaffoldState | null
  existingHasBackoffice: boolean
  existingHasTrpc: boolean
  requestedServerProvider: ServerProvider | null
  requestedServerProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
  withServer: boolean
  withTrpc: boolean
  withBackoffice: boolean
}) {
  const serverFlowState = resolveAddServerFlowState({
    existingServerProvider: options.existingServerProvider,
    requestedServerProvider: options.requestedServerProvider,
    withServer: options.withServer,
    withTrpc: options.withTrpc,
  })
  const serverProvider = serverFlowState.finalServerProvider

  if (!serverProvider) {
    return {
      serverFlowState,
      initialServerState: null,
    }
  }

  if (options.withServer) {
    return {
      serverFlowState,
      initialServerState: buildServerScaffoldState({
        serverProvider,
        serverProjectMode: options.requestedServerProjectMode,
        remoteInitialization: resolveRequestedRemoteInitializationState({
          serverProjectMode: options.requestedServerProjectMode,
          skipServerProvisioning: options.skipServerProvisioning,
        }),
        trpc: serverFlowState.trpcEnabled,
        backoffice: options.withBackoffice || options.existingHasBackoffice,
      }),
    }
  }

  return {
    serverFlowState,
    initialServerState: buildServerScaffoldState({
      serverProvider,
      serverProjectMode: options.existingServerScaffoldState?.serverProjectMode ?? null,
      remoteInitialization: options.existingServerScaffoldState?.remoteInitialization ?? 'not-run',
      trpc:
        serverFlowState.trpcEnabled ||
        options.existingServerScaffoldState?.trpc === true ||
        options.existingHasTrpc,
      backoffice:
        options.withBackoffice ||
        options.existingServerScaffoldState?.backoffice === true ||
        options.existingHasBackoffice,
    }),
  }
}
