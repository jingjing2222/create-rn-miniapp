import path from 'node:path'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import {
  ensureBackofficeCloudflareBootstrap,
  ensureBackofficeFirebaseBootstrap,
  ensureBackofficeSupabaseBootstrap,
  ensureFrontendCloudflareBootstrap,
  ensureFrontendFirebaseBootstrap,
  ensureFrontendSupabaseBootstrap,
  patchCloudflareServerWorkspace,
  patchFirebaseServerWorkspace,
  patchSupabaseServerWorkspace,
} from '../patching/index.js'
import {
  applyFirebaseServerWorkspaceTemplate,
  pathExists,
  SUPABASE_DEFAULT_FUNCTION_NAME,
  type TemplateTokens,
} from '../templates/index.js'

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
  trpc?: boolean
}

export type ServerProviderAdapter = {
  id: 'supabase' | 'cloudflare' | 'firebase'
  label: string
  supportsTrpc: boolean
  detect(rootDir: string): Promise<boolean>
  buildCreatePlan(options: ProviderPlanOptions): ServerProviderCommandSpec[]
  buildAddPlan(options: ProviderPlanOptions): ServerProviderCommandSpec[]
  prepareServerWorkspace?(options: ProviderPatchOptions): Promise<void>
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
      label: 'server Supabase 준비하기',
    },
    {
      cwd: serverRoot,
      ...packageManager.dlx('supabase', [
        'functions',
        'new',
        SUPABASE_DEFAULT_FUNCTION_NAME,
        '--workdir',
        '.',
        '--yes',
      ]),
      label: 'server Supabase Edge Function 만들기',
    },
  ]
}

const supabaseAdapter: ServerProviderAdapter = {
  id: 'supabase',
  label: 'Supabase',
  supportsTrpc: false,
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
      label: 'server Cloudflare Workers 준비하기',
    },
  ]
}

const cloudflareAdapter: ServerProviderAdapter = {
  id: 'cloudflare',
  label: 'Cloudflare Workers',
  supportsTrpc: true,
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

const firebaseAdapter: ServerProviderAdapter = {
  id: 'firebase',
  label: 'Firebase',
  supportsTrpc: false,
  async detect(rootDir) {
    return pathExists(path.join(rootDir, 'server', 'firebase.json'))
  },
  buildCreatePlan() {
    return []
  },
  buildAddPlan() {
    return []
  },
  async prepareServerWorkspace(options) {
    await applyFirebaseServerWorkspaceTemplate(options.targetRoot, options.tokens)
  },
  async patchServerWorkspace(options) {
    await patchFirebaseServerWorkspace(options.targetRoot, options.tokens, {
      packageManager: options.packageManager,
    })
  },
  async bootstrapFrontend(options) {
    await ensureFrontendFirebaseBootstrap(options.targetRoot, options.tokens)
  },
  async bootstrapBackoffice(options) {
    await ensureBackofficeFirebaseBootstrap(options.targetRoot, options.tokens)
  },
}

const serverProviders = {
  supabase: supabaseAdapter,
  cloudflare: cloudflareAdapter,
  firebase: firebaseAdapter,
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

export function serverProviderSupportsTrpc(
  provider: ServerProvider | null | undefined,
): provider is Extract<ServerProvider, 'cloudflare'> {
  return provider === 'cloudflare'
}

export async function detectServerProvider(rootDir: string) {
  for (const provider of SERVER_PROVIDERS) {
    if (await serverProviders[provider].detect(rootDir)) {
      return provider
    }
  }

  return null
}
