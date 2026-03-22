import type { ServerProvider } from '../providers/index.js'

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
