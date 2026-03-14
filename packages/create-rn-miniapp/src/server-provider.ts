import path from 'node:path'
import { getPackageManagerAdapter, type PackageManager } from './package-manager.js'
import {
  ensureBackofficeCloudflareBootstrap,
  ensureBackofficeSupabaseBootstrap,
  ensureFrontendCloudflareBootstrap,
  ensureFrontendSupabaseBootstrap,
  patchCloudflareServerWorkspace,
  patchSupabaseServerWorkspace,
} from './patch.js'
import { pathExists, type TemplateTokens } from './templates.js'

export type ServerProviderCommandSpec = {
  cwd: string
  command: string
  args: string[]
  label: string
}

type ProviderPlanOptions = {
  targetRoot: string
  packageManager: PackageManager
}

type ProviderPatchOptions = {
  targetRoot: string
  tokens: TemplateTokens
  packageManager: PackageManager
}

export type ServerProviderAdapter = {
  id: 'supabase' | 'cloudflare'
  label: string
  detect(rootDir: string): Promise<boolean>
  buildCreatePlan(options: ProviderPlanOptions): ServerProviderCommandSpec[]
  buildAddPlan(options: ProviderPlanOptions): ServerProviderCommandSpec[]
  patchServerWorkspace(options: ProviderPatchOptions): Promise<void>
  bootstrapFrontend?(options: Omit<ProviderPatchOptions, 'packageManager'>): Promise<void>
  bootstrapBackoffice?(options: Omit<ProviderPatchOptions, 'packageManager'>): Promise<void>
}

function buildSupabasePlan(options: ProviderPlanOptions): ServerProviderCommandSpec[] {
  const packageManager = getPackageManagerAdapter(options.packageManager)
  const serverRoot = path.join(options.targetRoot, 'server')

  return [
    {
      cwd: serverRoot,
      ...packageManager.dlx('supabase', ['init']),
      label: 'server Supabase 초기화',
    },
  ]
}

const supabaseAdapter: ServerProviderAdapter = {
  id: 'supabase',
  label: 'Supabase',
  async detect(rootDir) {
    return pathExists(path.join(rootDir, 'server', 'supabase', 'config.toml'))
  },
  buildCreatePlan(options) {
    return buildSupabasePlan(options)
  },
  buildAddPlan(options) {
    return buildSupabasePlan(options)
  },
  async patchServerWorkspace(options) {
    await patchSupabaseServerWorkspace(options.targetRoot, options.tokens, {
      packageManager: options.packageManager,
    })
  },
  async bootstrapFrontend(options) {
    await ensureFrontendSupabaseBootstrap(options.targetRoot, options.tokens)
  },
  async bootstrapBackoffice(options) {
    await ensureBackofficeSupabaseBootstrap(options.targetRoot, options.tokens)
  },
}

function buildCloudflarePlan(options: ProviderPlanOptions): ServerProviderCommandSpec[] {
  const packageManager = getPackageManagerAdapter(options.packageManager)

  return [
    {
      cwd: options.targetRoot,
      ...packageManager.createCloudflareApp('server'),
      label: 'server Cloudflare Workers 초기화',
    },
  ]
}

const cloudflareAdapter: ServerProviderAdapter = {
  id: 'cloudflare',
  label: 'Cloudflare Workers',
  async detect(rootDir) {
    return (
      (await pathExists(path.join(rootDir, 'server', 'wrangler.jsonc'))) ||
      (await pathExists(path.join(rootDir, 'server', 'wrangler.toml')))
    )
  },
  buildCreatePlan(options) {
    return buildCloudflarePlan(options)
  },
  buildAddPlan(options) {
    return buildCloudflarePlan(options)
  },
  async patchServerWorkspace(options) {
    await patchCloudflareServerWorkspace(options.targetRoot, options.tokens, {
      packageManager: options.packageManager,
    })
  },
  async bootstrapFrontend(options) {
    await ensureFrontendCloudflareBootstrap(options.targetRoot, options.tokens)
  },
  async bootstrapBackoffice(options) {
    await ensureBackofficeCloudflareBootstrap(options.targetRoot, options.tokens)
  },
}

const serverProviders = {
  supabase: supabaseAdapter,
  cloudflare: cloudflareAdapter,
} as const satisfies Record<ServerProviderAdapter['id'], ServerProviderAdapter>

export const SERVER_PROVIDERS = Object.keys(serverProviders) as Array<keyof typeof serverProviders>

export const SERVER_PROVIDER_OPTIONS = SERVER_PROVIDERS.map((provider) => ({
  value: provider,
  label: serverProviders[provider].label,
}))

export type ServerProvider = (typeof SERVER_PROVIDERS)[number]

export function getServerProviderAdapter(provider: ServerProvider): ServerProviderAdapter {
  return serverProviders[provider]
}

export async function detectServerProvider(rootDir: string) {
  for (const provider of SERVER_PROVIDERS) {
    if (await serverProviders[provider].detect(rootDir)) {
      return provider
    }
  }

  return null
}
