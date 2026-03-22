import path from 'node:path'
import type { CommandSpec } from '../command-spec.js'
import { getPackageManagerAdapter, type PackageManager } from '../package-manager.js'
import type { ServerScaffoldState } from '../server-project.js'
import type { OptionalSkillId } from '../templates/skill-catalog.js'
import {
  ensureBackofficeFirebaseBootstrap,
  ensureBackofficeCloudflareBootstrap,
  ensureBackofficeSupabaseBootstrap,
} from '../patching/backoffice.js'
import {
  ensureFrontendCloudflareBootstrap,
  ensureFrontendFirebaseBootstrap,
  ensureFrontendSupabaseBootstrap,
} from '../patching/frontend.js'
import {
  patchCloudflareServerWorkspace,
  patchFirebaseServerWorkspace,
  patchSupabaseServerWorkspace,
} from '../patching/server.js'
import { pathExists } from '../templates/filesystem.js'
import {
  applyFirebaseServerWorkspaceTemplate,
  SUPABASE_DEFAULT_FUNCTION_NAME,
} from '../templates/server.js'
import type { TemplateTokens } from '../templates/types.js'

type ProviderPlanOptions = {
  targetRoot: string
  packageManager: PackageManager
}

type ProviderWorkspaceOptions = {
  targetRoot: string
  tokens: TemplateTokens
  packageManager: PackageManager
}

type ProviderPatchOptions = ProviderWorkspaceOptions & {
  state: ServerScaffoldState
  trpc?: boolean
}

export type ServerProviderAdapter = {
  id: 'supabase' | 'cloudflare' | 'firebase'
  label: string
  readmeDescription: string
  supportsTrpc: boolean
  optionalSkillId?: OptionalSkillId
  detect(rootDir: string): Promise<boolean>
  buildCreatePlan(options: ProviderPlanOptions): CommandSpec[]
  buildAddPlan(options: ProviderPlanOptions): CommandSpec[]
  prepareServerWorkspace?(options: ProviderWorkspaceOptions): Promise<void>
  patchServerWorkspace(options: ProviderPatchOptions): Promise<void>
  bootstrapFrontend?(options: Omit<ProviderPatchOptions, 'packageManager'>): Promise<void>
  bootstrapBackoffice?(options: Omit<ProviderPatchOptions, 'packageManager'>): Promise<void>
}

function buildSupabasePlan(options: ProviderPlanOptions): CommandSpec[] {
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
  readmeDescription: 'DB와 Functions를 같이 빠르게 시작하고 싶을 때',
  supportsTrpc: false,
  optionalSkillId: 'supabase-project',
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
      state: options.state,
    })
  },
  async bootstrapFrontend(options) {
    await ensureFrontendSupabaseBootstrap(options.targetRoot, options.tokens)
  },
  async bootstrapBackoffice(options) {
    await ensureBackofficeSupabaseBootstrap(options.targetRoot, options.tokens)
  },
}

function buildCloudflarePlan(options: ProviderPlanOptions): CommandSpec[] {
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
  readmeDescription: 'edge runtime과 binding 중심으로 가고 싶을 때',
  supportsTrpc: true,
  optionalSkillId: 'cloudflare-worker',
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
      state: options.state,
      trpc: options.trpc,
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
  readmeDescription: 'Functions, Firestore, Web SDK 흐름이 익숙할 때',
  supportsTrpc: false,
  optionalSkillId: 'firebase-functions',
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
      state: options.state,
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
