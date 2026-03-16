export const TRPC_CLIENT_VERSION = '^11.13.4'
export const TRPC_SERVER_VERSION = '^11.13.4'
export const TRPC_WORKSPACE_DEPENDENCY = 'workspace:*'
export const ZOD_VERSION = '^4.3.6'

export function renderCloudflareTrpcClientSource(options: {
  envImportPath: string
  envResolverName: string
}) {
  return [
    "import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'",
    "import type { AppRouter } from '@workspace/trpc'",
    `import { ${options.envResolverName} } from '${options.envImportPath}'`,
    '',
    'export const trpc = createTRPCProxyClient<AppRouter>({',
    '  links: [',
    '    httpBatchLink({',
    `      url: ${options.envResolverName}('trpc'),`,
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
    "import type { AppRouter } from '@workspace/trpc'",
    `import { supabase } from '${options.supabaseImportPath}'`,
    '',
    'function resolveTrpcUrl() {',
    `  const baseUrl = ${options.urlExpression}.trim()`,
    '',
    '  if (!baseUrl) {',
    "    throw new Error('Supabase URL이 비어 있어요. .env.local을 먼저 확인해 주세요.')",
    '  }',
    '',
    "  return `${baseUrl.replace(/\\/$/, '')}/functions/v1/api/trpc`",
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
    '    headers.Authorization = `Bearer ${accessToken}`',
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
    "import { appRouter } from '@workspace/trpc'",
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
    "import { appRouter } from '../_shared/trpc/index.ts'",
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

export function renderSupabaseTrpcSyncScript() {
  return [
    "import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'",
    "import path from 'node:path'",
    "import { fileURLToPath } from 'node:url'",
    '',
    "const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')",
    "const repoRoot = path.resolve(serverRoot, '..')",
    "const sourceDir = path.resolve(repoRoot, 'packages/trpc/src')",
    "const targetDir = path.resolve(serverRoot, 'supabase/functions/_shared/trpc')",
    '',
    'async function rewriteImports(targetRoot) {',
    '  const entries = await readdir(targetRoot, { withFileTypes: true })',
    '',
    '  for (const entry of entries) {',
    '    const targetPath = path.join(targetRoot, entry.name)',
    '',
    '    if (entry.isDirectory()) {',
    '      await rewriteImports(targetPath)',
    '      continue',
    '    }',
    '',
    "    if (!entry.name.endsWith('.ts')) {",
    '      continue',
    '    }',
    '',
    "    let source = await readFile(targetPath, 'utf8')",
    '    source = source.replaceAll("\'@trpc/server\'", "\'npm:@trpc/server\'")',
    '    source = source.replaceAll(\'"@trpc/server"\', \'"npm:@trpc/server"\')',
    '    source = source.replaceAll("\'zod\'", "\'npm:zod\'")',
    '    source = source.replaceAll(\'"zod"\', \'"npm:zod"\')',
    "    source = source.replaceAll(/from '([^']+)'/g, (match, specifier) => {",
    "      return specifier.startsWith('.') && !specifier.endsWith('.ts') ? `from '${specifier}.ts'` : match",
    '    })',
    '    source = source.replaceAll(/from "([^"]+)"/g, (match, specifier) => {',
    "      return specifier.startsWith('.') && !specifier.endsWith('.ts') ? `from \\\"${specifier}.ts\\\"` : match",
    '    })',
    "    await writeFile(targetPath, source, 'utf8')",
    '  }',
    '}',
    '',
    'await mkdir(targetDir, { recursive: true })',
    'await cp(sourceDir, targetDir, { recursive: true, force: true })',
    'await rewriteImports(targetDir)',
    '',
  ].join('\n')
}
