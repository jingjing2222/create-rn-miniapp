import type { CliPrompter } from '../cli/index.js'
import type { ProvisionedCloudflareWorker } from '../providers/cloudflare/provision.js'
import type { ProvisionedFirebaseProject } from '../providers/firebase/provision.js'
import type { ProvisionedSupabaseProject } from '../providers/supabase/provision.js'
import type { ServerProvider } from '../providers/index.js'
import type { buildAddCommandPhases } from '../runtime/commands.js'
import type { PackageManager } from '../runtime/package-manager.js'
import type { ProvisioningNote, ServerProjectMode, ServerScaffoldState } from '../server/project.js'
import type { TemplateTokens } from '../templates/types.js'

export type AddOptions = {
  prompt: CliPrompter
  rootDir: string
  packageManager: PackageManager
  appName: string
  displayName: string
  existingServerProvider: ServerProvider | null
  existingServerScaffoldState: ServerScaffoldState | null
  existingHasBackoffice: boolean
  existingHasTrpc: boolean
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
  withServer: boolean
  withTrpc: boolean
  removeCloudflareApiClientHelpers: boolean
  withBackoffice: boolean
  skipInstall: boolean
}

export type AddCommandPhases = ReturnType<typeof buildAddCommandPhases>

export type AddServerFlowState = {
  activeServerProvider: ServerProvider | null
  patchServerProvider: ServerProvider | null
  finalServerProvider: ServerProvider | null
  trpcEnabled: boolean
}

export type AddContext = {
  options: AddOptions
  targetRoot: string
  notes: ProvisioningNote[]
  tokens: TemplateTokens
  commandPhases: AddCommandPhases | null
  serverFlowState: AddServerFlowState | null
  trpcEnabled: boolean
  initialServerState: ServerScaffoldState | null
  provisionedSupabaseProject: ProvisionedSupabaseProject | null
  provisionedCloudflareWorker: ProvisionedCloudflareWorker | null
  provisionedFirebaseProject: ProvisionedFirebaseProject | null
}

export type AddResult = Pick<AddContext, 'targetRoot' | 'notes'>
