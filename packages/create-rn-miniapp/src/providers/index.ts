import path from 'node:path'
import type { CommandSpec } from '../runtime/command-spec.js'
import { getPackageManagerAdapter, type PackageManager } from '../runtime/package-manager.js'
import type { ServerScaffoldState } from '../server/project.js'
import type { OptionalSkillId } from '../templates/skill-catalog.js'
import { SERVER_PROVIDER_METADATA, SERVER_PROVIDERS, type ServerProvider } from './catalog.js'
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
import { buildSupabaseBootstrapPlan } from './supabase/provision.js'

export { SERVER_PROVIDERS, SERVER_PROVIDER_OPTIONS, type ServerProvider } from './catalog.js'

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
  buildPlan(options: ProviderPlanOptions): CommandSpec[]
  prepareServerWorkspace?(options: ProviderWorkspaceOptions): Promise<void>
  patchServerWorkspace(options: ProviderPatchOptions): Promise<void>
  bootstrapFrontend?(options: Omit<ProviderPatchOptions, 'packageManager'>): Promise<void>
  bootstrapBackoffice?(options: Omit<ProviderPatchOptions, 'packageManager'>): Promise<void>
}

const supabaseAdapter: ServerProviderAdapter = {
  id: 'supabase',
  label: SERVER_PROVIDER_METADATA.supabase.label,
  readmeDescription: SERVER_PROVIDER_METADATA.supabase.readmeDescription,
  supportsTrpc: false,
  optionalSkillId: 'supabase-project',
  async detect(rootDir) {
    return pathExists(path.join(rootDir, 'server', 'supabase', 'config.toml'))
  },
  buildPlan(options) {
    return buildSupabaseBootstrapPlan({
      targetRoot: options.targetRoot,
      packageManager: options.packageManager,
      functionName: SUPABASE_DEFAULT_FUNCTION_NAME,
    })
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
  label: SERVER_PROVIDER_METADATA.cloudflare.label,
  readmeDescription: SERVER_PROVIDER_METADATA.cloudflare.readmeDescription,
  supportsTrpc: true,
  optionalSkillId: 'cloudflare-worker',
  async detect(rootDir) {
    return (
      (await pathExists(path.join(rootDir, 'server', 'wrangler.jsonc'))) ||
      (await pathExists(path.join(rootDir, 'server', 'wrangler.toml')))
    )
  },
  buildPlan(options) {
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
  label: SERVER_PROVIDER_METADATA.firebase.label,
  readmeDescription: SERVER_PROVIDER_METADATA.firebase.readmeDescription,
  supportsTrpc: false,
  optionalSkillId: 'firebase-functions',
  async detect(rootDir) {
    return pathExists(path.join(rootDir, 'server', 'firebase.json'))
  },
  buildPlan() {
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
