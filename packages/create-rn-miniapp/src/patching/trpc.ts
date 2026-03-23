import { dedentWithTrailingNewline } from '../runtime/dedent.js'
export const TRPC_CLIENT_VERSION = '^11.13.4'
export const TRPC_SERVER_VERSION = '^11.13.4'
export const APP_ROUTER_WORKSPACE_DEPENDENCY = 'workspace:*'
export const CONTRACTS_WORKSPACE_DEPENDENCY = 'workspace:*'
export const ZOD_VERSION = '^4.3.6'

export function renderCloudflareTrpcClientSource(options: { urlExpression: string }) {
  return dedentWithTrailingNewline`
  import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
  import type { AppRouter } from '@workspace/app-router'

  function resolveTrpcUrl() {
    const baseUrl = ${options.urlExpression}.trim()

    if (!baseUrl) {
      throw new Error('Cloudflare API base URL이 비어 있어요. .env.local을 먼저 확인해 주세요.')
    }

    return baseUrl.replace(/\\/$/, '') + '/trpc'
  }

  export const trpc = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: resolveTrpcUrl(),
      }),
    ],
  })
`
}

export function renderCloudflareServerTrpcContextSource() {
  return dedentWithTrailingNewline`
  export type CloudflareTrpcContext = {
    requestId: string | null
  }

  export function createCloudflareTrpcContext(request: Request): CloudflareTrpcContext {
    return {
      requestId: request.headers.get('cf-ray') ?? request.headers.get('x-request-id') ?? null,
    }
  }
`
}

export function renderCloudflareServerIndexSource() {
  return dedentWithTrailingNewline`
  import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
  import { appRouter } from '@workspace/app-router'
  import { createCloudflareTrpcContext } from './trpc/context'

  export default {
    async fetch(request: Request): Promise<Response> {
      if (new URL(request.url).pathname === '/') {
        return Response.json({
          ok: true,
          message: 'Cloudflare tRPC server is ready.',
          trpcEndpoint: '/trpc',
        })
      }

      return fetchRequestHandler({
        endpoint: '/trpc',
        req: request,
        router: appRouter,
        createContext: () => createCloudflareTrpcContext(request),
      })
    },
  }
`
}
