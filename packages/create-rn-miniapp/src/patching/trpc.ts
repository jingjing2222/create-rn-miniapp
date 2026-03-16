export const TRPC_CLIENT_VERSION = '^11.13.4'
export const TRPC_SERVER_VERSION = '^11.13.4'
export const APP_ROUTER_WORKSPACE_DEPENDENCY = 'workspace:*'
export const CONTRACTS_WORKSPACE_DEPENDENCY = 'workspace:*'
export const ZOD_VERSION = '^4.3.6'

export function renderCloudflareTrpcClientSource(options: { urlExpression: string }) {
  return [
    "import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'",
    "import type { AppRouter } from '@workspace/app-router'",
    '',
    'function resolveTrpcUrl() {',
    `  const baseUrl = ${options.urlExpression}.trim()`,
    '',
    '  if (!baseUrl) {',
    "    throw new Error('Cloudflare API base URL이 비어 있어요. .env.local을 먼저 확인해 주세요.')",
    '  }',
    '',
    "  return baseUrl.replace(/\\/$/, '') + '/trpc'",
    '}',
    '',
    'export const trpc = createTRPCProxyClient<AppRouter>({',
    '  links: [',
    '    httpBatchLink({',
    '      url: resolveTrpcUrl(),',
    '    }),',
    '  ],',
    '})',
    '',
  ].join('\n')
}

export function renderSupabaseTrpcClientSource(options: {
  supabaseImportPath: string
  urlExpression: string
  publishableKeyExpression: string
}) {
  return [
    "import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'",
    "import type { AppRouter } from '@workspace/app-router'",
    `import { supabase } from '${options.supabaseImportPath}'`,
    '',
    'function resolveTrpcUrl() {',
    `  const baseUrl = ${options.urlExpression}.trim()`,
    '',
    '  if (!baseUrl) {',
    "    throw new Error('Supabase URL이 비어 있어요. .env.local을 먼저 확인해 주세요.')",
    '  }',
    '',
    "  return baseUrl.replace(/\\/$/, '') + '/functions/v1/api/trpc'",
    '}',
    '',
    'async function resolveTrpcHeaders() {',
    '  const headers = {',
    `    apikey: ${options.publishableKeyExpression}.trim(),`,
    '  } satisfies Record<string, string>',
    '',
    '  const { data } = await supabase.auth.getSession()',
    '  const accessToken = data.session?.access_token?.trim()',
    '',
    '  if (accessToken) {',
    "    headers.Authorization = 'Bearer ' + accessToken",
    '  }',
    '',
    '  return headers',
    '}',
    '',
    'export const trpc = createTRPCProxyClient<AppRouter>({',
    '  links: [',
    '    httpBatchLink({',
    '      url: resolveTrpcUrl(),',
    '      headers: resolveTrpcHeaders,',
    '    }),',
    '  ],',
    '})',
    '',
  ].join('\n')
}

export function renderCloudflareServerTrpcContextSource() {
  return [
    'export type CloudflareTrpcContext = {',
    '  requestId: string | null',
    '}',
    '',
    'export function createCloudflareTrpcContext(request: Request): CloudflareTrpcContext {',
    '  return {',
    "    requestId: request.headers.get('cf-ray') ?? request.headers.get('x-request-id') ?? null,",
    '  }',
    '}',
    '',
  ].join('\n')
}

export function renderCloudflareServerIndexSource() {
  return [
    "import { fetchRequestHandler } from '@trpc/server/adapters/fetch'",
    "import { appRouter } from '@workspace/app-router'",
    "import { createCloudflareTrpcContext } from './trpc/context'",
    '',
    'export default {',
    '  async fetch(request: Request): Promise<Response> {',
    "    if (new URL(request.url).pathname === '/') {",
    "      return Response.json({ ok: true, message: 'Cloudflare tRPC server is ready.' })",
    '    }',
    '',
    '    return fetchRequestHandler({',
    "      endpoint: '/trpc',",
    '      req: request,',
    '      router: appRouter,',
    '      createContext: () => createCloudflareTrpcContext(request),',
    '    })',
    '  },',
    '}',
    '',
  ].join('\n')
}

export function renderSupabaseEdgeFunctionTrpcSource() {
  return [
    "import { fetchRequestHandler } from 'npm:@trpc/server/adapters/fetch'",
    "import { appRouter } from '@workspace/app-router'",
    '',
    'Deno.serve((request) =>',
    '  fetchRequestHandler({',
    "    endpoint: '/api/trpc',",
    '    req: request,',
    '    router: appRouter,',
    '    createContext: () => ({',
    "      requestId: request.headers.get('x-request-id') ?? null,",
    '    }),',
    '  }),',
    ')',
    '',
  ].join('\n')
}

export function renderSupabaseTrpcDenoConfig() {
  return `${JSON.stringify(
    {
      imports: {
        '@workspace/app-router': '../../../../packages/app-router/src/index.ts',
        '@workspace/contracts': '../../../../packages/contracts/src/index.ts',
        '@trpc/server': `npm:@trpc/server@${TRPC_SERVER_VERSION}`,
        zod: `npm:zod@${ZOD_VERSION}`,
      },
    },
    null,
    2,
  )}\n`
}
