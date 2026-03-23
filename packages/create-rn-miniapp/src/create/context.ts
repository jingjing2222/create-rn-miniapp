import type { CliPrompter } from '../cli/index.js'
import type { ProvisionedCloudflareWorker } from '../providers/cloudflare/provision.js'
import type { ProvisionedFirebaseProject } from '../providers/firebase/provision.js'
import type { ProvisionedSupabaseProject } from '../providers/supabase/provision.js'
import type { ServerProvider } from '../providers/index.js'
import type { buildCreateCommandPhases } from '../runtime/commands.js'
import type { PackageManager } from '../runtime/package-manager.js'
import type { ProvisioningNote, ServerProjectMode, ServerScaffoldState } from '../server/project.js'
import type { SkillId } from '../templates/skill-catalog.js'
import type { TemplateTokens } from '../templates/types.js'

export type CreateOptions = {
  prompt: CliPrompter
  packageManager: PackageManager
  appName: string
  displayName: string
  selectedSkills: SkillId[]
  outputDir: string
  noGit: boolean
  serverProvider: ServerProvider | null
  serverProjectMode: ServerProjectMode | null
  skipServerProvisioning: boolean
  withTrpc: boolean
  withBackoffice: boolean
  skipInstall: boolean
}

export type CreateCommandPhases = ReturnType<typeof buildCreateCommandPhases>

export type CreateContext = {
  options: CreateOptions
  targetRoot: string
  notes: ProvisioningNote[]
  installedSkillNotes: ProvisioningNote[]
  tokens: TemplateTokens
  trpcEnabled: boolean
  initialServerState: ServerScaffoldState | null
  commandPhases: CreateCommandPhases | null
  provisionedSupabaseProject: ProvisionedSupabaseProject | null
  provisionedCloudflareWorker: ProvisionedCloudflareWorker | null
  provisionedFirebaseProject: ProvisionedFirebaseProject | null
}

export type CreateResult = Pick<CreateContext, 'targetRoot' | 'notes'>
